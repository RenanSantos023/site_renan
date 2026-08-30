'use client';

import React, { useState } from "react";
import type { Note, Card } from "../../amplify/data/resource";
import { apiGenerateAiCards } from "../../utils/api";

interface AiGeneratorViewProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onCreateNotes: (notes: Note[], cards: Card[]) => void;
}

export default function AiGeneratorView({ showToast, onCreateNotes }: AiGeneratorViewProps) {
  const [deckId, setDeckId] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedPreview, setGeneratedPreview] = useState<any[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !deckId.trim()) return;

    setLoading(true);

    try {
      const flashcards = await apiGenerateAiCards({
        sourceType: "TEXT",
        content: text,
        deckId: deckId.trim().toLowerCase()
      });

      if (flashcards && flashcards.length > 0) {
        setGeneratedPreview(flashcards.map(f => ({
          noteType: f.type || "BASIC",
          deckId: deckId.trim().toLowerCase(),
          fields: {
            Front: f.front || "Pergunta gerada por IA",
            Back: f.back || "Resposta gerada por IA"
          },
          tags: f.tags || ["ia-bedrock", deckId.trim().toLowerCase()]
        })));
        showToast(`${flashcards.length} flashcards gerados via Amazon Bedrock (Claude)!`, "success");
      } else {
        showToast("Nenhum flashcard gerado pela IA para o texto informado.", "info");
      }
    } catch (err: any) {
      showToast(`Erro ao gerar flashcards via Bedrock: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    if (generatedPreview.length === 0) return;

    const newNotes: Note[] = [];
    const newCards: Card[] = [];
    const timestamp = new Date().toISOString();

    generatedPreview.forEach((item) => {
      const noteId = "not_" + Math.random().toString(36).substr(2, 9);
      const cardId = "crd_" + Math.random().toString(36).substr(2, 9);

      const note: Note = {
        noteId,
        deckId: item.deckId,
        noteType: item.noteType || "BASIC",
        fields: item.fields,
        tags: item.tags || ["ia-bedrock", item.deckId],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const card: Card = {
        cardId,
        noteId,
        deckId: item.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      newNotes.push(note);
      newCards.push(card);
    });

    onCreateNotes(newNotes, newCards);
    showToast(`${newNotes.length} cartões importados no baralho "${deckId}"!`, "success");
    setGeneratedPreview([]);
    setText("");
    setDeckId("");
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
          Mineração de Flashcards com Amazon Bedrock
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Insira qualquer texto, artigo ou resumo para que o modelo Claude gere automaticamente flashcards otimizados para memorização no DynamoDB.
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-3xl p-8 flex flex-col gap-6 shadow-xl">
        <form onSubmit={handleGenerate} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Baralho de Destino</label>
            <input 
              type="text"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              placeholder="Ex: vocabulario, aws-cloud, databricks..."
              required
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Conteúdo Base para Extração</label>
            <textarea 
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o texto, regras de negócio, documentação técnica ou anotações..."
              required
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300 resize-none font-sans"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || !text.trim() || !deckId.trim()}
            className="bg-gradient-to-r from-accent-purple to-purple-700 hover:opacity-95 text-white font-bold text-xs px-8 py-3.5 rounded-2xl shadow-lg shadow-accent-purple/20 cursor-pointer disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 self-start"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Processando com Amazon Bedrock...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <span>Gerar Flashcards com IA</span>
              </>
            )}
          </button>
        </form>

        {generatedPreview.length > 0 && (
          <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-border-color/60 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">
                Flashcards Gerados ({generatedPreview.length})
              </h2>
              <button 
                onClick={confirmImport}
                className="bg-easy hover:bg-easy/90 text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-md shadow-easy/20"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Salvar Todos no Baralho</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedPreview.map((item, idx) => (
                <div key={idx} className="bg-bg-input/60 border border-border-color p-5 rounded-2xl flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent-purple">Pergunta / Frente</span>
                    <p className="text-xs font-bold text-text-primary mt-1">{item.fields?.Front}</p>
                  </div>
                  <div className="pt-2 border-t border-border-color/40">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-easy">Resposta / Verso</span>
                    <p className="text-xs text-text-secondary mt-1">{item.fields?.Back}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
