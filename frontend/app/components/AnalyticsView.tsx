'use client';

import React, { useState, useEffect } from "react";
import type { Note, Card, AnalyticsSummaryResponse } from "../../amplify/data/resource";
import { apiFetchAnalyticsSummary } from "../../utils/api";

interface AnalyticsViewProps {
  notes: Note[];
  cards: Card[];
  onStartRecommendedStudy: () => void;
  analyticsData?: AnalyticsSummaryResponse | null;
}

export default function AnalyticsView({
  notes,
  cards,
  onStartRecommendedStudy,
  analyticsData
}: AnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummaryResponse | null>(analyticsData || null);
  const [loading, setLoading] = useState<boolean>(!analyticsData);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiFetchAnalyticsSummary();
        setAnalytics(data);
      } catch (err) {
        console.warn("Não foi possível carregar analytics da API, calculando a partir dos cartões locais:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [cards]);

  // Cálculos derivados e sincronizados com os cartões e decks ativos
  const totalCards = cards.length;
  const activeDeckIds = new Set(cards.map(c => (c.deckId || '').toLowerCase()));

  const masteredCards = cards.filter(c => (c.stability || 0) > 15 || (c.state === "REVIEW" && (c.scheduledDays || 0) > 21));
  const masteryPercent = totalCards > 0
    ? (analytics?.summary.mastery_percent ?? Math.min(100, Math.round((masteredCards.length / totalCards) * 100)))
    : 0;
  const streakDays = totalCards > 0 ? (analytics?.gamification.streak_days ?? 0) : 0;
  const recordStreak = totalCards > 0 ? (analytics?.gamification.record_streak_days ?? Math.max(streakDays, 1)) : 0;
  const totalMinutes = totalCards > 0 ? (analytics?.gamification.total_study_minutes ?? 0) : 0;
  const accuracyRate = totalCards > 0 ? (analytics?.gamification.accuracy_rate ?? 0) : 0;

  // Filtrar tópicos fracos para considerar apenas baralhos que ainda existem
  const weakTopics = totalCards > 0
    ? (analytics?.weak_topics || []).filter(wt => activeDeckIds.has((wt.deck || wt.topic || '').toLowerCase()))
    : [];

  // Formatação de tempo de estudo em horas/minutos reais
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
            Analytics & Retenção de Memória
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Métricas reais calculadas pelo algoritmo FSRS a partir do seu histórico de revisões no DynamoDB.
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
            <span className="text-[11px] text-text-secondary block mt-1">Fixação de longo prazo</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-easy h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(5, masteryPercent)}%` }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total de Flashcards</span>
          <div className="my-2">
            <span className="text-3xl md:text-4xl font-black text-accent-blue">{totalCards}</span>
            <span className="text-[11px] text-text-secondary block mt-1">{notes.length} notas no acervo</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-accent-blue h-full rounded-full" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tempo Total</span>
          <div className="my-2">
            <span className="text-3xl md:text-4xl font-black text-accent-yellow">{timeFormatted}</span>
            <span className="text-[11px] text-text-secondary block mt-1">Investidos em memorização</span>
          </div>
          <div className="w-full bg-bg-input h-1.5 rounded-full overflow-hidden">
            <div className="bg-accent-yellow h-full rounded-full" style={{ width: `${Math.min(100, Math.max(15, totalMinutes))}%` }} />
          </div>
        </div>

        <div className="bg-bg-card border border-border-color p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Sequência Diária</span>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-orange-400">🔥 {streakDays}</span>
            <span className="text-sm font-bold text-text-secondary">dias</span>
          </div>
          <span className="text-[11px] text-text-secondary">Recorde registrado: {recordStreak} dias</span>
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
                <p className="text-xs text-text-secondary">Estabilidade acumulada na memória de longo prazo</p>
              </div>
              <span className="text-xs bg-easy/10 text-easy font-bold px-3 py-1 rounded-full border border-easy/20">
                Taxa de recall: {accuracyRate}%
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
            <h3 className="text-base font-bold text-text-primary mb-1">Distribuição de Status FSRS</h3>
            <p className="text-xs text-text-secondary mb-6">Estado dos cartões no banco de dados</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl font-black text-easy">{accuracyRate}%</div>
              <span className="text-xs text-text-secondary">Taxa de assertividade média nas revisões</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-easy">Dominados (Mastered)</span>
                  <span className="text-text-primary">{analytics?.summary.mastered_cards ?? 0}</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-easy h-full rounded-full" style={{ width: `${Math.round(((analytics?.summary.mastered_cards ?? 0) / Math.max(1, totalCards)) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-good">Em Revisão (Review)</span>
                  <span className="text-text-primary">{analytics?.summary.review_cards ?? 0}</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-good h-full rounded-full" style={{ width: `${Math.round(((analytics?.summary.review_cards ?? 0) / Math.max(1, totalCards)) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-hard">Aprendizado (Learning)</span>
                  <span className="text-text-primary">{analytics?.summary.learning_cards ?? 0}</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-hard h-full rounded-full" style={{ width: `${Math.round(((analytics?.summary.learning_cards ?? 0) / Math.max(1, totalCards)) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-again">Novos (New)</span>
                  <span className="text-text-primary">{analytics?.summary.new_cards ?? 0}</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div className="bg-again h-full rounded-full" style={{ width: `${Math.round(((analytics?.summary.new_cards ?? 0) / Math.max(1, totalCards)) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* WEAK TOPICS & REINFORCEMENT */}
      <div className="bg-bg-card border border-border-color p-8 rounded-3xl shadow-xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-accent-purple text-xl">psychology_alt</span>
              <h3 className="text-lg font-bold text-text-primary">Tópicos e Lacunas de Conhecimento</h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Identificados automaticamente pelo FSRS a partir das respostas com maior índice de repetição (`Again`/`Hard`).
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

        {weakTopics.length === 0 ? (
          <div className="p-8 text-center bg-bg-input/40 rounded-2xl border border-border-color">
            <span className="material-symbols-outlined text-easy text-4xl mb-2">verified</span>
            <p className="text-sm font-bold text-text-primary">Nenhuma lacuna crítica de conhecimento detectada!</p>
            <p className="text-xs text-text-secondary mt-1">Conforme você revisa seus flashcards, a IA mapeará os pontos que exigem reforço.</p>
          </div>
        ) : (
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
        )}
      </div>

    </div>
  );
}
