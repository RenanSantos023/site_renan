'use client';

import React from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dueCount: number;
  setSelectedFolder: (folder: string | null) => void;
  sidebarOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string | null;
  onLogout?: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  dueCount, 
  setSelectedFolder, 
  sidebarOpen, 
  onClose,
  currentUserEmail,
  onLogout
}: SidebarProps) {
  return (
    <aside className={`fixed inset-y-0 left-0 w-64 bg-bg-sidebar border-r border-border-color flex flex-col p-6 z-40 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:w-[250px] lg:flex-shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between mb-8 pl-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-accent-blue text-3xl drop-shadow-[0_0_8px_rgba(63,140,251,0.4)]">
            auto_awesome
          </span>
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-accent-blue bg-clip-text text-transparent">
            UltraCards
          </h1>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-white/5 border-none cursor-pointer flex items-center justify-center"
          title="Fechar menu"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-5 overflow-y-auto">
        <ul className="list-none flex flex-col gap-1.5">
          <li>
            <button 
              onClick={() => setActiveTab("home")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "home" ? "text-text-primary bg-accent-purple/15 shadow-[inset_0_0_1px_1px_#8b5cf6] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-purple before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">home</span>
              <span>Home</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("decks")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "decks" || activeTab === "library" ? "text-text-primary bg-accent-purple/15 shadow-[inset_0_0_1px_1px_#8b5cf6] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-purple before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">folder_open</span>
              <span>Decks</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("study")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "study" || activeTab.startsWith("study-") ? "text-text-primary bg-accent-purple/15 shadow-[inset_0_0_1px_1px_#8b5cf6] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-purple before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">school</span>
              <span>Study</span>
              {dueCount > 0 && (
                <span className="ml-auto bg-again text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(255,74,90,0.4)]">
                  {dueCount}
                </span>
              )}
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("analytics")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "analytics" ? "text-text-primary bg-accent-purple/15 shadow-[inset_0_0_1px_1px_#8b5cf6] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-purple before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">monitoring</span>
              <span>Analytics</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("create")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "create" || activeTab === "ai-generator" ? "text-text-primary bg-accent-purple/15 shadow-[inset_0_0_1px_1px_#8b5cf6] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-purple before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              <span>Criar com IA</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="mt-auto pt-4 border-t border-border-color flex flex-col gap-2">
        <button 
          onClick={() => setActiveTab("settings")} 
          className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 ${activeTab === "settings" ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span>Configurações</span>
        </button>

        {currentUserEmail && (
          <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between border border-border-color/60">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Usuário Conectado</span>
              <span className="text-xs font-semibold text-text-primary truncate" title={currentUserEmail}>
                {currentUserEmail}
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Desconectar da AWS"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
