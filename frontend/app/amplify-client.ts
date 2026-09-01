'use client';

import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  confirmSignUp, 
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  signOut, 
  fetchAuthSession, 
  getCurrentUser,
  type SignInOutput,
  type SignUpOutput,
  type ResetPasswordOutput
} from 'aws-amplify/auth';

/**
 * Configura o AWS Amplify Auth com os dados do Amazon Cognito.
 * Prioridade: .env.local -> localStorage.
 */
export function configureAmplifyAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || localStorage.getItem('ultra_cognito_user_pool_id') || '';
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || localStorage.getItem('ultra_cognito_client_id') || '';

  if (userPoolId && userPoolClientId) {
    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId,
            userPoolClientId,
            signUpVerificationMethod: 'code'
          }
        }
      });
      return true;
    } catch (e) {
      console.warn('Erro ao configurar AWS Amplify Auth:', e);
      return false;
    }
  }
  return false;
}

// Helpers de Autenticação do Amazon Cognito na AWS
export async function signInUser(email: string, password: string): Promise<SignInOutput> {
  configureAmplifyAuth();
  return await signIn({ username: email.trim(), password });
}

export async function signUpUser(email: string, password: string): Promise<SignUpOutput> {
  configureAmplifyAuth();
  return await signUp({
    username: email.trim(),
    password,
    options: {
      userAttributes: {
        email: email.trim()
      }
    }
  });
}

export async function confirmUserSignUp(email: string, code: string) {
  configureAmplifyAuth();
  return await confirmSignUp({
    username: email.trim(),
    confirmationCode: code.trim()
  });
}

export async function resendUserSignUpCode(email: string) {
  configureAmplifyAuth();
  return await resendSignUpCode({
    username: email.trim()
  });
}

export async function resetUserPassword(email: string): Promise<ResetPasswordOutput> {
  configureAmplifyAuth();
  return await resetPassword({
    username: email.trim()
  });
}

export async function confirmUserResetPassword(email: string, code: string, newPassword: string) {
  configureAmplifyAuth();
  return await confirmResetPassword({
    username: email.trim(),
    confirmationCode: code.trim(),
    newPassword
  });
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut();
  } catch (e) {
    console.warn('Erro ao deslogar do Cognito:', e);
  }
}

export async function getAuthSessionToken(): Promise<string | null> {
  try {
    const configured = configureAmplifyAuth();
    if (!configured) return null;
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString() || null;
  } catch (e) {
    return null;
  }
}

export async function getCurrentAuthenticatedUser() {
  try {
    const configured = configureAmplifyAuth();
    if (!configured) return null;
    return await getCurrentUser();
  } catch (e) {
    return null;
  }
}
