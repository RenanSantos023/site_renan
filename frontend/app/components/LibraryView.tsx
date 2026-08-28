'use client';

import React, { useState } from "react";
import type { Note, Card } from "../../amplify/data/resource";

interface LibraryViewProps {
  notes: Note[];
  cards: Card[];
  searchQuery: string;
  selectedFolder: string | null;
  clearFolderFilter: () => void;
  onStudyCard: (cardId: string) => void;
}

export default function LibraryView({ 
  notes, 
  cards, 
  searchQuery, 
  selectedFolder, 
  clearFolderFilter, 
  onStudyCard 
}: LibraryViewProps) {
  const [filterMode, setFilterMode] = useState<string>("recent");
  const [innerSearch, setInnerSearch] = useState<string>("");
  const [activePill, setActivePill] = useState<string>("listas");

  // Filtragem de cartões baseada na pesquisa, pasta e barra interna
  const getFilteredCards = () => {
    let list = [...cards];

    // Filtro por pasta/deck
    if (selectedFolder) {
      list = list.filter(c => (c.deckId || (c as any).deck_id || "").toLowerCase().includes(selectedFolder.toLowerCase()));
    }

    // Filtro por barra de pesquisa global ou barra interna
    const searchVal = (searchQuery || innerSearch).toLowerCase();
    if (searchVal) {
      list = list.filter(c => {
        const noteId = c.noteId || (c as any).note_id;
        const note = notes.find(n => (n.noteId || (n as any).note_id) === noteId);
        const front = (note?.fields?.Front || "").toLowerCase();
        const back = (note?.fields?.Back || "").toLowerCase();
        const deck = (c.deckId || (c as any).deck_id || "").toLowerCase();
        const tags = (note?.tags || []).join(" ").toLowerCase();
        return front.includes(searchVal) || back.includes(searchVal) || deck.includes(searchVal) || tags.includes(searchVal);
      });
    }

    // Ordenação
    if (filterMode === "recent") {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (filterMode === "oldest") {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (filterMode === "alphabetical") {
      list.sort((a, b) => {
        const noteA = notes.find(n => n.noteId === a.noteId)?.fields?.Front || "";
        const noteB = notes.find(n => n.noteId === b.noteId)?.fields?.Front || "";
        return noteA.localeCompare(noteB);
      });
    }

    return list;
  };

  const filtered = getFilteredCards();

  // Dividir para ilustrar a biblioteca do Quizlet ("EM PROGRESSO" vs "MAIS ANTIGOS")
  const inProgressCards = filtered.slice(0, 2);
  const olderCards = filtered.slice(2);

  return (
    <div className="flex flex-col gap-6">
      {/* Pills de Subnavegação */}
      <div className="border-b border-border-color pb-2 mb-6">
        <div className="flex gap-4">
          <button 
            onClick={() => setActivePill("listas")}
            className={`bg-transparent border-none text-sm font-bold px-3 py-2 cursor-pointer relative transition-all duration-300 ${activePill === "listas" ? "text-text-primary after:content-[''] after:absolute after:bottom-[-9.5px] after:left-0 after:w-full after:h-[3px] after:bg-text-primary after:rounded-t" : "text-text-secondary hover:text-text-primary"}`}
          >
            Listas de cartões
          </button>
          <button 
            onClick={() => setActivePill("turmas")}
            className={`bg-transparent border-none text-sm font-bold px-3 py-2 cursor-pointer relative transition-all duration-300 ${activePill === "turmas" ? "text-text-primary after:content-[''] after:absolute after:bottom-[-9.5px] after:left-0 after:w-full after:h-[3px] after:bg-text-primary after:rounded-t" : "text-text-secondary hover:text-text-primary"}`}
          >
            Turmas
          </button>
          <button 
            onClick={() => setActivePill("pastas")}
            className={`bg-transparent border-none text-sm font-bold px-3 py-2 cursor-pointer relative transition-all duration-300 ${activePill === "pastas" ? "text-text-primary after:content-[''] after:absolute after:bottom-[-9.5px] after:left-0 after:w-full after:h-[3px] after:bg-text-primary after:rounded-t" : "text-text-secondary hover:text-text-primary"}`}
          >
            Pastas
          </button>
          <button 
            onClick={() => setActivePill("avaliacoes")}
            className={`bg-transparent border-none text-sm font-bold px-3 py-2 cursor-pointer relative transition-all duration-300 ${activePill === "avaliacoes" ? "text-text-primary after:content-[''] after:absolute after:bottom-[-9.5px] after:left-0 after:w-full after:h-[3px] after:bg-text-primary after:rounded-t" : "text-text-secondary hover:text-text-primary"}`}
          >
            Avaliações
          </button>
          <button 
            onClick={() => setActivePill("solucoes")}
            className={`bg-transparent border-none text-sm font-bold px-3 py-2 cursor-pointer relative transition-all duration-300 ${activePill === "solucoes" ? "text-text-primary after:content-[''] after:absolute after:bottom-[-9.5px] after:left-0 after:w-full after:h-[3px] after:bg-text-primary after:rounded-t" : "text-text-secondary hover:text-text-primary"}`}
          >
            Soluções de IA
          </button>
        </div>
      </div>

      {/* Pasta Filtro Ativo Banner */}
      {selectedFolder && (
        <div className="flex items-center gap-3 bg-accent-blue/10 border border-accent-blue/30 rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-blue">
          <span className="material-symbols-outlined">folder</span>
          <span>Filtrando pela pasta: <strong>{selectedFolder}</strong></span>
          <button 
            onClick={clearFolderFilter} 
            className="ml-auto bg-transparent border-none text-accent-blue hover:text-white cursor-pointer font-bold flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Filtros e Barra de Pesquisa de Cartões */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <div>
          <select 
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="w-full sm:w-auto bg-bg-card border border-border-color text-text-primary px-4 py-2.5 rounded-xl outline-none text-[13px] font-semibold cursor-pointer min-w-[140px] hover:border-text-secondary transition-all duration-300"
          >
            <option value="recent">Recentes</option>
            <option value="oldest">Antigos</option>
            <option value="alphabetical">Ordem Alfabética</option>
          </select>
        </div>
        
        <div className="flex items-center bg-bg-app border border-border-color rounded-xl px-4 py-2.5 w-full sm:w-[320px]">
          <span className="material-symbols-outlined text-lg text-text-disabled mr-2.5">search</span>
          <input 
            type="text" 
            value={innerSearch}
            onChange={(e) => setInnerSearch(e.target.value)}
            placeholder="Pesquisar cartões na biblioteca..." 
            className="bg-transparent border-none text-text-primary text-[13px] w-full outline-none"
          />
        </div>
      </div>

      {/* Conteúdo dos Cartões */}
      <div className="flex flex-col gap-9">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-bg-card border border-dashed border-border-color rounded-2xl text-text-secondary text-sm">
            <span className="material-symbols-outlined text-5xl text-text-disabled mb-4">folder_open</span>
            Nenhum cartão encontrado na biblioteca.
          </div>
        ) : (
          <>
            {/* Grupo: Em Progresso */}
            {inProgressCards.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-[11px] font-extrabold text-text-secondary tracking-widest border-b border-border-color pb-1.5">
                  EM PROGRESSO
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inProgressCards.map((c, idx) => {
                    const note = notes.find(n => n.noteId === c.noteId);
                    const title = (note?.fields?.Front || "Sem título").replace(/\{\{c\d+::(.*?)\}\}/g, "[...] ($1)");
                    return (
                      <div 
                        key={c.cardId || (c as any).card_id || `prog-${idx}`}
                        onClick={() => onStudyCard(c.cardId)}
                        className="bg-bg-card border border-border-color rounded-xl p-5 hover:bg-bg-card-hover hover:border-accent-blue hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-blue/10 cursor-pointer flex flex-col gap-3 relative overflow-hidden transition-all duration-300 group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {c.state}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                            <div className="w-4 h-4 bg-accent-blue rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                              {(c.deckId || (c as any).deck_id || "GE").substring(0, 2).toUpperCase()}
                            </div>
                            <span>{c.deckId || (c as any).deck_id || "Geral"}</span>
                          </div>
                        </div>
                        <div className="text-base font-bold leading-normal text-text-primary line-clamp-2">
                          {title}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {(note?.tags || []).map(t => (
                            <span key={t} className="text-[10px] font-semibold text-accent-blue bg-accent-blue/8 px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                          {c.stability > 0 && (
                            <span className="text-[10px] font-semibold text-color-easy bg-color-easy/8 px-2 py-0.5 rounded-full">
                              S: {c.stability.toFixed(1)}d
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay Play Icon */}
                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center text-white shadow-md">
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grupo: Geral / Mais Antigos */}
            {olderCards.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-[11px] font-extrabold text-text-secondary tracking-widest border-b border-border-color pb-1.5">
                  MAIS ANTIGOS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {olderCards.map((c, idx) => {
                    const note = notes.find(n => n.noteId === c.noteId);
                    const title = (note?.fields?.Front || "Sem título").replace(/\{\{c\d+::(.*?)\}\}/g, "[...] ($1)");
                    return (
                      <div 
                        key={c.cardId || (c as any).card_id || `old-${idx}`}
                        onClick={() => onStudyCard(c.cardId)}
                        className="bg-bg-card border border-border-color rounded-xl p-5 hover:bg-bg-card-hover hover:border-accent-blue hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-blue/10 cursor-pointer flex flex-col gap-3 relative overflow-hidden transition-all duration-300 group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {c.state}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                            <div className="w-4 h-4 bg-accent-blue rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                              {(c.deckId || (c as any).deck_id || "GE").substring(0, 2).toUpperCase()}
                            </div>
                            <span>{c.deckId || (c as any).deck_id || "Geral"}</span>
                          </div>
                        </div>
                        <div className="text-base font-bold leading-normal text-text-primary line-clamp-2">
                          {title}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {(note?.tags || []).map(t => (
                            <span key={t} className="text-[10px] font-semibold text-accent-blue bg-accent-blue/8 px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>

                        {/* Hover Overlay Play Icon */}
                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center text-white shadow-md">
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
