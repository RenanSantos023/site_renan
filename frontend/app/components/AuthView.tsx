'use client';

import React, { useState, useEffect } from 'react';
import { 
  signInUser, 
  confirmUserSignUp, 
  resendUserSignUpCode,
  resetUserPassword,
  confirmUserResetPassword,
  getAuthSessionToken 
} from '../amplify-client';

import { criarUsuario , confirmarUsuario , entrarUsuario} from '../../services/auth';

interface AuthViewProps {
  onAuthSuccess: (userEmail: string, token: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'forgot_confirm';

export default function AuthView({ onAuthSuccess, showToast }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Decrement resend cooldown timer every second
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function formatAuthError(err: any, defaultMsg: string): string {
    const errorName = err?.name || '';
    const errorMsg = err?.message || '';

    if (errorName === 'UsernameExistsException' || errorMsg.includes('User already exists') || errorMsg.includes('UsernameExistsException')) {
      return 'Este e-mail já está cadastrado. Alterne para a aba "Entrar" para fazer login.';
    }
    if (errorName === 'UserNotConfirmedException' || errorMsg.includes('User is not confirmed')) {
      return 'Sua conta ainda não foi confirmada. Digite o código enviado ao seu e-mail.';
    }
    if (errorName === 'NotAuthorizedException' || errorMsg.includes('Incorrect username or password')) {
      return 'E-mail ou senha incorretos. Verifique suas credenciais.';
    }
    if (errorName === 'UserNotFoundException' || errorMsg.includes('User does not exist')) {
      return 'Usuário não encontrado. Verifique o e-mail digitado ou crie uma nova conta.';
    }
    if (errorName === 'CodeMismatchException' || errorMsg.includes('Invalid code')) {
      return 'Código de verificação incorreto. Verifique o número digitado.';
    }
    if (errorName === 'ExpiredCodeException' || errorMsg.includes('expired')) {
      return 'O código de verificação expirou. Solicite um novo código.';
    }
    if (errorName === 'LimitExceededException') {
      return 'Muitas tentativas consecutivas. Aguarde alguns instantes antes de tentar novamente.';
    }
    if (errorName === 'InvalidPasswordException' || errorMsg.includes('Password did not conform')) {
      return 'A senha deve conter no mínimo 8 caracteres, com letras maiúsculas, minúsculas e números.';
    }

    return errorMsg || defaultMsg;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email || !password) {
      setErrorMessage('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const output = await entrarUsuario(email, password);

      if (output.AuthenticationResult) {
        const token = output.AuthenticationResult.IdToken || '';

        showToast('Login realizado com sucesso!', 'success');
        onAuthSuccess(email, token);
      } else if (output.ChallengeName) {
        showToast(`Próxima etapa: ${output.ChallengeName}`, 'info');
      } else {
        showToast('Não foi possível concluir o login.', 'error');
      }
    } catch (err: any) {
      console.error('Erro de login:', err);

      const msg = formatAuthError(
        err,
        'Falha ao autenticar. Verifique suas credenciais e tente novamente.'
      );

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
      const output = await criarUsuario(email, password);
      if (output.UserConfirmed) {
        showToast('Cadastro realizado! Faça login.', 'success');
        setMode('signin');
      } else {
        showToast('Código de verificação enviado para seu e-mail!', 'success');
        setMode('confirm');
        setResendCooldown(60);
      }
    } catch (err: any) {
      console.error('Erro de cadastro:', err);
      const msg = formatAuthError(err, 'Erro ao criar conta. Verifique os dados informados.');
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
      await confirmarUsuario(email, code);

      showToast(
        'E-mail verificado com sucesso! Agora você pode entrar.',
        'success'
      );

      setMode('signin');
      setCode('');
      setPassword('');
      setConfirmPassword('');

    } catch (err: any) {
      console.error('Erro de confirmação:', err);

      const msg = formatAuthError(
        err,
        'Código inválido ou expirado.'
      );

      setErrorMessage(msg);
      showToast(msg, 'error');

    } finally {
      setLoading(false);
    }
  };

  const handleResendSignUpCode = async () => {
    if (!email) {
      setErrorMessage('Informe seu e-mail para reenviar o código.');
      return;
    }
    if (resendCooldown > 0) return;

    setResending(true);
    setErrorMessage(null);
    try {
      await resendUserSignUpCode(email);
      showToast('Novo código de verificação enviado com sucesso!', 'success');
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Erro ao reenviar código:', err);
      const msg = formatAuthError(err, 'Não foi possível reenviar o código. Verifique o e-mail informado.');
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email) {
      setErrorMessage('Informe o e-mail cadastrado para recuperar a senha.');
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(email);
      showToast('Código de recuperação enviado para seu e-mail!', 'success');
      setMode('forgot_confirm');
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Erro ao solicitar redefinição de senha:', err);
      const msg = formatAuthError(err, 'Não foi possível enviar o código de recuperação.');
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !code || !password) {
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

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('A senha deve conter letras maiúsculas, minúsculas e números.');
      return;
    }

    setLoading(true);
    try {
      await confirmUserResetPassword(email, code, password);
      showToast('Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
      setMode('signin');
      setCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Erro ao confirmar nova senha:', err);
      const msg = formatAuthError(err, 'Não foi possível redefinir a senha. Verifique o código informado.');
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (!email) {
      setErrorMessage('Informe seu e-mail para reenviar o código.');
      return;
    }
    if (resendCooldown > 0) return;

    setResending(true);
    setErrorMessage(null);
    try {
      await resetUserPassword(email);
      showToast('Novo código de recuperação enviado para seu e-mail!', 'success');
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Erro ao reenviar código de recuperação:', err);
      const msg = formatAuthError(err, 'Não foi possível reenviar o código.');
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setResending(false);
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
            <span className="material-symbols-outlined text-3xl">
              {mode === 'forgot' || mode === 'forgot_confirm' ? 'lock_reset' : 'lock_person'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">Ultra Flashcards</h1>
          <p className="text-xs text-text-secondary mt-1">
            {mode === 'signin' && 'Entre com sua conta Amazon Cognito'}
            {mode === 'signup' && 'Crie sua conta segura na nuvem AWS'}
            {mode === 'confirm' && 'Verificação de segurança por e-mail'}
            {mode === 'forgot' && 'Recuperação de senha via e-mail'}
            {mode === 'forgot_confirm' && 'Defina sua nova senha'}
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('forgot');
                  }}
                  className="text-[11px] text-accent-blue hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">Código de Confirmação</label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || resending}
                  onClick={handleResendSignUpCode}
                  className="text-[11px] text-accent-blue hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {resending ? (
                    <span className="material-symbols-outlined animate-spin text-xs">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-xs">refresh</span>
                  )}
                  <span>
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'}
                  </span>
                </button>
              </div>
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

            <div className="flex items-center justify-between text-xs text-text-secondary mt-3">
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

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('signup');
                }}
                className="hover:text-text-primary transition-colors cursor-pointer"
              >
                Criar outra conta
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM (REQUEST CODE) */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Informe o endereço de e-mail associado à sua conta. Enviaremos um código de verificação para que você possa redefinir sua senha.
            </p>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-purple-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl mt-2 transition-all duration-300 shadow-lg shadow-accent-blue/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span>Enviar Código de Recuperação</span>
                  <span className="material-symbols-outlined text-base">send</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-text-secondary mt-3">
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

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('forgot_confirm');
                }}
                className="hover:text-text-primary transition-colors cursor-pointer"
              >
                Já tenho o código
              </button>
            </div>
          </form>
        )}

        {/* CONFIRM FORGOT PASSWORD FORM (ENTER CODE + NEW PASSWORD) */}
        {mode === 'forgot_confirm' && (
          <form onSubmit={handleConfirmForgotPassword} className="flex flex-col gap-4">
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
                <label className="text-xs font-semibold text-text-secondary">Código de Recuperação</label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || resending}
                  onClick={handleResendResetCode}
                  className="text-[11px] text-accent-blue hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {resending ? (
                    <span className="material-symbols-outlined animate-spin text-xs">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-xs">refresh</span>
                  )}
                  <span>
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'}
                  </span>
                </button>
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 123456"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary text-center tracking-widest font-mono outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">Nova Senha</label>
                <span className="text-[10px] text-text-secondary opacity-75">mín. 8 caracteres</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex: NovaSenha123"
                required
                className="w-full bg-bg-input border border-border-color rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Confirmar Nova Senha</label>
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
                  <span>Redefinir Senha</span>
                  <span className="material-symbols-outlined text-base">check</span>
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
