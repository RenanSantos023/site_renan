'use client';

import React, { useState } from "react";
import type { Note, Card } from "../../amplify/data/resource";
import { getAuthSessionToken } from "../amplify-client";

interface CreateHubViewProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onCreateNotes: (notes: Note[], cards: Card[]) => void;
  onCancel: () => void;
  initialDeckId?: string;
  initialPrompt?: string;
}

type SourceType =
  | "text"
  | "file"
  | "link"
  | "youtube"
  | "image"
  | "scan"
  | "voice"
  | "manual"
  | "external"
  | "import";

export default function CreateHubView({
  showToast,
  onCreateNotes,
  onCancel,
  initialDeckId = "",
  initialPrompt = ""
}: CreateHubViewProps) {
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [deckId, setDeckId] = useState<string>(initialDeckId || "geral");
  const [contentInput, setContentInput] = useState<string>(initialPrompt || "");
  const [manualFront, setManualFront] = useState<string>("");
  const [manualBack, setManualBack] = useState<string>("");
  const [noteType, setNoteType] = useState<"BASIC" | "BASIC_REVERSED" | "CLOZE">("BASIC");
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedPreview, setGeneratedPreview] = useState<Array<{ Front: string; Back: string; noteType: string }>>([]);

  const sourcesList: Array<{ type: SourceType; icon: string; label: string; desc: string }> = [
    { type: "text", icon: "edit_note", label: "Colar Texto", desc: "Artigos, anotações ou resumos" },
    { type: "file", icon: "upload_file", label: "Arquivo", desc: "PDF, DOCX, PPTX" },
    { type: "link", icon: "link", label: "Link Web", desc: "URL de página ou artigo" },
    { type: "youtube", icon: "smart_display", label: "YouTube", desc: "Vídeo com transcrição" },
    { type: "image", icon: "image", label: "Imagem", desc: "Infográficos e diagramas" },
    { type: "scan", icon: "document_scanner", label: "Escanear Doc", desc: "Captura pela câmera" },
    { type: "voice", icon: "mic", label: "Comando de Voz", desc: "Fale com a IA" },
    { type: "manual", icon: "edit", label: "Manual Q&A", desc: "Frente e verso direto" },
    { type: "external", icon: "smart_toy", label: "Saída Externa", desc: "Prompt de IA" },
    { type: "import", icon: "data_object", label: "Importar JSON", desc: "Anki / CSV / JSON" }
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === "manual") {
      if (!manualFront.trim() || !manualBack.trim()) {
        showToast("Preencha a pergunta e a resposta do cartão.", "error");
        return;
      }
      setGeneratedPreview([{ Front: manualFront.trim(), Back: manualBack.trim(), noteType }]);
      return;
    }

    if (!contentInput.trim()) {
      showToast("Informe o conteúdo para a geração com IA.", "error");
      return;
    }

    setLoading(true);
    const apiMode = localStorage.getItem("ultra_api_mode") || "mock";
    const apiUrl = localStorage.getItem("ultra_api_url") || "";
    const userId = localStorage.getItem("ultra_user_id") || "usr_dev_default";

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
            text: contentInput,
            target_deck_id: deckId.trim().toLowerCase()
          })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        const extracted = (data.generated_notes || []).map((n: any) => ({
          Front: n.fields?.Front || "Pergunta gerada",
          Back: n.fields?.Back || "Resposta gerada",
          noteType: n.note_type || "BASIC"
        }));
        setGeneratedPreview(extracted);
      } catch {
        showToast("Simulando extração de IA via Amazon Bedrock localmente.", "info");
        simulateAiGeneration();
      }
    } else {
      simulateAiGeneration();
    }

    setLoading(false);
  };

  const simulateAiGeneration = () => {
    const lines = contentInput.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 12);
    const simulated: Array<{ Front: string; Back: string; noteType: string }> = [];

    lines.slice(0, 4).forEach((sentence, idx) => {
      simulated.push({
        Front: `Conceito ${idx + 1}: O que define "${sentence.substring(0, 35)}..."?`,
        Back: sentence,
        noteType: "BASIC"
      });
    });

    if (simulated.length === 0) {
      simulated.push({
        Front: `Qual é o foco principal abordado em "${deckId}"?`,
        Back: contentInput,
        noteType: "BASIC"
      });
    }

    setGeneratedPreview(simulated);
    showToast(`${simulated.length} flashcards gerados pela IA! Revise abaixo.`, "success");
  };

  const handleUpdateCardField = (index: number, field: "Front" | "Back", value: string) => {
    setGeneratedPreview(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const handleDeletePreviewCard = (index: number) => {
    setGeneratedPreview(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmAndSave = () => {
    if (generatedPreview.length === 0) return;

    const newNotes: Note[] = [];
    const newCards: Card[] = [];
    const targetDeck = deckId.trim().toLowerCase() || "geral";
    const timestamp = new Date().toISOString();

    generatedPreview.forEach((item, idx) => {
      const noteId = "not_" + Math.random().toString(36).substr(2, 9);
      const cardId = "crd_" + Math.random().toString(36).substr(2, 9);

      const note: Note = {
        noteId,
        deckId: targetDeck,
        noteType: item.noteType as any,
        fields: { Front: item.Front, Back: item.Back },
        tags: ["ia-bedrock", targetDeck],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const card: Card = {
        cardId,
        noteId,
        deckId: targetDeck,
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
    showToast(`${newNotes.length} cartões importados com sucesso para o deck "${targetDeck}"!`, "success");
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-12 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-border-color pb-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-purple text-3xl">auto_awesome</span>
            <span>Hub de Criação & Mineração por IA</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Escolha uma das 10 fontes de entrada e transforme qualquer conteúdo em flashcards inteligentes.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="p-2 text-text-secondary hover:text-text-primary rounded-xl hover:bg-white/5 cursor-pointer text-xs font-bold flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">close</span>
          <span>Fechar</span>
        </button>
      </div>

      {/* 10 INGESTION SOURCES CAROUSEL / GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {sourcesList.map(s => {
          const isSelected = sourceType === s.type;
          return (
            <button
              key={s.type}
              onClick={() => {
                setSourceType(s.type);
                setGeneratedPreview([]);
              }}
              className={`p-3.5 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all duration-200 cursor-pointer ${isSelected ? "bg-accent-purple/20 border-accent-purple text-text-primary shadow-lg shadow-accent-purple/15 scale-102" : "bg-bg-card border-border-color text-text-secondary hover:text-text-primary hover:border-accent-purple/40"}`}
            >
              <span className={`material-symbols-outlined text-2xl ${isSelected ? "text-accent-purple" : ""}`}>
                {s.icon}
              </span>
              <span className="text-xs font-bold">{s.label}</span>
              <span className="text-[10px] opacity-75 truncate max-w-full">{s.desc}</span>
            </button>
          );
        })}
      </div>

      {/* INPUT FORM CONTAINER */}
      <div className="bg-bg-card border border-border-color p-6 md:p-8 rounded-3xl shadow-xl flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Baralho de Destino</label>
            <input
              type="text"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              placeholder="ex: python, databricks, biologia..."
              className="bg-bg-input border border-border-color text-text-primary text-sm px-4 py-3 rounded-xl outline-none focus:border-accent-purple"
            />
          </div>

          {sourceType === "manual" && (
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Tipo de Cartão</label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as any)}
                className="bg-bg-input border border-border-color text-text-primary text-sm px-4 py-3 rounded-xl outline-none focus:border-accent-purple cursor-pointer"
              >
                <option value="BASIC">Básico (Pergunta e Resposta)</option>
                <option value="BASIC_REVERSED">Básico e Invertido (2 Cards)</option>
                <option value="CLOZE">Omissão de Palavras (Cloze)</option>
              </select>
            </div>
          )}
        </div>

        {/* INPUT DE ACORDO COM A FONTE */}
        {sourceType === "manual" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Pergunta / Frente</label>
              <textarea
                value={manualFront}
                onChange={(e) => setManualFront(e.target.value)}
                placeholder="Digite a pergunta ou o conceito..."
                rows={3}
                className="bg-bg-input border border-border-color text-text-primary text-sm p-4 rounded-xl outline-none focus:border-accent-purple"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Resposta / Verso</label>
              <textarea
                value={manualBack}
                onChange={(e) => setManualBack(e.target.value)}
                placeholder="Digite a resposta ou explicação detalhada..."
                rows={3}
                className="bg-bg-input border border-border-color text-text-primary text-sm p-4 rounded-xl outline-none focus:border-accent-purple"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary uppercase">
              {sourceType === "link" && "URL do Artigo ou Documentação Web"}
              {sourceType === "youtube" && "Link do Vídeo do YouTube"}
              {sourceType === "file" && "Conteúdo extraído do Arquivo (PDF/DOCX)"}
              {sourceType === "voice" && "Transcrição do Comando de Voz"}
              {sourceType === "text" && "Texto para Mineração Automática via IA"}
              {sourceType === "image" && "Descrição ou Texto extraído da Imagem"}
              {sourceType === "scan" && "Texto do Documento Escaneado"}
              {sourceType === "external" && "Payload / Saída de IA Externa"}
              {sourceType === "import" && "Cole o JSON ou CSV dos Flashcards"}
            </label>
            <textarea
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder={
                sourceType === "youtube"
                  ? "https://www.youtube.com/watch?v=..."
                  : sourceType === "link"
                  ? "https://exemplo.com/artigo-tecnico"
                  : "Cole o texto aqui e a IA fará a extração dos cartões..."
              }
              rows={5}
              className="bg-bg-input border border-border-color text-text-primary text-sm p-4 rounded-2xl outline-none focus:border-accent-purple"
            />
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-95 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer disabled:opacity-50 transition-all duration-300"
        >
          {loading ? (
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">bolt</span>
              <span>{sourceType === "manual" ? "Adicionar Cartão ao Preview" : "Minerar Flashcards com IA"}</span>
            </>
          )}
        </button>
      </div>

      {/* PREVIEW & CARD APPROVAL INTERFACE */}
      {generatedPreview.length > 0 && (
        <div className="bg-bg-card border border-accent-purple/40 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-border-color pb-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-easy">verified</span>
                <span>Revisão Prévia ({generatedPreview.length} Cartões Prontos)</span>
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Revise, edite ou exclua cartões antes de confirmar a importação para o seu baralho.
              </p>
            </div>

            <button
              onClick={handleConfirmAndSave}
              className="bg-easy hover:bg-easy/90 text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-easy/20 cursor-pointer transition-all duration-200"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Salvar no Baralho</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedPreview.map((card, idx) => (
              <div
                key={idx}
                className="bg-bg-input p-5 rounded-2xl border border-border-color flex flex-col justify-between gap-4 relative group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-accent-purple uppercase">Card #{idx + 1}</span>
                    <button
                      onClick={() => handleDeletePreviewCard(idx)}
                      className="p-1.5 text-text-disabled hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer"
                      title="Excluir este card"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Frente (Pergunta)</span>
                    <input
                      type="text"
                      value={card.Front}
                      onChange={(e) => handleUpdateCardField(idx, "Front", e.target.value)}
                      className="bg-bg-card border border-border-color text-text-primary text-xs p-2.5 rounded-xl outline-none focus:border-accent-purple"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Verso (Resposta)</span>
                    <textarea
                      value={card.Back}
                      rows={2}
                      onChange={(e) => handleUpdateCardField(idx, "Back", e.target.value)}
                      className="bg-bg-card border border-border-color text-text-primary text-xs p-2.5 rounded-xl outline-none focus:border-accent-purple"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmAndSave}
              className="bg-easy hover:bg-easy/90 text-white font-bold text-sm px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-easy/25 cursor-pointer transition-all duration-200"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>Confirmar e Salvar {generatedPreview.length} Flashcards</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
