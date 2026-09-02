'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiCreateDeck } from '../../utils/api';
import type { Deck } from '../../amplify/data/resource';

interface CreateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated: (newDeck: Deck) => void;
  showToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const CreateDeckModal: React.FC<CreateDeckModalProps> = ({
  isOpen,
  onClose,
  onDeckCreated,
  showToast
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus inicial automático e reset de estados ao abrir
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setNameError(null);
      setDescError(null);
      setGlobalError(null);
      setIsLoading(false);

      // Timeout para garantir que o elemento foi montado e renderizado
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fechamento via tecla ESC e focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isLoading) {
          onClose();
        }
      } else if (e.key === 'Tab' && modalRef.current) {
        // Focus trap
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    let isValid = true;
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setNameError('Informe um nome para o baralho.');
      isValid = false;
    } else if (trimmedName.length > 100) {
      setNameError('O nome deve ter no máximo 100 caracteres.');
      isValid = false;
    } else {
      setNameError(null);
    }

    if (trimmedDesc.length > 500) {
      setDescError('A descrição deve ter no máximo 500 caracteres.');
      isValid = false;
    } else {
      setDescError(null);
    }

    return isValid;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (nameError) {
      if (val.trim() && val.trim().length <= 100) {
        setNameError(null);
      }
    }
    if (globalError) setGlobalError(null);
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);
    if (descError && val.trim().length <= 500) {
      setDescError(null);
    }
    if (globalError) setGlobalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!validate()) return;

    setIsLoading(true);
    setGlobalError(null);

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    try {
      const newDeck = await apiCreateDeck({
        name: trimmedName,
        title: trimmedName,
        description: trimmedDesc,
      });

      if (showToast) {
        showToast('success', 'Baralho criado!', `O baralho "${trimmedName}" foi criado com sucesso.`);
      }

      onDeckCreated(newDeck);
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar baralho:', err);
      const msg = err.message || 'Não foi possível criar o baralho. Tente novamente.';
      setGlobalError(msg);
      if (showToast) {
        showToast('error', 'Erro ao criar baralho', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="create-deck-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-bg-card border border-border-color rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-purple/10 flex items-center justify-center text-accent-purple">
              <span className="material-symbols-outlined text-2xl">style</span>
            </div>
            <div>
              <h2 id="create-deck-title" className="text-xl font-bold text-text-primary">
                Criar novo baralho
              </h2>
              <p className="text-xs text-text-secondary">
                Dê um nome e descrição para começar seu acervo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar modal"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-input/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-xs animate-shake">
            <span className="material-symbols-outlined text-lg flex-shrink-0">error</span>
            <div className="flex-1">
              <p className="font-semibold">{globalError}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nome Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="deck-name-input" className="text-xs font-semibold text-text-secondary">
                Nome <span className="text-accent-purple font-bold">*</span>
              </label>
              <span className={`text-[11px] ${name.length > 100 ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                {name.length}/100
              </span>
            </div>

            <input
              id="deck-name-input"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={handleNameChange}
              disabled={isLoading}
              maxLength={120}
              placeholder="Ex: Inglês - Verbos Irregulares"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'deck-name-error' : undefined}
              className={`w-full bg-bg-input border ${
                nameError ? 'border-red-500/60 focus:border-red-500' : 'border-border-color focus:border-accent-purple'
              } text-text-primary text-sm px-4 py-3 rounded-2xl outline-none focus:bg-bg-card transition-all duration-200 disabled:opacity-60`}
            />

            {nameError && (
              <p id="deck-name-error" className="text-xs text-red-400 mt-0.5 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-sm">warning</span>
                {nameError}
              </p>
            )}
          </div>

          {/* Descrição Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="deck-desc-input" className="text-xs font-semibold text-text-secondary">
                Descrição <span className="text-text-secondary/70 font-normal">(opcional)</span>
              </label>
              <span className={`text-[11px] ${description.length > 500 ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                {description.length}/500
              </span>
            </div>

            <textarea
              id="deck-desc-input"
              rows={3}
              value={description}
              onChange={handleDescChange}
              disabled={isLoading}
              maxLength={600}
              placeholder="Sobre o que é este baralho? Adicione contexto ou objetivos de estudo..."
              aria-invalid={Boolean(descError)}
              aria-describedby={descError ? 'deck-desc-error' : undefined}
              className={`w-full bg-bg-input border ${
                descError ? 'border-red-500/60 focus:border-red-500' : 'border-border-color focus:border-accent-purple'
              } text-text-primary text-sm p-4 rounded-2xl outline-none focus:bg-bg-card transition-all duration-200 resize-none disabled:opacity-60`}
            />

            {descError && (
              <p id="deck-desc-error" className="text-xs text-red-400 mt-0.5 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-sm">warning</span>
                {descError}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-3 pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-2xl border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-input transition-all text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-95 text-white text-sm font-bold px-6 py-2.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/20 cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  <span>Criar baralho</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
