'use client';

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import LibraryView from "./LibraryView";
import StudyView from "./StudyView";
import CreateNoteView from "./CreateNoteView";
import AiGeneratorView from "./AiGeneratorView";
import SettingsView from "./SettingsView";
import ToastContainer, { Toast } from "./Toast";
import type { Note, Card } from "../../amplify/data/resource";
import { getAmplifyClient } from "../amplify-client";

interface DashboardProps {
  initialNotes: Note[];
  initialCards: Card[];
}

export default function Dashboard({ initialNotes, initialCards }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [activeTab, setActiveTab] = useState<string>("library");
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Carregar dados salvos no LocalStorage (modo Mock) ao montar
  useEffect(() => {
    const isMock = localStorage.getItem("ultra_api_mode") !== "aws";
    if (isMock) {
      const storedNotes = localStorage.getItem("ultra_notes");
      const storedCards = localStorage.getItem("ultra_cards");
      if (storedNotes) setNotes(JSON.parse(storedNotes));
      if (storedCards) setCards(JSON.parse(storedCards));
    } else {
      // Se for AWS, carregar dinamicamente usando o cliente do Amplify
      const client = getAmplifyClient() as any;
      Promise.all([
        client.models.Note.list(),
        client.models.Card.list()
      ]).then(([notesRes, cardsRes]) => {
        if (notesRes.data) setNotes(notesRes.data);
        if (cardsRes.data) setCards(cardsRes.data);
      }).catch(err => {
        showToast("Falha ao carregar dados do AWS Amplify, usando mock.", "error");
      });
    }
  }, [activeTab]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const newToast: Toast = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Contagem de cards devidos (NEW ou dueDate expirada)
  const getDueCardsCount = () => {
    const now = new Date();
    return cards.filter(c => !c.dueDate || new Date(c.dueDate) <= now).length;
  };

  const handleCreateNoteLocal = (newNote: Note, newCards: Card[]) => {
    setNotes(prev => [...prev, newNote]);
    setCards(prev => [...prev, ...newCards]);
    showToast("Nota e cartões criados com sucesso!", "success");
  };

  const handleReviewCardLocal = (cardId: string, updatedCardData: Partial<Card>) => {
    setCards(prev => prev.map(c => c.cardId === cardId ? { ...c, ...updatedCardData } as Card : c));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app text-text-primary">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        dueCount={getDueCardsCount()} 
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        setSelectedFolder={(folder: string | null) => {
          setSelectedFolder(folder);
          setActiveTab("library");
          setSidebarOpen(false); // fechar no mobile após selecionar
        }}
      />

      {/* ÁREA CENTRAL */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Topbar 
          onSearchChange={setGlobalSearch} 
          searchValue={globalSearch} 
          onCreateClick={() => setActiveTab("create")}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* EXIBIÇÃO DE SEÇÃO DENTRO DA SPA */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "library" && (
            <LibraryView 
              notes={notes} 
              cards={cards} 
              searchQuery={globalSearch}
              selectedFolder={selectedFolder}
              clearFolderFilter={() => setSelectedFolder(null)}
              onStudyCard={(cardId: string) => {
                // Iniciar estudo focado em um card específico
                setActiveTab(`study-${cardId}`);
              }}
            />
          )}

          {activeTab === "study" && (
            <StudyView 
              notes={notes} 
              cards={cards} 
              showToast={showToast}
              onReviewCard={handleReviewCardLocal}
              onFinished={() => setActiveTab("library")}
            />
          )}

          {activeTab.startsWith("study-") && (
            <StudyView 
              notes={notes} 
              cards={cards} 
              showToast={showToast}
              onReviewCard={handleReviewCardLocal}
              onFinished={() => setActiveTab("library")}
              singleCardId={activeTab.replace("study-", "")}
            />
          )}

          {activeTab === "create" && (
            <CreateNoteView 
              showToast={showToast} 
              onCreateNote={handleCreateNoteLocal} 
              onCancel={() => setActiveTab("library")}
            />
          )}

          {activeTab === "ai-generator" && (
            <AiGeneratorView 
              showToast={showToast} 
              onCreateNotes={(newNotes: Note[], newCards: Card[]) => {
                setNotes(prev => [...prev, ...newNotes]);
                setCards(prev => [...prev, ...newCards]);
                setActiveTab("library");
              }}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView showToast={showToast} />
          )}
        </div>

        {/* FAB DE IA RÁPIDA */}
        <button 
          onClick={() => setActiveTab("ai-generator")}
          className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-accent-blue to-purple-700 text-white border-none cursor-pointer shadow-lg hover:shadow-xl shadow-accent-blue/30 hover:scale-108 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-300 z-50 group"
          title="Mineração rápida via IA"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform duration-300">bolt</span>
        </button>

        {/* TOASTS CONTÉM NOTIFICAÇÕES */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </main>
    </div>
  );
}
