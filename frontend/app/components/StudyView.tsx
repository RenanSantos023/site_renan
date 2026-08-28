'use client';

import React, { useState, useEffect } from "react";
import type { Note, Card } from "../../amplify/data/resource";
import { calculateNextFSRSState } from "../../utils/fsrsMath";

interface StudyViewProps {
  notes: Note[];
  cards: Card[];
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onReviewCard: (cardId: string, updatedData: Partial<Card>) => void;
  onFinished: () => void;
  singleCardId?: string;
}

export default function StudyView({ 
  notes, 
  cards, 
  showToast, 
  onReviewCard, 
  onFinished, 
  singleCardId 
}: StudyViewProps) {
  const [studyQueue, setStudyQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Carregar fila de cartões ao iniciar
  useEffect(() => {
    const loadQueue = async () => {
      if (singleCardId) {
        const single = cards.find(c => c.cardId === singleCardId);
        if (single) setStudyQueue([single]);
        return;
      }

      const apiMode = localStorage.getItem("ultra_api_mode") || "mock";
      const apiUrl = localStorage.getItem("ultra_api_url") || "";
      const userId = localStorage.getItem("ultra_user_id") || "usr_dev_default";

      if (apiMode === "aws" && apiUrl) {
        setLoading(true);
        try {
          const response = await fetch(`${apiUrl}/study/due?limit=50`, {
            headers: {
              "Authorization": "Bearer SIMULATED_TOKEN",
              "X-User-Id": userId
            }
          });
          if (!response.ok) throw new Error();
          const result = await response.json();
          const mappedCards: Card[] = (result.cards || []).map((c: any) => ({
            cardId: c.card_id,
            noteId: c.note_id,
            deckId: c.deck_id,
            cardOrdinal: c.card_ordinal,
            state: c.state,
            stability: c.stability,
            difficulty: c.difficulty,
            dueDate: c.due_date,
            lastReviewDate: c.last_review_date,
            scheduledDays: c.scheduled_days,
            createdAt: c.created_at,
            updatedAt: c.updated_at
          }));
          setStudyQueue(mappedCards);
        } catch (e) {
          showToast("Erro ao carregar fila do Lambda. Usando dados locais.", "error");
          const now = new Date();
          const due = cards.filter(c => !c.dueDate || new Date(c.dueDate) <= now);
          setStudyQueue(due);
        } finally {
          setLoading(false);
        }
      } else {
        const now = new Date();
        const due = cards.filter(c => !c.dueDate || new Date(c.dueDate) <= now);
        setStudyQueue(due);
      }
    };

    loadQueue();
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards, singleCardId]);

  // Teclado atalhos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (studyQueue.length === 0 || currentIndex >= studyQueue.length) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === "1" && isFlipped) {
        submitReview(1);
      } else if (e.key === "2" && isFlipped) {
        submitReview(2);
      } else if (e.key === "3" && isFlipped) {
        submitReview(3);
      } else if (e.key === "4" && isFlipped) {
        submitReview(4);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [studyQueue, currentIndex, isFlipped]);

  const activeCard = studyQueue[currentIndex];
  const activeNote = activeCard ? notes.find(n => n.noteId === activeCard.noteId) : null;

  const submitReview = async (rating: number) => {
    if (!activeCard) return;

    // Calcular próximo estado FSRS usando utilitário compartilhado
    const nextFSRS = calculateNextFSRSState(rating, activeCard);
    
    // Obter as credenciais da API/Amplify
    const apiMode = localStorage.getItem("ultra_api_mode") || "mock";
    const apiUrl = localStorage.getItem("ultra_api_url") || "";
    const userId = localStorage.getItem("ultra_user_id") || "usr_dev_default";

    const ratingNames = ["Again", "Hard", "Good", "Easy"];
    showToast(`Cartão classificado: ${ratingNames[rating - 1]}`, "info");

    const updatedFields: Partial<Card> = {
      stability: nextFSRS.stability,
      difficulty: nextFSRS.difficulty,
      state: nextFSRS.state as any,
      dueDate: nextFSRS.dueDate,
      scheduledDays: nextFSRS.scheduledDays,
      lastReviewDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (apiMode === "aws" && apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/study/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer SIMULATED_TOKEN",
            "X-User-Id": userId
          },
          body: JSON.stringify({
            card_id: activeCard.cardId,
            rating: rating,
            review_time_ms: 1000
          })
        });

        if (!response.ok) throw new Error();
        const result = await response.json();
        
        // Sincronizar com retorno da API AWS
        onReviewCard(activeCard.cardId, {
          stability: result.stability,
          difficulty: result.difficulty,
          state: result.state,
          dueDate: result.next_review,
          scheduledDays: result.interval_days,
          lastReviewDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        showToast("Erro ao sincronizar com AWS. Salvando localmente.", "error");
        onReviewCard(activeCard.cardId, updatedFields);
        saveCardLocally(activeCard.cardId, updatedFields);
      }
    } else {
      onReviewCard(activeCard.cardId, updatedFields);
      saveCardLocally(activeCard.cardId, updatedFields);
    }

    setIsFlipped(false);
    
    // Prosseguir para o próximo cartão
    if (currentIndex + 1 >= studyQueue.length) {
      showToast("Sessão finalizada com sucesso!", "success");
      onFinished();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const saveCardLocally = (cardId: string, updatedFields: Partial<Card>) => {
    const localCardsStr = localStorage.getItem("ultra_cards");
    if (localCardsStr) {
      const localCards: Card[] = JSON.parse(localCardsStr);
      const idx = localCards.findIndex(c => c.cardId === cardId);
      if (idx !== -1) {
        localCards[idx] = { ...localCards[idx], ...updatedFields };
        localStorage.setItem("ultra_cards", JSON.stringify(localCards));
      }
    }
  };

  const speakText = (side: "front" | "back") => {
    if (!('speechSynthesis' in window) || !activeNote) return;
    
    let text = side === "front" ? (activeNote.fields.Front || "") : (activeNote.fields.Back || "");
    text = text.replace(/<\/?[^>]+(>|$)/g, ""); // limpar marcações HTML do Cloze

    const utterance = new SpeechSynthesisUtterance(text);
    if (activeNote.tags?.includes("ingles") || activeCard.deckId.includes("ingles")) {
      utterance.lang = "en-US";
    } else {
      utterance.lang = "pt-BR";
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Renderizar o conteúdo
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-bg-card border border-border-color rounded-2xl max-w-2xl mx-auto text-center gap-6 mt-8">
        <span className="material-symbols-outlined text-6xl text-accent-blue animate-spin">autorenew</span>
        <h2 className="text-xl font-bold">Carregando fila de estudos...</h2>
      </div>
    );
  }

  // Renderizar o conteúdo
  if (studyQueue.length === 0 || currentIndex >= studyQueue.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-bg-card border border-border-color rounded-2xl max-w-2xl mx-auto text-center gap-6 mt-8">
        <span className="material-symbols-outlined text-6xl text-color-easy">check_circle</span>
        <h2 className="text-xl font-bold">🎉 Nenhuma revisão agendada!</h2>
        <p className="text-text-secondary text-sm">
          Você limpou sua fila de cartões do dia ou o baralho selecionado está em dia. Volte mais tarde!
        </p>
        <button onClick={onFinished} className="bg-accent-blue hover:bg-accent-blue/80 text-white font-bold px-6 py-2.5 rounded-full cursor-pointer transition-all duration-300">
          Voltar para Biblioteca
        </button>
      </div>
    );
  }

  // Obter texto formatado de acordo com NoteType (Cloze, Reverso)
  let frontContent = activeNote?.fields?.Front || "";
  let backContent = activeNote?.fields?.Back || "";

  if (activeNote?.noteType === "CLOZE") {
    const clozeOrdinal = activeCard.cardOrdinal;
    const clozeRegex = new RegExp(`\\{\\{c${clozeOrdinal + 1}::(.*?)\\}\\}`, "g");
    frontContent = frontContent.replace(clozeRegex, `<span class="cloze-obscured">[...]</span>`);
    frontContent = frontContent.replace(/\{\{c\d+::(.*?)\}\}/g, "$1");

    backContent = activeNote.fields.Front.replace(clozeRegex, `<span class="cloze-revealed">$1</span>`);
    backContent = backContent.replace(/\{\{c\d+::(.*?)\}\}/g, "$1");
  } else if (activeNote?.noteType === "BASIC_REVERSED" && activeCard.cardOrdinal === 1) {
    const temp = frontContent;
    frontContent = backContent;
    backContent = temp;
  }

  const fillPct = (currentIndex / studyQueue.length) * 100;

  // Intervalos estimados de FSRS para exibir nos botões
  const nextAgain = calculateNextFSRSState(1, activeCard);
  const nextHard = calculateNextFSRSState(2, activeCard);
  const nextGood = calculateNextFSRSState(3, activeCard);
  const nextEasy = calculateNextFSRSState(4, activeCard);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Progresso */}
      <div className="flex justify-between items-center bg-bg-card border border-border-color rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-text-primary">Estudando: {activeCard.deckId}</h2>
          <span className="text-[10px] font-semibold text-accent-yellow bg-accent-yellow/8 border border-accent-yellow/20 px-2 py-0.5 rounded-full uppercase">
            {activeCard.state}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 w-[200px]">
          <div className="w-full h-1.5 bg-bg-app rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-blue to-color-easy transition-all duration-300" style={{ width: `${fillPct}%` }}></div>
          </div>
          <span className="text-[11px] font-bold text-text-secondary">
            {currentIndex + 1} de {studyQueue.length} cartões
          </span>
        </div>
      </div>

      {/* 3D Flashcard Container */}
      <div className="perspective-1000 w-full h-[360px] cursor-pointer mt-4">
        <div 
          onClick={() => setIsFlipped(prev => !prev)}
          className={`relative w-full h-full transform-preserve-3d transition-transform duration-500 ${isFlipped ? "rotate-y-180" : ""}`}
        >
          {/* Frente */}
          <div className="absolute inset-0 backface-hidden rounded-2xl bg-bg-card border-2 border-border-color p-8 flex flex-col justify-between shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-widest text-text-disabled uppercase">FRENTE</span>
              <span 
                onClick={(e) => { e.stopPropagation(); speakText("front"); }}
                className="material-symbols-outlined text-text-secondary hover:text-text-primary hover:bg-white/5 p-2 rounded-full cursor-pointer transition-all"
              >
                volume_up
              </span>
            </div>
            <div 
              className="text-2xl font-bold text-center leading-relaxed flex items-center justify-center flex-1 px-4 word-break"
              dangerouslySetInnerHTML={{ __html: frontContent }}
            />
            <div className="text-xs text-text-disabled text-center">
              Clique no cartão ou aperte [Espaço] para revelar a resposta
            </div>
          </div>

          {/* Verso */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-[#17153a] border-2 border-accent-blue/30 p-8 flex flex-col justify-between shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-widest text-accent-blue/60 uppercase">VERSO</span>
              <span 
                onClick={(e) => { e.stopPropagation(); speakText("back"); }}
                className="material-symbols-outlined text-text-secondary hover:text-text-primary hover:bg-white/5 p-2 rounded-full cursor-pointer transition-all"
              >
                volume_up
              </span>
            </div>
            <div 
              className="text-2xl font-bold text-center leading-relaxed flex items-center justify-center flex-1 px-4 word-break"
              dangerouslySetInnerHTML={{ __html: backContent }}
            />
            <div className="flex justify-center gap-5 text-[11px] text-text-secondary border-t border-white/5 pt-3 mt-3">
              <span><strong>Estabilidade:</strong> {activeCard.stability.toFixed(2)}d</span>
              <span><strong>Dificuldade:</strong> {activeCard.difficulty.toFixed(2)}</span>
              <span><strong>Próximo agendamento:</strong> {activeCard.scheduledDays}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ações / Respostas */}
      <div className="h-20 flex justify-center items-center mt-4">
        {!isFlipped ? (
          <button 
            onClick={() => setIsFlipped(true)}
            className="w-full bg-accent-blue hover:bg-accent-blue/90 text-white font-bold p-4 rounded-xl cursor-pointer flex items-center justify-center gap-3 shadow-lg shadow-accent-blue/20 transition-all duration-300"
          >
            <span>Revelar Resposta</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-extrabold uppercase">Espaço</span>
          </button>
        ) : (
          <div className="flex gap-2 sm:gap-3 w-full">
            <button 
              onClick={() => submitReview(1)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 p-2 sm:p-3 rounded-xl border border-again/30 bg-again/10 text-again hover:bg-again hover:text-white hover:shadow-lg hover:shadow-again/30 cursor-pointer relative transition-all duration-300 group"
            >
              <span className="text-xs sm:text-[13px] font-bold">Again</span>
              <span className="text-[10px] sm:text-[11px] opacity-80">{nextAgain.scheduledDays}d</span>
              <span className="absolute top-1 right-1.5 text-[8px] sm:text-[9px] opacity-60 bg-white/10 group-hover:bg-black/10 px-1 rounded sm:inline hidden">1</span>
            </button>
            <button 
              onClick={() => submitReview(2)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 p-2 sm:p-3 rounded-xl border border-hard/30 bg-hard/10 text-hard hover:bg-hard hover:text-white hover:shadow-lg hover:shadow-hard/30 cursor-pointer relative transition-all duration-300 group"
            >
              <span className="text-xs sm:text-[13px] font-bold">Hard</span>
              <span className="text-[10px] sm:text-[11px] opacity-80">{nextHard.scheduledDays}d</span>
              <span className="absolute top-1 right-1.5 text-[8px] sm:text-[9px] opacity-60 bg-white/10 group-hover:bg-black/10 px-1 rounded sm:inline hidden">2</span>
            </button>
            <button 
              onClick={() => submitReview(3)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 p-2 sm:p-3 rounded-xl border border-good/30 bg-good/10 text-good hover:bg-good hover:text-white hover:shadow-lg hover:shadow-good/30 cursor-pointer relative transition-all duration-300 group"
            >
              <span className="text-xs sm:text-[13px] font-bold">Good</span>
              <span className="text-[10px] sm:text-[11px] opacity-80">{nextGood.scheduledDays}d</span>
              <span className="absolute top-1 right-1.5 text-[8px] sm:text-[9px] opacity-60 bg-white/10 group-hover:bg-black/10 px-1 rounded sm:inline hidden">3</span>
            </button>
            <button 
              onClick={() => submitReview(4)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 p-2 sm:p-3 rounded-xl border border-easy/30 bg-easy/10 text-easy hover:bg-easy hover:text-white hover:shadow-lg hover:shadow-easy/30 cursor-pointer relative transition-all duration-300 group"
            >
              <span className="text-xs sm:text-[13px] font-bold">Easy</span>
              <span className="text-[10px] sm:text-[11px] opacity-80">{nextEasy.scheduledDays}d</span>
              <span className="absolute top-1 right-1.5 text-[8px] sm:text-[9px] opacity-60 bg-white/10 group-hover:bg-black/10 px-1 rounded sm:inline hidden">4</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
