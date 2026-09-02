'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DeleteDeckModalProps {
  isOpen: boolean;
  deckTitle: string;
  deckId: string;
  onClose: () => void;
  onConfirmDelete: (deckId: string) => Promise<void>;
}

export const DeleteDeckModal: React.FC<DeleteDeckModalProps> = ({
  isOpen,
  deckTitle,
  deckId,
  onClose,
  onConfirmDelete
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
      setIsLoading(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toLowerCase() === 'excluir';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      await onConfirmDelete(deckId);
      onClose();
    } catch (err: any) {
      console.error('Erro ao excluir baralho:', err);
      setError(err.message || 'Não foi possível excluir o baralho. Tente novamente.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-deck-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-bg-card border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <div>
              <h2 id="delete-deck-title" className="text-lg font-bold text-text-primary">
                Excluir Baralho
              </h2>
              <p className="text-xs text-text-secondary">
                Ação irreversível de acervo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Warning text */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-300 flex flex-col gap-2">
          <p>
            Você está prestes a excluir permanentemente o baralho <strong className="text-white font-bold">&ldquo;{deckTitle}&rdquo;</strong>.
          </p>
          <p className="text-[11px] text-red-300/80">
            Todos os flashcards, notas e históricos de estudo deste baralho serão removidos.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-3 text-xs text-red-400 font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-delete-input" className="text-xs font-semibold text-text-secondary">
              Digite <strong className="text-red-400 font-black">excluir</strong> para confirmar:
            </label>
            <input
              id="confirm-delete-input"
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isLoading}
              placeholder="Digite excluir"
              autoComplete="off"
              className="w-full bg-bg-input border border-border-color focus:border-red-500 text-text-primary text-sm px-4 py-3 rounded-2xl outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-border-color text-text-secondary hover:text-text-primary text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isConfirmed || isLoading}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Confirmar exclusão</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
