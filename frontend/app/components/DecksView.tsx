'use client';

import React, { useState } from "react";
import type { Note, Card, Deck } from "../../amplify/data/resource";
import { CreateDeckModal } from "./CreateDeckModal";
import { DeleteDeckModal } from "./DeleteDeckModal";
import { apiDeleteDeck } from "../../utils/api";

interface DecksViewProps {
  notes: Note[];
  cards: Card[];
  decks?: Deck[];
  onStudyDeck: (deckId: string) => void;
  onCreateDeck?: () => void;
  onAddCardsToDeck: (deckId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteDeck?: (deckId: string) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefresh?: () => void;
}

type FilterType = "all" | "in_progress" | "completed" | "favorites";
type SortType = "recent" | "mastery" | "title" | "cards";

export default function DecksView({
  notes,
  cards,
  decks = [],
  onStudyDeck,
  onCreateDeck,
  onAddCardsToDeck,
  onDeleteNote,
  onDeleteDeck,
  showToast,
  onRefresh
}: DecksViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [deckToDelete, setDeckToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletedDeckIds, setDeletedDeckIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("recent");
  const [selectedDeckDetail, setSelectedDeckDetail] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "cards" | "progress">("overview");
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("ultra_fav_decks") || "[]");
    } catch {
      return [];
    }
  });

  const toggleFavorite = (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(deckId)
      ? favorites.filter(id => id !== deckId)
      : [...favorites, deckId];
    setFavorites(updated);
    localStorage.setItem("ultra_fav_decks", JSON.stringify(updated));
    showToast(favorites.includes(deckId) ? "Removido dos favoritos" : "Adicionado aos favoritos", "info");
  };

  // Processar dados de cada baralho
  const now = new Date();
  const decksMap = new Map<string, {
    deckId: string;
    title: string;
    description: string;
    notes: Note[];
    cards: Card[];
    dueCount: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
    latestUpdate: string;
  }>();

  // 1. Inicializar com decks explicitamente criados
  decks.forEach(d => {
    const dId = (d.deckId || '').trim().toLowerCase();
    if (!dId) return;
    decksMap.set(dId, {
      deckId: dId,
      title: d.title || dId,
      description: d.description || '',
      notes: [],
      cards: [],
      dueCount: 0,
      newCount: 0,
      learningCount: 0,
      masteredCount: 0,
      latestUpdate: d.updatedAt || d.createdAt || new Date().toISOString()
    });
  });

  // 2. Mapear notas existentes
  notes.forEach(note => {
    const d = (note.deckId || "geral").toLowerCase();
    const item = decksMap.get(d) || {
      deckId: d,
      title: d,
      description: '',
      notes: [],
      cards: [],
      dueCount: 0,
      newCount: 0,
      learningCount: 0,
      masteredCount: 0,
      latestUpdate: note.updatedAt || note.createdAt || new Date().toISOString()
    };
    item.notes.push(note);
    decksMap.set(d, item);
  });

  // 3. Mapear cards existentes
  cards.forEach(card => {
    const d = (card.deckId || "geral").toLowerCase();
    const item = decksMap.get(d);
    if (item) {
      item.cards.push(card);
      if (!card.dueDate || new Date(card.dueDate) <= now) item.dueCount += 1;
      if (card.state === "NEW") item.newCount += 1;
      if (card.state === "LEARNING") item.learningCount += 1;
      if ((card.stability || 0) > 15 || (card.state === "REVIEW" && (card.scheduledDays || 0) > 21)) {
        item.masteredCount += 1;
      }
    }
  });

  const deckList = Array.from(decksMap.values()).map(d => {
    const total = d.cards.length || 1;
    const masteryPercent = Math.min(100, Math.round((d.masteredCount / total) * 100));
    return {
      ...d,
      masteryPercent,
      isFavorite: favorites.includes(d.deckId)
    };
  });

  // Filtragem
  const filteredDecks = deckList.filter(deck => {
    if (deletedDeckIds.includes(deck.deckId.toLowerCase())) return false;
    const matchesSearch = deck.deckId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (deck.title && deck.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (filter === "favorites") return deck.isFavorite;
    if (filter === "completed") return deck.masteryPercent >= 80;
    if (filter === "in_progress") return deck.masteryPercent < 80;
    return true;
  });

  // Ordenação
  filteredDecks.sort((a, b) => {
    if (sortBy === "mastery") return b.masteryPercent - a.masteryPercent;
    if (sortBy === "cards") return b.cards.length - a.cards.length;
    if (sortBy === "title") return (a.title || a.deckId).localeCompare(b.title || b.deckId);
    return new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime();
  });

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

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleDeckCreated = (newDeck: Deck) => {
    if (onRefresh) {
      onRefresh();
    }
    setSelectedDeckDetail(newDeck.deckId);
  };

  const handleConfirmDeleteDeck = async (deckId: string) => {
    try {
      const dLower = deckId.toLowerCase();
      setDeletedDeckIds(prev => [...prev, dLower]);
      await apiDeleteDeck(deckId);
      if (onDeleteDeck) {
        onDeleteDeck(deckId);
      }
      if (selectedDeckDetail && selectedDeckDetail.toLowerCase() === dLower) {
        setSelectedDeckDetail(null);
      }
      showToast("Baralho excluído com sucesso!", "success");
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setDeletedDeckIds(prev => prev.filter(id => id !== deckId.toLowerCase()));
      showToast(`Erro ao excluir baralho: ${err.message}`, "error");
      throw err;
    }
  };

  const selectedDeck = deckList.find(d => d.deckId === selectedDeckDetail);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
            Biblioteca de Decks
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Organize e gerencie seus baralhos e acervos de conhecimento.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-95 text-white font-bold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer self-start md:self-auto transition-all duration-300"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          <span>Criar Baralho</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar baralhos por título..."
            className="w-full bg-bg-card border border-border-color text-text-primary text-sm pl-11 pr-4 py-3 rounded-2xl outline-none focus:border-accent-purple focus:bg-bg-input transition-all duration-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-bg-card border border-border-color p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "all" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter("in_progress")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "in_progress" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              Em Andamento
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "completed" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              Dominados
            </button>
            <button
              onClick={() => setFilter("favorites")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "favorites" ? "bg-accent-purple text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              Favoritos
            </button>
          </div>

          <div className="bg-bg-card border border-border-color p-1 rounded-2xl flex items-center gap-1">
            <span className="material-symbols-outlined text-text-secondary text-sm pl-2">sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="bg-transparent text-text-secondary text-xs font-semibold px-2 py-1.5 rounded-xl outline-none cursor-pointer"
            >
              <option value="recent" className="bg-bg-card text-text-primary">Mais Recentes</option>
              <option value="mastery" className="bg-bg-card text-text-primary">Maior Domínio</option>
              <option value="cards" className="bg-bg-card text-text-primary">Mais Cartões</option>
              <option value="title" className="bg-bg-card text-text-primary">Nome A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {filteredDecks.length === 0 ? (
        <div className="bg-bg-card border border-border-color rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-text-secondary">
            <span className="material-symbols-outlined text-4xl">folder_off</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Nenhum baralho encontrado</h3>
            <p className="text-xs text-text-secondary mt-1">
              {searchQuery ? "Tente outro termo na busca ou limpe o filtro." : "Crie o seu primeiro baralho para começar a estudar com FSRS."}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-accent-purple text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer hover:opacity-90 transition-all mt-2"
            >
              Criar Primeiro Baralho
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDecks.map(deck => (
            <div
              key={deck.deckId}
              onClick={() => setSelectedDeckDetail(deck.deckId)}
              className="bg-bg-card border border-border-color hover:border-accent-purple/60 rounded-3xl p-6 flex flex-col justify-between gap-5 shadow-xl hover:shadow-accent-purple/10 cursor-pointer transition-all duration-300 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-accent-purple/15 text-accent-purple flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-2xl">{getDeckIcon(deck.deckId)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => toggleFavorite(deck.deckId, e)}
                      className={`p-2 rounded-xl border border-transparent hover:border-border-color transition-colors cursor-pointer ${deck.isFavorite ? "text-accent-yellow" : "text-text-disabled hover:text-text-primary"}`}
                      title={deck.isFavorite ? "Favorito" : "Marcar favorito"}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {deck.isFavorite ? "star" : "star_border"}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeckToDelete({ id: deck.deckId, title: deck.title || deck.deckId });
                      }}
                      className="p-2 rounded-xl border border-transparent hover:border-red-500/30 text-text-disabled hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Excluir baralho"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-text-primary mt-4 truncate">
                  {deck.title || deck.deckId}
                </h3>
                {deck.description ? (
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {deck.description}
                  </p>
                ) : (
                  <p className="text-xs text-text-secondary mt-1">
                    {deck.notes.length} notas • {deck.cards.length} flashcards
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1.5 font-semibold">
                  <span>Domínio de Memória</span>
                  <span className="text-text-primary font-bold">{deck.masteryPercent}%</span>
                </div>
                <div className="w-full bg-bg-input h-2.5 rounded-full overflow-hidden border border-border-color/60">
                  <div
                    className="bg-gradient-to-r from-accent-blue to-accent-purple h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, deck.masteryPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-secondary mt-3 pt-3 border-t border-border-color/60">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-again" />
                    {deck.dueCount} para revisar
                  </span>
                  <span>{deck.masteredCount} dominados</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStudyDeck(deck.deckId);
                  }}
                  className="bg-accent-purple/15 hover:bg-accent-purple text-accent-purple hover:text-white border border-accent-purple/40 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">school</span>
                  <span>Estudar</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDeckDetail(deck.deckId);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-text-primary text-xs font-bold py-2.5 rounded-xl border border-border-color flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">visibility</span>
                  <span>Detalhes</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DECK DETAIL MODAL / DRAWER */}
      {selectedDeck && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-bg-card border border-border-color w-full max-w-3xl rounded-3xl p-6 md:p-8 flex flex-col gap-6 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-border-color pb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-accent-purple/20 text-accent-purple flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">{getDeckIcon(selectedDeck.deckId)}</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-text-primary">{selectedDeck.title || selectedDeck.deckId}</h2>
                  {selectedDeck.description && (
                    <p className="text-xs text-text-secondary mt-0.5 max-w-xl">
                      {selectedDeck.description}
                    </p>
                  )}
                  <p className="text-[11px] text-text-secondary/80 mt-1">
                    {selectedDeck.cards.length} Flashcards • {selectedDeck.masteryPercent}% Domínio Geral
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeckToDelete({ id: selectedDeck.deckId, title: selectedDeck.title || selectedDeck.deckId })}
                  className="p-2 rounded-xl text-text-disabled hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Excluir este baralho"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                  <span className="hidden sm:inline">Excluir</span>
                </button>
                <button
                  onClick={() => setSelectedDeckDetail(null)}
                  className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSelectedDeckDetail(null);
                  onStudyDeck(selectedDeck.deckId);
                }}
                className="bg-gradient-to-r from-accent-blue to-accent-purple text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">play_circle</span>
                <span>Iniciar Estudo ({selectedDeck.dueCount} devidos)</span>
              </button>

              <button
                onClick={() => {
                  setSelectedDeckDetail(null);
                  onAddCardsToDeck(selectedDeck.deckId);
                }}
                className="bg-white/5 hover:bg-white/10 text-text-primary font-bold text-xs px-5 py-3 rounded-xl border border-border-color flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_card</span>
                <span>+ Adicionar Cards</span>
              </button>
            </div>

            {/* Detail Tabs */}
            <div className="flex border-b border-border-color gap-4">
              <button
                onClick={() => setDetailTab("overview")}
                className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${detailTab === "overview" ? "border-accent-purple text-accent-purple" : "border-transparent text-text-secondary hover:text-text-primary"}`}
              >
                Visão Geral
              </button>
              <button
                onClick={() => setDetailTab("cards")}
                className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${detailTab === "cards" ? "border-accent-purple text-accent-purple" : "border-transparent text-text-secondary hover:text-text-primary"}`}
              >
                Lista de Cartões ({selectedDeck.notes.length})
              </button>
              <button
                onClick={() => setDetailTab("progress")}
                className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${detailTab === "progress" ? "border-accent-purple text-accent-purple" : "border-transparent text-text-secondary hover:text-text-primary"}`}
              >
                Status FSRS
              </button>
            </div>

            {/* Tab: Overview */}
            {detailTab === "overview" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-bg-input/60 p-4 rounded-2xl border border-border-color">
                  <span className="text-xs text-text-secondary block">Devidos Hoje</span>
                  <span className="text-2xl font-black text-again mt-1 block">{selectedDeck.dueCount}</span>
                </div>
                <div className="bg-bg-input/60 p-4 rounded-2xl border border-border-color">
                  <span className="text-xs text-text-secondary block">Novos</span>
                  <span className="text-2xl font-black text-accent-blue mt-1 block">{selectedDeck.newCount}</span>
                </div>
                <div className="bg-bg-input/60 p-4 rounded-2xl border border-border-color">
                  <span className="text-xs text-text-secondary block">Em Aprendizado</span>
                  <span className="text-2xl font-black text-hard mt-1 block">{selectedDeck.learningCount}</span>
                </div>
                <div className="bg-bg-input/60 p-4 rounded-2xl border border-border-color">
                  <span className="text-xs text-text-secondary block">Dominados</span>
                  <span className="text-2xl font-black text-easy mt-1 block">{selectedDeck.masteredCount}</span>
                </div>
              </div>
            )}

            {/* Tab: Cards */}
            {detailTab === "cards" && (
              <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-2">
                {selectedDeck.notes.length === 0 ? (
                  <div className="bg-bg-input/30 border border-dashed border-border-color rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-text-disabled">style</span>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Nenhum card neste baralho ainda.</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">Comece adicionando novos flashcards manualmente ou gerando com IA.</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDeckDetail(null);
                        onAddCardsToDeck(selectedDeck.deckId);
                      }}
                      className="bg-accent-purple text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-sm">add_card</span>
                      <span>+ Criar Primeiro Card</span>
                    </button>
                  </div>
                ) : (
                  selectedDeck.notes.map(note => (
                    <div
                      key={note.noteId}
                      className="bg-bg-input/60 border border-border-color p-4 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-bold text-text-primary truncate">
                          {note.fields?.Front || "Sem pergunta"}
                        </span>
                        <span className="text-xs text-text-secondary truncate">
                          {note.fields?.Back || "Sem resposta"}
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteNote(note.noteId)}
                        className="p-2 text-text-disabled hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
                        title="Excluir nota"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Progress */}
            {detailTab === "progress" && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-text-secondary">
                  Distribuição de cartões de acordo com o modelo de repetição espaçada FSRS v4.5:
                </p>
                <div className="w-full bg-bg-input h-6 rounded-xl flex overflow-hidden border border-border-color">
                  <div
                    title={`Novos: ${selectedDeck.newCount}`}
                    style={{ width: `${(selectedDeck.newCount / (selectedDeck.cards.length || 1)) * 100}%` }}
                    className="bg-accent-blue h-full"
                  />
                  <div
                    title={`Em Aprendizado: ${selectedDeck.learningCount}`}
                    style={{ width: `${(selectedDeck.learningCount / (selectedDeck.cards.length || 1)) * 100}%` }}
                    className="bg-hard h-full"
                  />
                  <div
                    title={`Dominados: ${selectedDeck.masteredCount}`}
                    style={{ width: `${(selectedDeck.masteredCount / (selectedDeck.cards.length || 1)) * 100}%` }}
                    className="bg-easy h-full"
                  />
                </div>
                <div className="flex items-center justify-around text-xs text-text-secondary font-bold pt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-blue" /> Novos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-hard" /> Em Aprendizado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-easy" /> Dominados
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* CREATE DECK MODAL */}
      <CreateDeckModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDeckCreated={handleDeckCreated}
        showToast={(type, title, msg) => showToast(`${title} - ${msg}`, type)}
      />

      {/* DELETE DECK CONFIRMATION MODAL */}
      {deckToDelete && (
        <DeleteDeckModal
          isOpen={Boolean(deckToDelete)}
          deckId={deckToDelete.id}
          deckTitle={deckToDelete.title}
          onClose={() => setDeckToDelete(null)}
          onConfirmDelete={handleConfirmDeleteDeck}
        />
      )}

    </div>
  );
}
