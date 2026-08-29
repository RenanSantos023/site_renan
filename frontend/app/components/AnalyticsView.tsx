'use client';

import React from "react";
import type { Note, Card } from "../../amplify/data/resource";

interface AnalyticsViewProps {
  notes: Note[];
  cards: Card[];
  onStartRecommendedStudy: () => void;
}

export default function AnalyticsView({
  notes,
  cards,
  onStartRecommendedStudy
}: AnalyticsViewProps) {
  const totalCards = cards.length || 1;
  const masteredCards = cards.filter(c => (c.stability || 0) > 15 || (c.state === "REVIEW" && (c.scheduledDays || 0) > 21));
  const learningCards = cards.filter(c => c.state === "LEARNING" || ((c.stability || 0) <= 15 && (c.stability || 0) > 2));
  const newCards = cards.filter(c => c.state === "NEW");
  const difficultCards = cards.filter(c => (c.difficulty || 0) > 7);

  const masteryPercent = Math.min(100, Math.round((masteredCards.length / totalCards) * 100));

  const weakTopics = [
    { topic: "SQL Advanced JOINs & Subqueries", accuracy: 42, deck: "databricks" },
    { topic: "Python Decorators & Generators", accuracy: 48, deck: "python" },
    { topic: "Membrana Plasmática & Osmose", accuracy: 55, deck: "enem" },
    { topic: "Vocabulário Avançado de Negócios", accuracy: 68, deck: "vocabulario" },
    { topic: "Medallion Architecture (Bronze/Silver/Gold)", accuracy: 88, deck: "databricks" },
    { topic: "Mitocôndria e Respiração Celular", accuracy: 94, deck: "enem" }
  ];

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
            Analytics & Retenção de Memória
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Acompanhe sua curva de retenção de longo prazo e evolução real do aprendizado.
          </p>
        </div>

        <button
          onClick={onStartRecommendedStudy}
          className="bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer transition-all duration-200 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          <span>Estudar Tópicos Recomendados</span>
        </button>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Domínio Global</span>
          <div className="my-2">
            <span className="text-3xl md:text-4xl font-black text-easy">{masteryPercent}%</span>
            <span className="text-[11px] text-text-secondary block mt-1">+8% esta semana</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-easy h-full rounded-full" style={{ width: `${Math.max(5, masteryPercent)}%` }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total de Flashcards</span>
          <div className="my-2">
            <span className="text-3xl md:text-4xl font-black text-accent-blue">{cards.length}</span>
            <span className="text-[11px] text-text-secondary block mt-1">{notes.length} notas no acervo</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-accent-blue h-full rounded-full" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tempo Total</span>
          <div className="my-2">
            <span className="text-3xl md:text-4xl font-black text-accent-yellow">24h 32m</span>
            <span className="text-[11px] text-text-secondary block mt-1">~18 min/dia média</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-accent-yellow h-full rounded-full" style={{ width: "75%" }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Sequência Diária</span>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-orange-400">🔥 12</span>
            <span className="text-sm font-bold text-text-secondary">dias</span>
          </div>
          <span className="text-[11px] text-text-secondary">Recorde pessoal: 19 dias</span>
        </div>

      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEARNING CURVE PROGRESS GRAPH (SVG) */}
        <div className="lg:col-span-8 bg-bg-card border border-border-color p-8 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-text-primary">Curva de Evolução e Retenção FSRS</h3>
                <p className="text-xs text-text-secondary">Crescimento de estabilidade na memória de longo prazo</p>
              </div>
              <span className="text-xs bg-easy/10 text-easy font-bold px-3 py-1 rounded-full border border-easy/20">
                Retenção estimada: 91.4%
              </span>
            </div>

            {/* SVG Curva Suave */}
            <div className="w-full h-48 relative my-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gradientCurve" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0,130 Q 80,110 150,90 T 300,50 T 450,20 L 500,10 L 500,150 L 0,150 Z"
                  fill="url(#gradientCurve)"
                />
                <path
                  d="M 0,130 Q 80,110 150,90 T 300,50 T 450,20 L 500,10"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Pontos de Interseção */}
                <circle cx="150" cy="90" r="4" fill="#3f8cfb" />
                <circle cx="300" cy="50" r="4" fill="#ffcd1f" />
                <circle cx="450" cy="20" r="4" fill="#22c55e" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-xs text-text-disabled pt-2 border-t border-border-color/60 font-semibold">
              <span>Segunda</span>
              <span>Terça</span>
              <span>Quarta</span>
              <span>Quinta</span>
              <span>Sexta</span>
              <span>Sábado</span>
              <span>Hoje</span>
            </div>
          </div>
        </div>

        {/* PERFORMANCE BREAKDOWN */}
        <div className="lg:col-span-4 bg-bg-card border border-border-color p-8 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary mb-1">Taxa de Acertos</h3>
            <p className="text-xs text-text-secondary mb-6">Distribuição das respostas do FSRS</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl font-black text-easy">78%</div>
              <span className="text-xs text-text-secondary">Taxa média de recall na primeira tentativa</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-easy">Easy (Fácil)</span>
                  <span className="text-text-primary">42%</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-easy h-full rounded-full" style={{ width: "42%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-good">Good (Bom)</span>
                  <span className="text-text-primary">36%</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-good h-full rounded-full" style={{ width: "36%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-hard">Hard (Difícil)</span>
                  <span className="text-text-primary">14%</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-hard h-full rounded-full" style={{ width: "14%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-again">Again (Repetir)</span>
                  <span className="text-text-primary">8%</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-again h-full rounded-full" style={{ width: "8%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* WEAK TOPICS & REINFORCEMENT (O LOOP SE FECHA AQUI) */}
      <div className="bg-bg-card border border-border-color p-8 rounded-3xl shadow-xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-accent-purple text-xl">psychology_alt</span>
              <h3 className="text-lg font-bold text-text-primary">Tópicos e Lacunas de Conhecimento</h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Identificados automaticamente pelo FSRS para otimizar suas próximas sessões de estudo.
            </p>
          </div>

          <button
            onClick={onStartRecommendedStudy}
            className="bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-95 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-base">play_arrow</span>
            <span>Praticar Tópicos Fracos</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weakTopics.map((item, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${item.accuracy < 60 ? "bg-again/5 border-again/30" : "bg-bg-input/60 border-border-color"}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-text-primary leading-snug">
                  {item.topic}
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${item.accuracy < 60 ? "bg-again/20 text-again" : "bg-easy/20 text-easy"}`}>
                  {item.accuracy}%
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-border-color/40">
                <span className="capitalize">Deck: {item.deck}</span>
                <span className={item.accuracy < 60 ? "text-again font-bold" : "text-easy font-bold"}>
                  {item.accuracy < 60 ? "⚠ Reforço Necessário" : "✓ Fixado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
