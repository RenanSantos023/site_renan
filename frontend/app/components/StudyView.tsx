'use client';

import React, { useState, useEffect } from "react";
import type { Note, Card } from "../../amplify/data/resource";
import { calculateNextFSRSState } from "../../utils/fsrsMath";
import { getAuthSessionToken } from "../amplify-client";

interface StudyViewProps {
  notes: Note[];
  cards: Card[];
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onReviewCard: (cardId: string, updatedData: Partial<Card>) => void;
  onFinished: () => void;
  singleCardId?: string;
  selectedDeckId?: string | null;
}

type StudyMode = "review" | "quiz" | "written" | "tutor";

export default function StudyView({
  notes,
  cards,
  showToast,
  onReviewCard,
  onFinished,
  singleCardId,
  selectedDeckId
}: StudyViewProps) {
  const [studyQueue, setStudyQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("review");

  // Estados dos Modos Especiais
  const [userWrittenAnswer, setUserWrittenAnswer] = useState<string>("");
  const [aiEvaluation, setAiEvaluation] = useState<{ score: number; feedback: string } | null>(null);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<boolean>(false);

  // Carregar fila de cartões
  useEffect(() => {
    const loadQueue = async () => {
      if (singleCardId) {
        const single = cards.find(c => c.cardId === singleCardId);
        if (single) setStudyQueue([single]);
        return;
      }

      let candidateCards = cards;
      if (selectedDeckId) {
        candidateCards = cards.filter(c => c.deckId?.toLowerCase() === selectedDeckId.toLowerCase());
      }

      const now = new Date();
      const due = candidateCards.filter(c => !c.dueDate || new Date(c.dueDate) <= now);
      setStudyQueue(due.length > 0 ? due : candidateCards.slice(0, 20));
    };

    loadQueue();
    setCurrentIndex(0);
    setIsFlipped(false);
    resetCardState();
  }, [cards, singleCardId, selectedDeckId]);

  const activeCard = studyQueue[currentIndex];
  const activeNote = activeCard ? notes.find(n => n.noteId === activeCard.noteId) : null;

  const resetCardState = () => {
    setIsFlipped(false);
    setUserWrittenAnswer("");
    setAiEvaluation(null);
    setQuizSelectedOption(null);
    setAiExplanation(null);
  };

  // Gerar opções de quiz quando mudar de card
  useEffect(() => {
    if (!activeNote) return;
    const correctAnswer = activeNote.fields?.Back || "Resposta correta";
    
    // Distratores a partir de outras notas
    const otherNotes = notes.filter(n => n.noteId !== activeNote.noteId && n.fields?.Back);
    const shuffledOthers = otherNotes.sort(() => 0.5 - Math.random()).slice(0, 3).map(n => n.fields.Back);
    
    const allOptions = [correctAnswer, ...shuffledOthers].sort(() => 0.5 - Math.random());
    setQuizOptions(allOptions);
  }, [currentIndex, activeNote, notes]);

  // Teclado atalhos para modo Review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (studyMode !== "review" || studyQueue.length === 0 || currentIndex >= studyQueue.length) return;

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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [studyQueue, currentIndex, isFlipped, studyMode]);

  const submitReview = async (rating: number) => {
    if (!activeCard) return;

    const nextFSRS = calculateNextFSRSState(rating, activeCard);
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
        const token = await getAuthSessionToken();
        const response = await fetch(`${apiUrl}/study/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "Bearer SIMULATED_TOKEN",
            "X-User-Id": userId
          },
          body: JSON.stringify({
            card_id: activeCard.cardId,
            rating: rating,
            review_time_ms: 1000
          })
        });

        if (response.ok) {
          const result = await response.json();
          onReviewCard(activeCard.cardId, {
            stability: result.stability,
            difficulty: result.difficulty,
            state: result.state,
            dueDate: result.next_review,
            scheduledDays: result.interval_days,
            lastReviewDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          onReviewCard(activeCard.cardId, updatedFields);
        }
      } catch {
        onReviewCard(activeCard.cardId, updatedFields);
      }
    } else {
      onReviewCard(activeCard.cardId, updatedFields);
    }

    advanceCard();
  };

  const advanceCard = () => {
    resetCardState();
    if (currentIndex + 1 >= studyQueue.length) {
      showToast("🎉 Sessão de estudos finalizada com sucesso!", "success");
      onFinished();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Avaliação de Resposta Escrita por IA
  const handleEvaluateWrittenAnswer = () => {
    if (!userWrittenAnswer.trim() || !activeNote) return;
    setAiActionLoading(true);

    setTimeout(() => {
      const target = (activeNote.fields?.Back || "").toLowerCase();
      const user = userWrittenAnswer.toLowerCase();
      const commonWords = user.split(" ").filter(w => w.length > 3 && target.includes(w));
      const score = Math.min(100, Math.max(30, Math.round((commonWords.length / Math.max(1, target.split(" ").length)) * 120)));

      setAiEvaluation({
        score,
        feedback: score >= 75
          ? "Excelente compreensão! Você capturou todos os elementos essenciais do conceito."
          : `Você entendeu parte da ideia, mas lembre-se de enfatizar: "${activeNote.fields?.Back}".`
      });
      setIsFlipped(true);
      setAiActionLoading(false);
    }, 1000);
  };

  // Ações de IA no Flashcard
  const handleAiAction = (actionType: "explain" | "example" | "harder" | "deeper") => {
    if (!activeNote) return;
    setAiActionLoading(true);

    const question = activeNote.fields?.Front || "";
    const answer = activeNote.fields?.Back || "";

    setTimeout(() => {
      let text = "";
      if (actionType === "explain") {
        text = `💡 **Explicação Simplificada:** Pense em "${question}" como um mecanismo onde o objetivo principal é ${answer.toLowerCase()}. De forma intuitiva, sempre que esse processo ocorre, o sistema garante estabilidade e eficiência.`;
      } else if (actionType === "example") {
        text = `🧠 **Exemplo Prático:** Imagine um cenário no dia a dia ou em produção: ao lidar com este problema, a aplicação direta seria aplicar "${answer}" para evitar falhas de execução.`;
      } else if (actionType === "harder") {
        text = `🎯 **Desafio Avançado:** Como esse conceito (${answer}) se comportaria em cenários de alta concorrência ou em sistemas distribuídos de larga escala?`;
      } else if (actionType === "deeper") {
        text = `📚 **Aprofundamento Teórico:** Este comportamento é fundamentado nos princípios de otimização e modelos de persistência, onde ${answer} atua como pilar central.`;
      }
      setAiExplanation(text);
      setAiActionLoading(false);
    }, 800);
  };

  if (!activeCard || !activeNote) {
    return (
      <div className="bg-bg-card border border-border-color rounded-3xl p-12 text-center max-w-xl mx-auto flex flex-col items-center gap-4 animate-fade-in">
        <span className="material-symbols-outlined text-6xl text-easy">verified</span>
        <h2 className="text-xl font-bold text-text-primary">Nenhum cartão para estudar neste momento!</h2>
        <p className="text-xs text-text-secondary">
          Você revisou todos os cartões agendados pelo FSRS para hoje.
        </p>
        <button
          onClick={onFinished}
          className="bg-accent-purple text-white font-bold text-xs px-6 py-3 rounded-xl cursor-pointer"
        >
          Voltar à Biblioteca
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      
      {/* TOP CONTROLS & MODES */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-border-color pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onFinished}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Sair</span>
          </button>
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-border-color">
            Deck: {activeCard.deckId}
          </span>
        </div>

        {/* MUDANÇA DE MODO DE ESTUDO */}
        <div className="bg-bg-card border border-border-color p-1 rounded-2xl flex items-center gap-1">
          <button
            onClick={() => { setStudyMode("review"); resetCardState(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${studyMode === "review" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">style</span>
            <span>Review FSRS</span>
          </button>
          <button
            onClick={() => { setStudyMode("quiz"); resetCardState(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${studyMode === "quiz" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">quiz</span>
            <span>Quiz</span>
          </button>
          <button
            onClick={() => { setStudyMode("written"); resetCardState(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${studyMode === "written" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
            <span>Escrita + IA</span>
          </button>
          <button
            onClick={() => { setStudyMode("tutor"); resetCardState(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${studyMode === "tutor" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">psychology</span>
            <span>AI Tutor</span>
          </button>
        </div>

        {/* PROGRESSO */}
        <span className="text-xs font-bold text-text-secondary">
          Card {currentIndex + 1} de {studyQueue.length}
        </span>
      </div>

      {/* 1. MODO: REVIEW FSRS PADRÃO */}
      {studyMode === "review" && (
        <div className="flex flex-col gap-6">
          <div
            onClick={() => setIsFlipped(prev => !prev)}
            className="bg-bg-card border border-border-color hover:border-accent-purple/50 rounded-3xl p-8 md:p-12 min-h-[320px] flex flex-col justify-between shadow-2xl cursor-pointer transition-all duration-300 relative group"
          >
            <div className="flex justify-between items-center text-xs text-text-disabled uppercase font-bold tracking-widest">
              <span>{isFlipped ? "Verso / Resposta" : "Frente / Pergunta"}</span>
              <span className="text-accent-purple group-hover:scale-110 transition-transform">
                {isFlipped ? "clique para virar" : "clique para revelar"}
              </span>
            </div>

            <div className="my-8 text-center flex flex-col items-center justify-center">
              <span className="text-xl md:text-2xl font-bold text-text-primary leading-relaxed max-w-xl">
                {isFlipped ? activeNote.fields?.Back : activeNote.fields?.Front}
              </span>
            </div>

            <div className="text-center text-xs text-text-disabled">
              Atalho: Pressione <kbd className="bg-white/10 px-2 py-0.5 rounded text-text-primary">Espaço</kbd> para virar
            </div>
          </div>

          {/* BOTÕES FSRS CLASSIFICAÇÃO */}
          {isFlipped && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="text-center text-xs text-text-secondary font-bold">
                Como foi lembrar desta resposta?
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => submitReview(1)}
                  className="bg-again/15 hover:bg-again text-again hover:text-white border border-again/40 font-black py-4 px-3 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-again/20"
                >
                  <span className="text-sm">Again</span>
                  <span className="text-[10px] opacity-75">&lt; 10 min (1)</span>
                </button>

                <button
                  onClick={() => submitReview(2)}
                  className="bg-hard/15 hover:bg-hard text-hard hover:text-white border border-hard/40 font-black py-4 px-3 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-hard/20"
                >
                  <span className="text-sm">Hard</span>
                  <span className="text-[10px] opacity-75">1-2 dias (2)</span>
                </button>

                <button
                  onClick={() => submitReview(3)}
                  className="bg-good/15 hover:bg-good text-good hover:text-white border border-good/40 font-black py-4 px-3 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-good/20"
                >
                  <span className="text-sm">Good</span>
                  <span className="text-[10px] opacity-75">3-4 dias (3)</span>
                </button>

                <button
                  onClick={() => submitReview(4)}
                  className="bg-easy/15 hover:bg-easy text-easy hover:text-white border border-easy/40 font-black py-4 px-3 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-easy/20"
                >
                  <span className="text-sm">Easy</span>
                  <span className="text-[10px] opacity-75">7+ dias (4)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. MODO: QUIZ MODE */}
      {studyMode === "quiz" && (
        <div className="bg-bg-card border border-border-color rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">
          <div className="text-xs font-bold text-accent-purple uppercase tracking-wider">
            Modo Quiz Interativo
          </div>

          <h2 className="text-lg md:text-xl font-bold text-text-primary">
            {activeNote.fields?.Front}
          </h2>

          <div className="flex flex-col gap-3 my-2">
            {quizOptions.map((opt, idx) => {
              const isCorrect = opt === activeNote.fields?.Back;
              const isSelected = quizSelectedOption === idx;
              let btnStyle = "bg-bg-input border-border-color text-text-primary hover:border-accent-purple";
              
              if (quizSelectedOption !== null) {
                if (isCorrect) btnStyle = "bg-easy/20 border-easy text-easy font-bold";
                else if (isSelected) btnStyle = "bg-again/20 border-again text-again";
                else btnStyle = "bg-bg-input/40 border-border-color/40 text-text-disabled";
              }

              return (
                <button
                  key={idx}
                  disabled={quizSelectedOption !== null}
                  onClick={() => {
                    setQuizSelectedOption(idx);
                    if (isCorrect) showToast("Resposta correta! +10 pts", "success");
                    else showToast("Incorreto. Veja a resposta correta acima.", "error");
                  }}
                  className={`w-full p-4 rounded-2xl border text-left text-sm flex items-center justify-between transition-all duration-200 cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <span>{opt}</span>
                  {quizSelectedOption !== null && isCorrect && (
                    <span className="material-symbols-outlined text-easy">check_circle</span>
                  )}
                  {quizSelectedOption !== null && isSelected && !isCorrect && (
                    <span className="material-symbols-outlined text-again">cancel</span>
                  )}
                </button>
              );
            })}
          </div>

          {quizSelectedOption !== null && (
            <button
              onClick={advanceCard}
              className="bg-accent-purple hover:bg-accent-purple/90 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 mt-2"
            >
              <span>Próxima Pergunta</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          )}
        </div>
      )}

      {/* 3. MODO: WRITTEN ANSWER + AVALIAÇÃO DE IA */}
      {studyMode === "written" && (
        <div className="bg-bg-card border border-border-color rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">
          <div className="text-xs font-bold text-accent-purple uppercase tracking-wider">
            Escrita Livre & Avaliação por IA
          </div>

          <h2 className="text-lg md:text-xl font-bold text-text-primary">
            {activeNote.fields?.Front}
          </h2>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-text-secondary font-semibold">Sua Resposta:</label>
            <textarea
              value={userWrittenAnswer}
              onChange={(e) => setUserWrittenAnswer(e.target.value)}
              placeholder="Digite sua explicação detalhada com suas próprias palavras..."
              rows={4}
              className="w-full bg-bg-input border border-border-color text-text-primary text-sm p-4 rounded-2xl outline-none focus:border-accent-purple transition-all duration-200"
            />
          </div>

          {!aiEvaluation ? (
            <button
              onClick={handleEvaluateWrittenAnswer}
              disabled={!userWrittenAnswer.trim() || aiActionLoading}
              className="bg-gradient-to-r from-accent-purple to-purple-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {aiActionLoading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  <span>Avaliar com IA</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="bg-bg-input p-5 rounded-2xl border border-border-color flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Pontuação de Precisão</span>
                  <span className={`text-lg font-black ${aiEvaluation.score >= 70 ? "text-easy" : "text-hard"}`}>
                    {aiEvaluation.score}%
                  </span>
                </div>
                <p className="text-xs text-text-primary leading-relaxed">{aiEvaluation.feedback}</p>
                <div className="text-xs text-text-secondary pt-2 mt-2 border-t border-border-color/60">
                  <strong className="text-text-primary">Gabarito Ideal:</strong> {activeNote.fields?.Back}
                </div>
              </div>

              <button
                onClick={advanceCard}
                className="bg-accent-purple text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Avançar para o Próximo</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. MODO: GUIDED STUDY (AI TUTOR SOCRÁTICO) */}
      {studyMode === "tutor" && (
        <div className="bg-bg-card border border-accent-purple/40 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 text-accent-purple">
            <span className="material-symbols-outlined text-2xl">psychology</span>
            <span className="text-xs font-black uppercase tracking-wider">AI Tutor Socrático</span>
          </div>

          <div className="bg-bg-input/80 p-5 rounded-2xl border border-border-color flex flex-col gap-3">
            <span className="text-xs font-bold text-accent-purple">Tutor:</span>
            <p className="text-sm text-text-primary leading-relaxed">
              "Vamos explorar juntos: sobre <strong>{activeNote.fields?.Front}</strong>, qual é o principal impacto desse conceito e por que ele é tão crucial?"
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAiAction("explain")}
              className="bg-white/5 hover:bg-white/10 text-text-primary text-xs font-bold p-3.5 rounded-xl border border-border-color text-left flex items-center justify-between cursor-pointer"
            >
              <span>Me explique o conceito do zero com uma metáfora simples</span>
              <span className="material-symbols-outlined text-sm text-accent-purple">lightbulb</span>
            </button>
            <button
              onClick={() => handleAiAction("example")}
              className="bg-white/5 hover:bg-white/10 text-text-primary text-xs font-bold p-3.5 rounded-xl border border-border-color text-left flex items-center justify-between cursor-pointer"
            >
              <span>Dê um exemplo prático de aplicação no mundo real</span>
              <span className="material-symbols-outlined text-sm text-accent-purple">code</span>
            </button>
          </div>

          <button
            onClick={advanceCard}
            className="bg-accent-purple text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>Próximo Tópico com o Tutor</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      )}

      {/* AÇÕES RÁPIDAS DE IA NO VERSO */}
      {isFlipped && (
        <div className="bg-bg-card border border-border-color p-5 rounded-2xl flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-accent-purple uppercase tracking-wider">
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>Ações Inteligentes de IA</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAiAction("explain")}
              className="bg-white/5 hover:bg-accent-purple/20 hover:text-text-primary text-text-secondary text-xs px-3.5 py-2 rounded-xl border border-border-color cursor-pointer transition-colors"
            >
              ✨ Explicar de outra forma
            </button>
            <button
              onClick={() => handleAiAction("example")}
              className="bg-white/5 hover:bg-accent-purple/20 hover:text-text-primary text-text-secondary text-xs px-3.5 py-2 rounded-xl border border-border-color cursor-pointer transition-colors"
            >
              🧠 Dar um exemplo prático
            </button>
            <button
              onClick={() => handleAiAction("harder")}
              className="bg-white/5 hover:bg-accent-purple/20 hover:text-text-primary text-text-secondary text-xs px-3.5 py-2 rounded-xl border border-border-color cursor-pointer transition-colors"
            >
              🎯 Desafio mais difícil
            </button>
            <button
              onClick={() => handleAiAction("deeper")}
              className="bg-white/5 hover:bg-accent-purple/20 hover:text-text-primary text-text-secondary text-xs px-3.5 py-2 rounded-xl border border-border-color cursor-pointer transition-colors"
            >
              📚 Aprofundar teoria
            </button>
          </div>

          {aiActionLoading && (
            <div className="flex items-center gap-2 text-xs text-accent-purple py-2 animate-pulse">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              <span>A IA está processando sua solicitação...</span>
            </div>
          )}

          {aiExplanation && !aiActionLoading && (
            <div className="bg-bg-input p-4 rounded-xl border border-accent-purple/30 text-xs text-text-primary leading-relaxed mt-2 animate-fade-in">
              {aiExplanation}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
