'use client';

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import HomeView from "./HomeView";
import DecksView from "./DecksView";
import StudyView from "./StudyView";
import AnalyticsView from "./AnalyticsView";
import CreateHubView from "./CreateHubView";
import SettingsView from "./SettingsView";
import AuthView from "./AuthView";
import ToastContainer, { Toast } from "./Toast";
import type { Note, Card, Deck, AnalyticsSummaryResponse } from "../../amplify/data/resource";
import { getCurrentAuthenticatedUser, signOutUser, configureAmplifyAuth } from "../amplify-client";

import { 
  apiFetchDecks, 
  apiFetchDueCards, 
  apiFetchAnalyticsSummary, 
  apiCreateBatchNotes 
} from "../../utils/api";

interface DashboardProps {
  initialNotes: Note[];
  initialCards: Card[];
}

export default function Dashboard({ initialNotes, initialCards }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummaryResponse | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>("home");
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedDeckForStudy, setSelectedDeckForStudy] = useState<string | null>(null);
  const [quickPromptText, setQuickPromptText] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Estados de Autenticação com Amazon Cognito
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Função centralizada para recarregar dados diretamente do API Gateway / DynamoDB
  const refreshAllData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [decksRes, dueCardsRes, analyticsRes] = await Promise.allSettled([
        apiFetchDecks(),
        apiFetchDueCards(),
        apiFetchAnalyticsSummary()
      ]);

      if (decksRes.status === "fulfilled") {
        setDecks(decksRes.value);
      }

      if (dueCardsRes.status === "fulfilled") {
        setCards(dueCardsRes.value.cards);
        setNotes(dueCardsRes.value.notes);
      }

      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value);
      }
    } catch (err) {
      console.warn("Aviso ao sincronizar dados com o API Gateway:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Verificar status de autenticação no Cognito ao montar
  useEffect(() => {
    const checkAuthStatus = async () => {
      configureAmplifyAuth();
      try {
        const user = await getCurrentAuthenticatedUser();
        if (user) {
          setIsAuthenticated(true);
          setUserEmail(user.signInDetails?.loginId || user.username || "Usuário AWS");
        } else {
          setIsAuthenticated(false);
          setUserEmail(null);
        }
      } catch (e) {
        setIsAuthenticated(false);
        setUserEmail(null);
      }
      setAuthChecking(false);
    };

    checkAuthStatus();
  }, []);

  // Carregar dados do API Gateway ao inicializar e ao trocar de aba principal
  useEffect(() => {
    if (!authChecking && isAuthenticated) {
      refreshAllData();
    }
  }, [authChecking, isAuthenticated, activeTab, refreshAllData]);

  const handleLogout = async () => {
    await signOutUser();
    setIsAuthenticated(false);
    setUserEmail(null);
    showToast("Sessão encerrada com sucesso no Amazon Cognito.", "info");
  };

  const handleAuthSuccess = (email: string) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    showToast(`Bem-vindo, ${email}!`, "success");
    refreshAllData();
  };

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

  // Contagem de cards devidos
  const getDueCardsCount = () => {
    const now = new Date();
    return cards.filter(c => !c.dueDate || new Date(c.dueDate) <= now).length;
  };

  const handleCreateNotesBatch = async (newNotes: Note[], newCards: Card[]) => {
    try {
      await apiCreateBatchNotes(newNotes.map(n => ({
        deck_id: n.deckId,
        note_type: n.noteType || "BASIC",
        fields: n.fields,
        tags: n.tags || []
      })));
      showToast("Cartões persistidos com sucesso no DynamoDB da AWS!", "success");
      await refreshAllData();
    } catch (err: any) {
      showToast(`Erro ao gravar no DynamoDB: ${err.message}`, "error");
    }

    setActiveTab("decks");
  };

  const handleReviewCardLocal = async (cardId: string, updatedCardData: Partial<Card>) => {
    setCards(prev => prev.map(c => c.cardId === cardId ? { ...c, ...updatedCardData } as Card : c));
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotes(prev => prev.filter(n => n.noteId !== noteId));
    setCards(prev => prev.filter(c => c.noteId !== noteId));
    showToast("Nota excluída no acervo.", "info");
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-app text-text-primary">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span className="material-symbols-outlined text-accent-purple text-4xl animate-spin">
            progress_activity
          </span>
          <span className="text-sm font-semibold text-text-secondary">Conectando ao Amazon Cognito & AWS Cloud...</span>
        </div>
      </div>
    );
  }

  // Se não autenticado no Cognito, exibe a tela de login/cadastro da AWS
  if (!isAuthenticated) {
    return (
      <>
        <AuthView 
          onAuthSuccess={handleAuthSuccess}
          showToast={showToast}
        />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

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
        setActiveTab={(tab: string) => {
          if (tab === "study") setSelectedDeckForStudy(null);
          setActiveTab(tab);
        }} 
        dueCount={getDueCardsCount()} 
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUserEmail={userEmail}
        onLogout={handleLogout}
        setSelectedFolder={(folder: string | null) => {
          setSelectedFolder(folder);
          setActiveTab("decks");
          setSidebarOpen(false);
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

        {/* EXIBIÇÃO DE SEÇÕES SPA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* 1. HOME VIEW */}
          {activeTab === "home" && (
            <HomeView
              notes={notes}
              cards={cards}
              decks={decks}
              analytics={analytics}
              userName={userEmail ? userEmail.split("@")[0] : "Usuário"}
              onStartStudy={(deckId) => {
                setSelectedDeckForStudy(deckId || null);
                setActiveTab("study");
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onQuickStartPrompt={(promptText) => {
                setQuickPromptText(promptText);
                setActiveTab("create");
              }}
            />
          )}

          {/* 2. DECKS VIEW */}
          {(activeTab === "decks" || activeTab === "library") && (
            <DecksView 
              notes={notes} 
              cards={cards} 
              onStudyDeck={(deckId) => {
                setSelectedDeckForStudy(deckId);
                setActiveTab("study");
              }}
              onCreateDeck={() => setActiveTab("create")}
              onAddCardsToDeck={(deckId) => {
                setSelectedFolder(deckId);
                setActiveTab("create");
              }}
              onDeleteNote={handleDeleteNote}
              showToast={showToast}
            />
          )}

          {/* 3. STUDY VIEW */}
          {activeTab === "study" && (
            <StudyView 
              notes={notes} 
              cards={cards} 
              showToast={showToast}
              selectedDeckId={selectedDeckForStudy}
              onReviewCard={handleReviewCardLocal}
              onFinished={() => {
                refreshAllData();
                setActiveTab("home");
              }}
            />
          )}

          {activeTab.startsWith("study-") && (
            <StudyView 
              notes={notes} 
              cards={cards} 
              showToast={showToast}
              onReviewCard={handleReviewCardLocal}
              onFinished={() => {
                refreshAllData();
                setActiveTab("decks");
              }}
              singleCardId={activeTab.replace("study-", "")}
            />
          )}

          {/* 4. ANALYTICS VIEW */}
          {activeTab === "analytics" && (
            <AnalyticsView
              notes={notes}
              cards={cards}
              analyticsData={analytics}
              onStartRecommendedStudy={() => {
                setSelectedDeckForStudy(null);
                setActiveTab("study");
              }}
            />
          )}

          {/* 5. CREATE & AI GENERATOR HUB */}
          {(activeTab === "create" || activeTab === "ai-generator") && (
            <CreateHubView 
              showToast={showToast} 
              initialDeckId={selectedFolder || "geral"}
              initialPrompt={quickPromptText}
              onCreateNotes={handleCreateNotesBatch}
              onCancel={() => {
                setQuickPromptText("");
                setActiveTab("home");
              }}
            />
          )}

          {/* 6. SETTINGS VIEW */}
          {activeTab === "settings" && (
            <SettingsView showToast={showToast} />
          )}

        </div>

        {/* FAB DE IA RÁPIDA */}
        <button 
          onClick={() => {
            setQuickPromptText("");
            setActiveTab("create");
          }}
          className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple text-white border-none cursor-pointer shadow-xl hover:shadow-accent-purple/40 hover:scale-108 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-300 z-50 group"
          title="Mineração rápida via IA"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform duration-300">auto_awesome</span>
        </button>

        {/* TOASTS CONTÊM NOTIFICAÇÕES */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </main>
    </div>
  );
}
