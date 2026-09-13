import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = "us-east-1";

const CLIENT_ID = "kloh4rssen2aul74f5p7g95qr";

const client = new CognitoIdentityProviderClient({
  region: REGION,
});

/**
 * Cria usuário no Cognito
 */
export async function criarUsuario(
  email: string,
  password: string
) {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: email.trim(),
    Password: password,
    UserAttributes: [
      {
        Name: "email",
        Value: email.trim(),
      },
    ],
  });

  return await client.send(command);
}

/**
 * Confirma o código enviado pelo Cognito
 */
export async function confirmarUsuario(
  email: string,
  code: string
) {
  const command = new ConfirmSignUpCommand({
    ClientId: CLIENT_ID,
    Username: email.trim(),
    ConfirmationCode: code.trim(),
  });

  return await client.send(command);
}

/**
 * Reenvia código de confirmação
 */
export async function reenviarCodigo(
  email: string
) {
  const command = new ResendConfirmationCodeCommand({
    ClientId: CLIENT_ID,
    Username: email.trim(),
  });

  return await client.send(command);
}

/**
 * Faz login no Cognito
 *
 * Retorna:
 * - AccessToken
 * - IdToken
 * - RefreshToken
 */
export async function entrarUsuario(
  email: string,
  password: string
) {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",

    ClientId: CLIENT_ID,

    AuthParameters: {
      USERNAME: email.trim(),
      PASSWORD: password,
    },
  });

  const response = await client.send(command);

  const authenticationResult =
    response.AuthenticationResult;

  if (!authenticationResult) {
    throw new Error(
      "Cognito não retornou o resultado da autenticação."
    );
  }

  const accessToken =
    authenticationResult.AccessToken;

  const idToken =
    authenticationResult.IdToken;

  const refreshToken =
    authenticationResult.RefreshToken;

  if (!accessToken) {
    throw new Error(
      "Cognito não retornou o Access Token."
    );
  }

  /**
   * Salva os tokens no navegador.
   */
  if (typeof window !== "undefined") {
    localStorage.setItem(
      "cognito_access_token",
      accessToken
    );

    if (idToken) {
      localStorage.setItem(
        "cognito_id_token",
        idToken
      );
    }

    if (refreshToken) {
      localStorage.setItem(
        "cognito_refresh_token",
        refreshToken
      );
    }
  }

  console.log("✅ Login realizado");
  console.log("✅ Access Token salvo");

  return {
    ...response,

    accessToken,
    idToken,
    refreshToken,
  };
}

/**
 * Remove os tokens do navegador
 */
export function sairUsuario() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(
    "cognito_access_token"
  );

  localStorage.removeItem(
    "cognito_id_token"
  );

  localStorage.removeItem(
    "cognito_refresh_token"
  );

  console.log("✅ Sessão removida");
}

/**
 * Retorna o Access Token salvo
 */
export function obterAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(
    "cognito_access_token"
  );
}

/**
 * Retorna o ID Token salvo
 */
export function obterIdToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(
    "cognito_id_token"
  );
}

/**
 * Verifica se existe sessão
 */
export function usuarioEstaLogado(): boolean {
  return !!obterAccessToken();
}