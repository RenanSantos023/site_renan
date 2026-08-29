'use client';

import React, { useState } from "react";
import type { Note, Card } from "../../amplify/data/resource";
import { getAuthSessionToken } from "../amplify-client";

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

    const apiMode = localStorage.getItem("ultra_api_mode") || "mock";
    const apiUrl = localStorage.getItem("ultra_api_url") || "";
    const userId = localStorage.getItem("ultra_user_id") || "usr_dev_default";

    let resultNotes: any[] = [];

    if (apiMode === "aws" && apiUrl) {
      try {
        const token = await getAuthSessionToken();
        const response = await fetch(`${apiUrl}/ai/generate-cards`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "Bearer SIMULATED_TOKEN",
            "X-User-Id": userId
          },
          body: JSON.stringify({
            text: text,
            target_deck_id: deckId.trim().toLowerCase()
          })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        resultNotes = data.generated_notes || [];
      } catch (err) {
        showToast("Erro no Bedrock. Simulando cartões gerados localmente.", "error");
        resultNotes = generateMockAICards(text, deckId);
      }
    } else {
      // Simular delay de Bedrock
      await new Promise(resolve => setTimeout(resolve, 1500));
      resultNotes = generateMockAICards(text, deckId);
    }

    setGeneratedPreview(resultNotes.map(n => ({
      ...n,
      deckId: deckId.trim().toLowerCase(),
      user_id: userId
    })));
    setLoading(false);
  };

  const generateMockAICards = (inputText: string, targetDeck: string) => {
    const cleanWords = inputText.split(/[.\n]/).map(w => w.trim()).filter(w => w.length > 10);
    const mockNotes: any[] = [];
    const limit = Math.min(3, cleanWords.length);
    
    for (let i = 0; i < limit; i++) {
      const sentence = cleanWords[i];
      mockNotes.push({
        noteType: "BASIC",
        deckId: targetDeck,
        fields: {
          Front: `De acordo com o texto: "${sentence.substring(0, 30)}..." o que descreve essa frase?`,
          Back: sentence
        }
      });
    }

    if (mockNotes.length === 0) {
      mockNotes.push({
        noteType: "BASIC",
        deckId: targetDeck,
        fields: {
          Front: "Qual é o assunto principal abordado no texto informado?",
          Back: inputText.substring(0, 60)
        }
      });
    }
    return mockNotes;
  };

  const confirmImport = () => {
    if (generatedPreview.length === 0) return;

    const newNotes: Note[] = [];
    const newCards: Card[] = [];

    generatedPreview.forEach(noteData => {
      const noteId = "not_" + Math.random().toString(36).substr(2, 9);
      const timestamp = new Date().toISOString();

      const note: Note = {
        user_id: noteData.user_id,
        noteId: noteId,
        deckId: noteData.deckId,
        noteType: noteData.noteType,
        fields: noteData.fields,
        tags: ["ia-bedrock", "minerado"],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const cards: Card[] = [];
      cards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: noteId,
        deckId: note.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      newNotes.push(note);
      newCards.push(...cards);
    });

    // Salvar localmente no localStorage para persistência offline
    const localNotesStr = localStorage.getItem("ultra_notes");
    const localCardsStr = localStorage.getItem("ultra_cards");
    const localNotes = localNotesStr ? JSON.parse(localNotesStr) : [];
    const localCards = localCardsStr ? JSON.parse(localCardsStr) : [];

    localNotes.push(...newNotes);
    localCards.push(...newCards);
    localStorage.setItem("ultra_notes", JSON.stringify(localNotes));
    localStorage.setItem("ultra_cards", JSON.stringify(localCards));

    onCreateNotes(newNotes, newCards);
    showToast(`Importados ${newNotes.length} cartões criados com sucesso!`, "success");
    setGeneratedPreview([]);
    setText("");
    setDeckId("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Extração de Flashcards via IA</h2>
        <p className="text-xs text-text-secondary mt-1">
          Forneça um texto explicativo e a IA (Amazon Bedrock) irá minerar e extrair perguntas e respostas relevantes automaticamente.
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-2xl p-8 max-w-2xl">
        <form onSubmit={handleGenerate} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Baralho de Destino</label>
            <input 
              type="text" 
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              placeholder="Ex: deck_inteligencia_artificial" 
              required
              className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Conteúdo Textual (Até 10 KB)</label>
            <textarea 
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex: A Fotossíntese é o processo pelo qual plantas usam luz solar, água e dióxido de carbono para sintetizar oxigênio e energia na forma de açúcar..." 
              required
              className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 resize-y"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 text-sm font-bold rounded-xl border-none cursor-pointer bg-gradient-to-br from-purple-700 to-accent-blue text-white shadow-lg shadow-purple-900/30 hover:shadow-xl hover:shadow-purple-900/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin">autorenew</span>
                <span>Processando Bedrock...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">psychology</span>
                <span>Minerar com IA</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Resultados gerados */}
      {generatedPreview.length > 0 && (
        <div className="bg-bg-card border border-border-color rounded-2xl p-6 max-w-2xl mt-4 animate-slide-in">
          <h3 className="text-base font-bold mb-1">Cartões Extraídos</h3>
          <p className="text-xs text-text-secondary mb-4">Revisar abaixo as definições do Bedrock antes de importar.</p>
          
          <div className="flex flex-col gap-3">
            {generatedPreview.map((note, idx) => (
              <div key={idx} className="bg-bg-input border border-border-color rounded-xl p-4">
                <div className="font-bold text-xs text-text-primary mb-1">Frente: {note.fields.Front}</div>
                <div className="text-xs text-text-secondary">Verso: {note.fields.Back}</div>
              </div>
            ))}
          </div>

          <button 
            onClick={confirmImport}
            className="bg-accent-blue hover:bg-accent-blue/95 text-white text-xs font-bold px-6 py-2.5 rounded-full mt-4 cursor-pointer transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">library_add</span>
            <span>Importar Tudo para a Biblioteca</span>
          </button>
        </div>
      )}
    </div>
  );
}
