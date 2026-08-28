'use client';

import React from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dueCount: number;
  setSelectedFolder: (folder: string | null) => void;
}

export default function Sidebar({ activeTab, setActiveTab, dueCount, setSelectedFolder }: SidebarProps) {
  return (
    <aside className="w-[250px] bg-bg-sidebar border-r border-border-color flex flex-col p-6 flex-shrink-0 z-10">
      <div className="flex items-center gap-3 mb-8 pl-2">
        <span className="material-symbols-outlined text-accent-blue text-3xl drop-shadow-[0_0_8px_rgba(63,140,251,0.4)]">
          auto_awesome
        </span>
        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-accent-blue bg-clip-text text-transparent">
          UltraCards
        </h1>
      </div>

      <nav className="flex-1 flex flex-col gap-5 overflow-y-auto">
        <ul className="list-none flex flex-col gap-1.5">
          <li>
            <button 
              onClick={() => { setSelectedFolder(null); setActiveTab("library"); }} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "home" ? "text-text-primary bg-white/5" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">home</span>
              <span>Página inicial</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => { setSelectedFolder(null); setActiveTab("library"); }} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "library" ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-blue before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">folder_open</span>
              <span>Sua biblioteca</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("study")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "study" || activeTab.startsWith("study-") ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-blue before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">school</span>
              <span>Estudar Cartões</span>
              {dueCount > 0 && (
                <span className="ml-auto bg-again text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(255,74,90,0.4)]">
                  {dueCount}
                </span>
              )}
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("create")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "create" ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-blue before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">add_box</span>
              <span>Criar Nota</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("ai-generator")} 
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 relative ${activeTab === "ai-generator" ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb] before:content-[''] before:absolute before:left-0 before:top-[25%] before:h-1/2 before:w-1 before:bg-accent-blue before:rounded-[0_4px_4px_0]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
            >
              <span className="material-symbols-outlined text-[22px]">psychology</span>
              <span>Mineração por IA</span>
            </button>
          </li>
        </ul>

        <hr className="border-none border-t border-border-color my-2" />

        <div className="text-[11px] font-extrabold text-text-disabled uppercase tracking-widest pl-4 mb-2">
          Minhas Pastas
        </div>
        <ul className="list-none flex flex-col gap-1.5 secondary-list">
          <li>
            <button 
              onClick={() => setSelectedFolder("vocabulario")} 
              className="w-full flex items-center gap-3.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-left text-text-secondary hover:text-text-primary hover:bg-white/4 cursor-pointer transition-all duration-300"
            >
              <span className="material-symbols-outlined text-[20px]">folder</span>
              <span>Inglês Vocab</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setSelectedFolder("enem")} 
              className="w-full flex items-center gap-3.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-left text-text-secondary hover:text-text-primary hover:bg-white/4 cursor-pointer transition-all duration-300"
            >
              <span className="material-symbols-outlined text-[20px]">folder</span>
              <span>ENEM</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="mt-auto pt-4 border-t border-border-color">
        <button 
          onClick={() => setActiveTab("settings")} 
          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-300 ${activeTab === "settings" ? "text-text-primary bg-accent-blue/15 shadow-[inset_0_0_1px_1px_#3f8cfb]" : "text-text-secondary hover:text-text-primary hover:bg-white/4"}`}
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
          <span>Configurações API</span>
        </button>
      </div>
    </aside>
  );
}
