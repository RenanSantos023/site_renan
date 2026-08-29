'use client';

import React, { useState } from "react";
import type { Note, Card } from "../../amplify/data/resource";

interface HomeViewProps {
  notes: Note[];
  cards: Card[];
  onStartStudy: (deckId?: string) => void;
  onNavigateTab: (tab: string) => void;
  onQuickStartPrompt: (promptText: string) => void;
  userName?: string;
}

export default function HomeView({
  notes,
  cards,
  onStartStudy,
  onNavigateTab,
  onQuickStartPrompt,
  userName = "Estudante"
}: HomeViewProps) {
  const [quickPrompt, setQuickPrompt] = useState<string>("");

  // Cálculo de cards devidos hoje
  const now = new Date();
  const dueCards = cards.filter(c => !c.dueDate || new Date(c.dueDate) <= now);
  const newCards = cards.filter(c => c.state === "NEW");
  const reviewCards = cards.filter(c => c.state === "REVIEW");
  const masteredCards = cards.filter(c => (c.stability || 0) > 15 || (c.state === "REVIEW" && (c.scheduledDays || 0) > 21));

  const totalCards = cards.length || 1;
  const masteryPercent = Math.min(100, Math.round((masteredCards.length / totalCards) * 100));
  const estimatedTimeMin = Math.max(2, Math.round(dueCards.length * 0.45));

  // Agrupamento por Deck para "Continue Learning"
  const decksMap = new Map<string, { noteCount: number; cardCount: number; dueCount: number; masteredCount: number }>();
  notes.forEach(note => {
    const d = note.deckId || "geral";
    const current = decksMap.get(d) || { noteCount: 0, cardCount: 0, dueCount: 0, masteredCount: 0 };
    current.noteCount += 1;
    decksMap.set(d, current);
  });

  cards.forEach(card => {
    const d = card.deckId || "geral";
    const current = decksMap.get(d) || { noteCount: 0, cardCount: 0, dueCount: 0, masteredCount: 0 };
    current.cardCount += 1;
    if (!card.dueDate || new Date(card.dueDate) <= now) current.dueCount += 1;
    if ((card.stability || 0) > 15) current.masteredCount += 1;
    decksMap.set(d, current);
  });

  const deckEntries = Array.from(decksMap.entries()).map(([deckId, stats]) => ({
    deckId,
    ...stats,
    masteryPercent: stats.cardCount > 0 ? Math.round((stats.masteredCount / stats.cardCount) * 100) : 0
  }));

  const deckIcons: Record<string, string> = {
    vocabulario: "translate",
    ingles: "language",
    enem: "school",
    databricks: "database",
    python: "terminal",
    biologia: "biotech",
    default: "folder"
  };

  const getDeckIcon = (deckId: string) => {
    const lower = deckId.toLowerCase();
    for (const key of Object.keys(deckIcons)) {
      if (lower.includes(key)) return deckIcons[key];
    }
    return deckIcons.default;
  };

  const handleQuickStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    onQuickStartPrompt(quickPrompt.trim());
    setQuickPrompt("");
  };

  const quickPromptSuggestions = [
    "Preparar para certificação AWS Cloud Practitioner",
    "Aprender vocabulário avançado de Inglês para negócios",
    "Conceitos fundamentais de Python e Estruturas de Dados",
    "Biologia Celular e Citologia para o ENEM"
  ];

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* 1. GREETING & STREAK HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-bg-card via-bg-card to-accent-purple/10 border border-border-color p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col gap-1 z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
              Olá, {userName}!
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Pronto para impulsionar sua retenção de memória hoje?
          </p>
        </div>

        <div className="flex items-center gap-3 bg-bg-input/80 border border-border-color px-5 py-3 rounded-2xl self-start md:self-auto z-10 shadow-inner">
          <span className="text-2xl animate-bounce">🔥</span>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">Sequência Ativa</span>
            <span className="text-base font-black text-text-primary">12 Dias Consecutivos</span>
          </div>
        </div>
      </div>

      {/* 2. CORE DUO: STUDY TODAY & PROGRESS OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CARD PRINCIPAL: STUDY TODAY */}
        <div className="lg:col-span-7 bg-gradient-to-br from-bg-card to-accent-blue/10 border border-border-color hover:border-accent-blue/50 p-8 rounded-3xl flex flex-col justify-between shadow-xl transition-all duration-300 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent-blue/15 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest text-accent-blue flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                Estudo de Hoje (FSRS Engine)
              </span>
              <span className="text-xs text-text-secondary bg-white/5 px-3 py-1 rounded-full border border-border-color">
                Meta Diária: 50 cards
              </span>
            </div>

            <div className="flex items-baseline gap-3 my-2">
              <span className="text-5xl font-black text-text-primary tracking-tight">{dueCards.length}</span>
              <span className="text-lg font-bold text-text-secondary">cards para revisar</span>
            </div>

            <p className="text-xs text-text-secondary flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-sm text-accent-yellow">schedule</span>
              Tempo estimado de sessão: ~{estimatedTimeMin} minutos
            </p>

            <div className="grid grid-cols-3 gap-3 my-6 pt-4 border-t border-border-color/60">
              <div className="bg-bg-input/60 p-3 rounded-xl">
                <span className="text-[11px] text-text-secondary block">Novos</span>
                <span className="text-lg font-bold text-accent-blue">{newCards.length}</span>
              </div>
              <div className="bg-bg-input/60 p-3 rounded-xl">
                <span className="text-[11px] text-text-secondary block">Revisão</span>
                <span className="text-lg font-bold text-accent-yellow">{reviewCards.length}</span>
              </div>
              <div className="bg-bg-input/60 p-3 rounded-xl">
                <span className="text-[11px] text-text-secondary block">Dominados</span>
                <span className="text-lg font-bold text-easy">{masteredCards.length}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onStartStudy()}
            disabled={dueCards.length === 0}
            className="w-full bg-gradient-to-r from-accent-blue via-purple-600 to-accent-purple hover:opacity-95 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-base shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 cursor-pointer disabled:opacity-50 transition-all duration-300"
          >
            <span className="material-symbols-outlined text-2xl">play_circle</span>
            <span>{dueCards.length > 0 ? "Iniciar Sessão de Estudos" : "Tudo em dia por hoje!"}</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>

        {/* PROGRESS OVERVIEW */}
        <div className="lg:col-span-5 bg-bg-card border border-border-color p-8 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest text-accent-purple">
                Seu Domínio Global
              </span>
              <span className="text-xs font-bold text-easy flex items-center gap-1 bg-easy/10 px-2.5 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                +8% esta semana
              </span>
            </div>

            <div className="my-3">
              <span className="text-4xl font-black text-text-primary">{masteryPercent}%</span>
              <span className="text-xs text-text-secondary block mt-1">Taxa média de fixação na memória de longo prazo</span>
            </div>

            {/* Barra de Progresso Customizada */}
            <div className="w-full bg-bg-input h-3.5 rounded-full overflow-hidden my-4 border border-border-color">
              <div
                className="bg-gradient-to-r from-accent-blue via-accent-purple to-easy h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.max(5, masteryPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-text-secondary mt-6 pt-4 border-t border-border-color/60">
              <div className="flex flex-col">
                <span className="font-bold text-text-primary text-sm">{totalCards}</span>
                <span>Cartões no Acervo</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-bold text-easy text-sm">{masteredCards.length}</span>
                <span>Fixados na Memória</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("analytics")}
            className="w-full mt-6 bg-white/5 hover:bg-white/10 text-text-primary text-xs font-bold py-3 px-4 rounded-xl border border-border-color flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
          >
            <span className="material-symbols-outlined text-base">monitoring</span>
            <span>Ver Métricas Detalhadas</span>
          </button>
        </div>

      </div>

      {/* 3. CONTINUE LEARNING (DECKS ATIVOS) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-purple text-xl">history_edu</span>
            <h2 className="text-lg font-black text-text-primary tracking-tight">Continuar Estudando</h2>
          </div>
          <button
            onClick={() => onNavigateTab("decks")}
            className="text-xs text-accent-blue hover:underline font-bold cursor-pointer flex items-center gap-1"
          >
            <span>Ver todos os baralhos</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {deckEntries.slice(0, 3).map((deck) => (
            <div
              key={deck.deckId}
              className="bg-bg-card border border-border-color hover:border-accent-purple/50 p-5 rounded-2xl flex flex-col justify-between gap-4 shadow-lg hover:shadow-accent-purple/10 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-purple/15 text-accent-purple flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">{getDeckIcon(deck.deckId)}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary capitalize truncate max-w-[140px]">{deck.deckId}</h3>
                    <span className="text-xs text-text-secondary">{deck.cardCount} flashcards</span>
                  </div>
                </div>
                {deck.dueCount > 0 && (
                  <span className="text-[10px] font-black bg-again text-white px-2 py-0.5 rounded-full">
                    {deck.dueCount} devidos
                  </span>
                )}
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-text-secondary mb-1">
                  <span>Domínio</span>
                  <span className="font-bold text-text-primary">{deck.masteryPercent}%</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-accent-blue to-accent-purple h-full rounded-full"
                    style={{ width: `${Math.max(4, deck.masteryPercent)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => onStartStudy(deck.deckId)}
                className="w-full bg-white/5 hover:bg-accent-purple hover:text-white text-text-primary text-xs font-bold py-2.5 rounded-xl border border-border-color group-hover:border-transparent flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <span>Praticar Baralho</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. AI QUICK START (HUB EXPRESSO) */}
      <div className="bg-gradient-to-br from-bg-card via-bg-card to-purple-950/40 border border-accent-purple/30 p-8 rounded-3xl shadow-xl flex flex-col gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-accent-purple">
            <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
            <h2 className="text-lg font-black text-text-primary tracking-tight">AI Quick Start</h2>
          </div>
          <p className="text-xs text-text-secondary">
            O que você deseja aprender hoje? Digite o tema ou objetivo e a IA criará o plano e os flashcards para você.
          </p>
        </div>

        <form onSubmit={handleQuickStartSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Ex: Me prepare para uma entrevista de Engenheiro de Dados com Python e SQL..."
              className="w-full bg-bg-input/90 border border-border-color text-text-primary text-sm px-5 py-4 rounded-2xl outline-none focus:border-accent-purple focus:bg-bg-input transition-all duration-200 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={!quickPrompt.trim()}
            className="bg-gradient-to-r from-accent-purple to-purple-700 hover:opacity-95 text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/30 cursor-pointer disabled:opacity-40 transition-all duration-300 shrink-0"
          >
            <span className="material-symbols-outlined text-lg">bolt</span>
            <span>Gerar com IA</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Sugestões Rápidas:</span>
          {quickPromptSuggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onQuickStartPrompt(sug)}
              className="bg-white/5 hover:bg-accent-purple/20 hover:text-text-primary text-text-secondary text-xs px-3.5 py-1.5 rounded-full border border-border-color cursor-pointer transition-all duration-200 text-left"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* 5. RECOMMENDED FOR YOU (IA ADAPTATIVA) */}
      <div className="bg-bg-card border border-border-color p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-again/15 text-again flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">priority_high</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-again uppercase tracking-wider">Reforço Recomendado pela IA</span>
            <h3 className="text-sm font-bold text-text-primary mt-0.5">
              Identificamos menor retenção em cartões de conceitos fundamentais
            </h3>
            <p className="text-xs text-text-secondary">
              Pratique uma sessão relâmpago focada nos cartões com maior taxa de erro nos últimos dias.
            </p>
          </div>
        </div>

        <button
          onClick={() => onStartStudy()}
          className="bg-accent-blue/15 hover:bg-accent-blue text-accent-blue hover:text-white border border-accent-blue/40 font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">psychology</span>
          <span>Praticar Pontos Fracos</span>
        </button>
      </div>

    </div>
  );
}
