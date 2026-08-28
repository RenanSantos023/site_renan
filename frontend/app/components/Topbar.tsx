'use client';

import React from "react";

interface TopbarProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  onCreateClick: () => void;
  onMenuClick: () => void;
}

export default function Topbar({ searchValue, onSearchChange, onCreateClick, onMenuClick }: TopbarProps) {
  return (
    <header className="h-[70px] border-b border-border-color flex items-center justify-between px-4 lg:px-8 flex-shrink-0 gap-3">
      <div className="flex items-center">
        {/* Mobile Menu Hamburger Button */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full border-none cursor-pointer flex items-center justify-center mr-2"
          title="Abrir menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        {/* Search Input Container */}
        <div className="flex items-center bg-bg-input border border-border-color rounded-full px-4 lg:px-[18px] py-1.5 w-full max-w-[320px] lg:max-w-[420px] focus-within:bg-bg-input-focus focus-within:border-accent-blue focus-within:shadow-[0_0_10px_rgba(63,140,251,0.15)] transition-all duration-300">
          <span className="material-symbols-outlined text-text-secondary text-lg lg:text-xl mr-2">
            search
          </span>
          <input 
            type="text" 
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar baralhos, tags..." 
            className="bg-transparent border-none text-text-primary text-[13px] w-full outline-none placeholder:text-text-disabled"
          />
        </div>
      </div>

      {/* Topbar Actions */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Quick Add Button */}
        <button 
          onClick={onCreateClick}
          className="w-9 h-9 p-0 flex items-center justify-center bg-bg-card border border-border-color text-text-primary rounded-full hover:border-accent-blue hover:bg-accent-blue/10 hover:shadow-[0_0_12px_rgba(63,140,251,0.4)] cursor-pointer transition-all duration-300"
          title="Criar nova nota"
        >
          <span className="material-symbols-outlined text-lg">add</span>
        </button>

        {/* Upgrade Button */}
        <button className="sm:inline-block hidden bg-accent-yellow hover:bg-accent-yellow/90 text-[#0b0a1d] text-[13px] font-bold px-5 py-2.5 rounded-full shadow-[0_4px_14px_rgba(255,205,31,0.25)] hover:shadow-[0_6px_18px_rgba(255,205,31,0.4)] hover:-translate-y-0.5 cursor-pointer transition-all duration-300">
          <span>Upgrade</span>
        </button>

        {/* User Profile */}
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-accent-blue text-white flex items-center justify-center text-[13px] font-bold border-2 border-border-color">
            US
          </div>
        </div>
      </div>
    </header>
  );
}
