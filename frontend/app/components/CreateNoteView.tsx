'use client';

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Note, Card } from "../../amplify/data/resource";

const noteSchema = z.object({
  deckId: z.string().min(2, "O baralho deve ter pelo menos 2 caracteres."),
  noteType: z.enum(["BASIC", "BASIC_REVERSED", "CLOZE", "TYPE_ANSWER", "IMAGE_OCCLUSION"]),
  front: z.string().min(1, "O campo de pergunta/frente é obrigatório."),
  back: z.string().min(1, "O campo de resposta/verso é obrigatório."),
  tags: z.string().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface CreateNoteViewProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onCreateNote: (note: Note, cards: Card[]) => void;
  onCancel: () => void;
}

export default function CreateNoteView({ showToast, onCreateNote, onCancel }: CreateNoteViewProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      noteType: "BASIC",
      deckId: "",
      front: "",
      back: "",
      tags: ""
    }
  });

  const selectedNoteType = watch("noteType");

  const onSubmit = async (data: NoteFormData) => {
    const apiMode = localStorage.getItem("ultra_api_mode") || "mock";
    const apiUrl = localStorage.getItem("ultra_api_url") || "";
    const userId = localStorage.getItem("ultra_user_id") || "usr_dev_default";

    const tags = data.tags 
      ? data.tags.split(",").map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
      : [];

    const noteId = "not_" + Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toISOString();

    const newNote: Note = {
      user_id: userId,
      noteId: noteId,
      deckId: data.deckId.toLowerCase().trim(),
      noteType: data.noteType,
      fields: { Front: data.front.trim(), Back: data.back.trim() },
      tags,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Derivação de cartões (RN-02)
    const derivedCards: Card[] = [];
    if (data.noteType === "BASIC" || data.noteType === "TYPE_ANSWER" || data.noteType === "IMAGE_OCCLUSION") {
      derivedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: noteId,
        deckId: newNote.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    } else if (data.noteType === "BASIC_REVERSED") {
      derivedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: noteId,
        deckId: newNote.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      derivedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: noteId,
        deckId: newNote.deckId,
        cardOrdinal: 1,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    } else if (data.noteType === "CLOZE") {
      const content = data.front;
      const clozeRegex = /\{\{c(\d+)::(.*?)\}\}/g;
      const clozes = new Set<number>();
      let match;
      while ((match = clozeRegex.exec(content)) !== null) {
        clozes.add(parseInt(match[1]));
      }
      if (clozes.size === 0) clozes.add(1);

      Array.from(clozes).sort((a, b) => a - b).forEach((clozeNum, idx) => {
        derivedCards.push({
          cardId: "crd_" + Math.random().toString(36).substr(2, 9),
          noteId: noteId,
          deckId: newNote.deckId,
          cardOrdinal: idx,
          state: "NEW",
          stability: 0,
          difficulty: 0,
          dueDate: timestamp,
          scheduledDays: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      });
    }

    if (apiMode === "aws" && apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer SIMULATED_TOKEN",
            "X-User-Id": userId
          },
          body: JSON.stringify({
            deck_id: newNote.deckId,
            note_type: newNote.noteType,
            fields: newNote.fields,
            tags: newNote.tags
          })
        });

        if (!response.ok) throw new Error();
        const result = await response.json();
        onCreateNote(result.note, result.cards);
        saveNoteLocally(result.note, result.cards);
      } catch (err) {
        showToast("Falha de rede com Lambda. Salvando localmente.", "error");
        onCreateNote(newNote, derivedCards);
        saveNoteLocally(newNote, derivedCards);
      }
    } else {
      onCreateNote(newNote, derivedCards);
      saveNoteLocally(newNote, derivedCards);
    }
  };

  const saveNoteLocally = (note: Note, cards: Card[]) => {
    const localNotesStr = localStorage.getItem("ultra_notes");
    const localCardsStr = localStorage.getItem("ultra_cards");

    const notes: Note[] = localNotesStr ? JSON.parse(localNotesStr) : [];
    const localCards: Card[] = localCardsStr ? JSON.parse(localCardsStr) : [];

    notes.push(note);
    localCards.push(...cards);

    localStorage.setItem("ultra_notes", JSON.stringify(notes));
    localStorage.setItem("ultra_cards", JSON.stringify(localCards));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Criar Novo Flashcard</h2>
        <p className="text-xs text-text-secondary mt-1">
          Uma única nota física pode conter múltiplos cartões de estudo derivados (ex: Reverso, Cloze).
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-2xl p-8 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          
          <div className="flex gap-5">
            {/* Baralho */}
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary tracking-wider">Nome do Baralho (Deck)</label>
              <input 
                type="text" 
                placeholder="Ex: ingles_avancado, enem_biologia"
                {...register("deckId")}
                className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
              />
              {errors.deckId && <span className="text-xs text-again">{errors.deckId.message}</span>}
            </div>

            {/* Tipo de Nota */}
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary tracking-wider">Tipo de Nota</label>
              <select 
                {...register("noteType")}
                className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 cursor-pointer"
              >
                <option value="BASIC">Básico (Frente e Verso)</option>
                <option value="BASIC_REVERSED">Básico e Reverso (Gera 2 cards)</option>
                <option value="CLOZE">Cloze Deletion (Ocultação de texto)</option>
                <option value="TYPE_ANSWER">Digitar Resposta</option>
                <option value="IMAGE_OCCLUSION">Oclusão de Imagem</option>
              </select>
            </div>
          </div>

          {/* Campos Dinâmicos baseados no tipo de nota */}
          <div className="flex flex-col gap-5">
            {selectedNoteType === "CLOZE" ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary tracking-wider">Texto com Ocultações (Frente)</label>
                  <textarea 
                    rows={4}
                    placeholder="Ex: O {{c1::Amazon Bedrock}} é um serviço gerenciado que disponibiliza {{c2::modelos de fundação}}."
                    {...register("front")}
                    className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 resize-y"
                  />
                  {errors.front && <span className="text-xs text-again">{errors.front.message}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary tracking-wider">Dica extra (Opcional - exibida no Verso)</label>
                  <textarea 
                    rows={2}
                    placeholder="Ex: Nome da nuvem AWS"
                    {...register("back")}
                    className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 resize-y"
                  />
                  {errors.back && <span className="text-xs text-again">{errors.back.message}</span>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary tracking-wider">Frente (Pergunta / Termo)</label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Ephemeral"
                    {...register("front")}
                    className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 resize-y"
                  />
                  {errors.front && <span className="text-xs text-again">{errors.front.message}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary tracking-wider">Verso (Resposta / Definição)</label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Efêmero / Passageiro"
                    {...register("back")}
                    className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 resize-y"
                  />
                  {errors.back && <span className="text-xs text-again">{errors.back.message}</span>}
                </div>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Tags (separadas por vírgula)</label>
            <input 
              type="text" 
              placeholder="Ex: vocabulario, ingles, adjetivos"
              {...register("tags")}
              className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-6 border-t border-border-color pt-6">
            <button 
              type="button" 
              onClick={onCancel}
              className="bg-transparent border border-border-color text-text-secondary hover:text-text-primary hover:bg-white/4 px-6 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-300"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="bg-accent-blue hover:bg-accent-blue/90 text-white font-bold px-6 py-2.5 rounded-full text-xs cursor-pointer shadow-lg shadow-accent-blue/20 transition-all duration-300 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Salvar Nota e Cartões</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
