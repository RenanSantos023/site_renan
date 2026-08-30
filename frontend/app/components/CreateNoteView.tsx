'use client';

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Note, Card } from "../../amplify/data/resource";
import { apiCreateNote } from "../../utils/api";

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
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<NoteFormData>({
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
    const tags = data.tags 
      ? data.tags.split(",").map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
      : [];

    try {
      const result = await apiCreateNote({
        deck_id: data.deckId.toLowerCase().trim(),
        note_type: data.noteType,
        fields: { Front: data.front.trim(), Back: data.back.trim() },
        tags
      });

      onCreateNote(result.note, result.cards);
      showToast(`Nota e ${result.cards.length} flashcard(s) criados com sucesso no DynamoDB da AWS!`, "success");
      reset();
    } catch (err: any) {
      showToast(`Erro ao salvar na AWS: ${err.message}`, "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">Criar Novo Flashcard</h1>
        <p className="text-xs text-text-secondary mt-1">
          Uma única nota no DynamoDB pode gerar múltiplos cartões de estudo derivados (ex: Reverso, Cloze).
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-3xl p-8 shadow-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          
          {/* Deck ID */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Nome do Baralho (Deck)</label>
            <input 
              {...register("deckId")}
              placeholder="Ex: vocabulario, enem, databricks..."
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
            />
            {errors.deckId && <span className="text-again text-xs font-semibold">{errors.deckId.message}</span>}
          </div>

          {/* Tipo de Nota */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Tipo de Nota</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { id: "BASIC", label: "Básico (Frente/Verso)", desc: "1 Cartão gerado" },
                { id: "BASIC_REVERSED", label: "Básico & Invertido", desc: "2 Cartões gerados" },
                { id: "CLOZE", label: "Oclusão (Cloze {{c1::...}})", desc: "N Cartões por lacuna" },
                { id: "TYPE_ANSWER", label: "Resposta Digitada", desc: "1 Cartão de digitação" },
              ].map((type) => (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => setValue("noteType", type.id as any)}
                  className={`p-4 rounded-2xl border text-left flex flex-col gap-1 cursor-pointer transition-all duration-200 ${
                    selectedNoteType === type.id 
                      ? "border-accent-purple bg-accent-purple/15 text-text-primary shadow-md shadow-accent-purple/10" 
                      : "border-border-color bg-bg-input text-text-secondary hover:border-text-secondary"
                  }`}
                >
                  <span className="text-xs font-bold">{type.label}</span>
                  <span className="text-[10px] opacity-75">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frente / Pergunta */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">
              {selectedNoteType === "CLOZE" ? "Texto com Cloze (Use {{c1::palavra}})" : "Frente (Pergunta / Termo)"}
            </label>
            <textarea 
              {...register("front")}
              rows={4}
              placeholder={selectedNoteType === "CLOZE" ? "A {{c1::mitocôndria}} é responsável pela síntese de {{c2::ATP}}." : "Ex: O que é a Medallion Architecture?"}
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300 font-sans resize-none"
            />
            {errors.front && <span className="text-again text-xs font-semibold">{errors.front.message}</span>}
          </div>

          {/* Verso / Resposta */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">
              {selectedNoteType === "CLOZE" ? "Notas Extras / Explicação" : "Verso (Resposta / Definição)"}
            </label>
            <textarea 
              {...register("back")}
              rows={3}
              placeholder="Ex: Padrão que organiza os dados em Bronze, Silver e Gold."
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300 font-sans resize-none"
            />
            {errors.back && <span className="text-again text-xs font-semibold">{errors.back.message}</span>}
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Tags (Separadas por vírgula)</label>
            <input 
              {...register("tags")}
              placeholder="databricks, spark, data-engineering"
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-color/60">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-3 rounded-2xl border border-border-color text-text-secondary hover:text-text-primary text-xs font-bold cursor-pointer transition-all duration-200"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-gradient-to-r from-accent-purple to-purple-700 hover:opacity-95 text-white font-bold text-xs px-8 py-3.5 rounded-2xl shadow-lg shadow-accent-purple/20 cursor-pointer transition-all duration-300 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Criar Flashcard na AWS</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
