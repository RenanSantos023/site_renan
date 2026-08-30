'use client';

import React, { useState } from 'react';
import { signInUser, signUpUser, confirmUserSignUp, getAuthSessionToken } from '../amplify-client';

interface AuthViewProps {
  onAuthSuccess: (userEmail: string, token: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'signin' | 'signup' | 'confirm';

export default function AuthView({ onAuthSuccess, showToast }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email || !password) {
      setErrorMessage('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const output = await signInUser(email, password);
      if (output.isSignedIn) {
        const token = await getAuthSessionToken();
        showToast('Login realizado com sucesso!', 'success');
        onAuthSuccess(email, token || '');
      } else if (output.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        showToast('Conta não confirmada. Digite o código enviado para o seu e-mail.', 'info');
        setMode('confirm');
      } else {
        showToast(`Próxima etapa: ${output.nextStep?.signInStep}`, 'info');
      }
    } catch (err: any) {
      console.error('Erro de login:', err);
      const msg = err?.message || 'Falha ao autenticar. Verifique suas credenciais e tente novamente.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Preencha todos os campos obrigatórios.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não conferem.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setErrorMessage('A senha deve conter pelo menos uma letra minúscula (a-z).');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setErrorMessage('A senha deve conter pelo menos uma letra maiúscula (A-Z).');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setErrorMessage('A senha deve conter pelo menos um número (0-9).');
      return;
    }

    setLoading(true);
    try {
      const output = await signUpUser(email, password);
      if (output.isSignUpComplete) {
        showToast('Cadastro realizado! Faça login.', 'success');
        setMode('signin');
      } else {
        showToast('Código de verificação enviado para seu e-mail!', 'success');
        setMode('confirm');
      }
    } catch (err: any) {
      console.error('Erro de cadastro:', err);
      const msg = err?.message || 'Erro ao criar conta. Verifique os dados informados.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !code) {
      setErrorMessage('Informe seu e-mail e o código recebido.');
      return;
    }

    setLoading(true);
    try {
      await confirmUserSignUp(email, code);
      showToast('E-mail verificado com sucesso! Agora você pode entrar.', 'success');
      setMode('signin');
      setCode('');
    } catch (err: any) {
      console.error('Erro de confirmação:', err);
      const msg = err?.message || 'Código inválido ou expirado.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-app p-4 relative overflow-hidden">
      {/* Glow Effects Decorators */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent-blue/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-bg-card/90 backdrop-blur-xl border border-border-color p-8 rounded-3xl shadow-2xl relative z-10 animate-fade-in">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent-blue to-purple-600 flex items-center justify-center text-white shadow-lg shadow-accent-blue/20 mb-4">
            <span className="material-symbols-outlined text-3xl">lock_person</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">Ultra Flashcards</h1>
          <p className="text-xs text-text-secondary mt-1">
            {mode === 'signin' && 'Entre com sua conta Amazon Cognito'}
            {mode === 'signup' && 'Crie sua conta segura na nuvem AWS'}
            {mode === 'confirm' && 'Verificação de segurança por e-mail'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl mb-6 flex items-start gap-2 animate-shake">
            <span className="material-symbols-outlined text-sm mt-0.5">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  required
                  className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-purple-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl mt-2 transition-all duration-300 shadow-lg shadow-accent-blue/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span>Entrar</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-text-secondary mt-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('signup');
                }}
                className="text-accent-blue hover:underline cursor-pointer"
              >
                Não tem conta? Cadastre-se
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('confirm');
                }}
                className="hover:text-text-primary transition-colors cursor-pointer"
              >
                Inserir código
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP FORM */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">Senha</label>
                <span className="text-[10px] text-text-secondary opacity-75">mín. 8 caracteres (A-Z, a-z, 0-9)</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex: MinhaSenha123"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-purple-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl mt-2 transition-all duration-300 shadow-lg shadow-accent-blue/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span>Criar Conta</span>
                  <span className="material-symbols-outlined text-base">person_add</span>
                </>
              )}
            </button>

            <div className="text-center text-xs text-text-secondary mt-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('signin');
                }}
                className="text-accent-blue hover:underline cursor-pointer"
              >
                Já tem uma conta? Entrar
              </button>
            </div>
          </form>
        )}

        {/* CONFIRM SIGN UP FORM */}
        {mode === 'confirm' && (
          <form onSubmit={handleConfirm} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Código de Confirmação</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 123456"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary text-center tracking-widest font-mono outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-purple-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl mt-2 transition-all duration-300 shadow-lg shadow-accent-blue/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span>Verificar Código</span>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                </>
              )}
            </button>

            <div className="text-center text-xs text-text-secondary mt-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('signin');
                }}
                className="text-accent-blue hover:underline cursor-pointer"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
