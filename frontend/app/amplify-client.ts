'use client';

import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  confirmSignUp, 
  signOut, 
  fetchAuthSession, 
  getCurrentUser,
  type SignInOutput,
  type SignUpOutput
} from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import type { Schema, Note, Card } from '../amplify/data/resource';
import { calculateNextFSRSState } from '../utils/fsrsMath';

// Configurar dinamicamente o Amplify Auth com os dados do Cognito
export function configureAmplifyAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userPoolId = localStorage.getItem('ultra_cognito_user_pool_id');
  const userPoolClientId = localStorage.getItem('ultra_cognito_client_id');

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
      console.warn('Erro ao configurar Amplify Auth:', e);
      return false;
    }
  }
  return false;
}

// Helpers de Autenticação do Cognito
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

export async function signOutUser(): Promise<void> {
  try {
    await signOut();
  } catch (e) {
    console.warn('Erro ao deslogar:', e);
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

// Pesos padrão do FSRS v4.5
const W = [
    0.40255, 1.18385, 3.173, 15.69105, 
    7.1949, 0.5345, 1.4604, 0.0046, 
    1.5457, 0.1192, 1.0192, 1.9395, 
    0.11, 0.29605, 2.2698, 0.2315, 
    2.9898, 0.51655, 0.6621
];

// Seed inicial para o LocalStorage
const getMockNotes = (): Note[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('ultra_notes');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.length > 0 && (parsed[0].note_id || parsed[0].deck_id || parsed[0].note_type)) {
        const migrated = parsed.map((n: any) => ({
          noteId: n.noteId || n.note_id,
          deckId: n.deckId || n.deck_id,
          noteType: n.noteType || n.note_type,
          fields: n.fields,
          tags: n.tags,
          createdAt: n.createdAt || n.created_at,
          updatedAt: n.updatedAt || n.updated_at
        }));
        localStorage.setItem('ultra_notes', JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch (e) {
      // fallback
    }
  }
  
  const seedNotes: Note[] = [
    {
      noteId: "not_1",
      deckId: "vocabulario",
      noteType: "BASIC",
      fields: { Front: "Ephemeral", Back: "Efêmero / Passageiro / Transitório" },
      tags: ["vocabulario", "ingles", "adjetivos"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      noteId: "not_2",
      deckId: "enem",
      noteType: "BASIC",
      fields: { Front: "Mitocôndria", Back: "Organela responsável pela respiração celular aeróbica e síntese de ATP." },
      tags: ["biologia", "enem", "citologia"],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      noteId: "not_3",
      deckId: "databricks",
      noteType: "BASIC",
      fields: { Front: "Medallion Architecture", Back: "Padrão de arquitetura de dados que organiza as tabelas logicamente em camadas (Bronze -> Silver -> Gold) para refinar a qualidade." },
      tags: ["databricks", "data-engineering", "lakehouse"],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      noteId: "not_4",
      deckId: "vocabulario",
      noteType: "BASIC_REVERSED",
      fields: { Front: "Pernicious", Back: "Pernicioso / Nocivo / Prejudicial" },
      tags: ["vocabulario", "ingles", "avancado"],
      createdAt: new Date(Date.now() - 10000000).toISOString(),
      updatedAt: new Date(Date.now() - 10000000).toISOString()
    }
  ];
  localStorage.setItem('ultra_notes', JSON.stringify(seedNotes));
  return seedNotes;
};

const getMockCards = (notes: Note[]): Card[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('ultra_cards');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.length > 0 && (parsed[0].card_id || parsed[0].note_id || parsed[0].deck_id || parsed[0].due_date)) {
        const migrated = parsed.map((c: any) => ({
          cardId: c.cardId || c.card_id,
          noteId: c.noteId || c.note_id,
          deckId: c.deckId || c.deck_id,
          cardOrdinal: c.cardOrdinal !== undefined ? c.cardOrdinal : c.card_ordinal,
          state: c.state,
          stability: c.stability,
          difficulty: c.difficulty,
          dueDate: c.dueDate || c.due_date,
          lastReviewDate: c.lastReviewDate !== undefined ? c.lastReviewDate : c.last_review_date,
          scheduledDays: c.scheduledDays !== undefined ? c.scheduledDays : c.scheduled_days,
          createdAt: c.createdAt || c.created_at,
          updatedAt: c.updatedAt || c.updated_at
        }));
        localStorage.setItem('ultra_cards', JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch (e) {
      // fallback
    }
  }

  const seedCards: Card[] = [];
  notes.forEach(note => {
    const timestamp = new Date().toISOString();
    if (note.noteType === 'BASIC_REVERSED') {
      seedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: note.noteId,
        deckId: note.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      seedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: note.noteId,
        deckId: note.deckId,
        cardOrdinal: 1,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    } else {
      seedCards.push({
        cardId: "crd_" + Math.random().toString(36).substr(2, 9),
        noteId: note.noteId,
        deckId: note.deckId,
        cardOrdinal: 0,
        state: "NEW",
        stability: 0,
        difficulty: 0,
        dueDate: timestamp,
        scheduledDays: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  });
  localStorage.setItem('ultra_cards', JSON.stringify(seedCards));
  return seedCards;
};

// Cliente Mocado Interceptador (Simulador LocalStorage)
const mockClient = {
  models: {
    Note: {
      list: async () => {
        const notes = getMockNotes();
        return { data: notes };
      },
      create: async (input: Omit<Note, "noteId" | "createdAt" | "updatedAt">) => {
        const notes = getMockNotes();
        const newNote: Note = {
          ...input,
          noteId: "not_" + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        notes.push(newNote);
        localStorage.setItem('ultra_notes', JSON.stringify(notes));
        return { data: newNote };
      },
      get: async (id: string) => {
        const notes = getMockNotes();
        const note = notes.find(n => n.noteId === id) || null;
        return { data: note };
      },
      update: async (input: Partial<Note> & { noteId: string }) => {
        const notes = getMockNotes();
        const idx = notes.findIndex(n => n.noteId === input.noteId);
        if (idx === -1) throw new Error("Note not found");
        notes[idx] = { ...notes[idx], ...input, updatedAt: new Date().toISOString() };
        localStorage.setItem('ultra_notes', JSON.stringify(notes));
        return { data: notes[idx] };
      },
      delete: async (input: { noteId: string }) => {
        const notes = getMockNotes();
        const idx = notes.findIndex(n => n.noteId === input.noteId);
        if (idx === -1) throw new Error("Note not found");
        const deleted = notes.splice(idx, 1)[0];
        localStorage.setItem('ultra_notes', JSON.stringify(notes));
        return { data: deleted };
      }
    },
    Card: {
      list: async () => {
        const notes = getMockNotes();
        const cards = getMockCards(notes);
        return { data: cards };
      },
      create: async (input: Omit<Card, "cardId" | "createdAt" | "updatedAt">) => {
        const notes = getMockNotes();
        const cards = getMockCards(notes);
        const newCard: Card = {
          ...input,
          cardId: "crd_" + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        cards.push(newCard);
        localStorage.setItem('ultra_cards', JSON.stringify(cards));
        return { data: newCard };
      },
      get: async (id: string) => {
        const notes = getMockNotes();
        const cards = getMockCards(notes);
        const card = cards.find(c => c.cardId === id) || null;
        return { data: card };
      },
      update: async (input: Partial<Card> & { cardId: string }) => {
        const notes = getMockNotes();
        const cards = getMockCards(notes);
        const idx = cards.findIndex(c => c.cardId === input.cardId);
        if (idx === -1) throw new Error("Card not found");
        cards[idx] = { ...cards[idx], ...input, updatedAt: new Date().toISOString() };
        localStorage.setItem('ultra_cards', JSON.stringify(cards));
        return { data: cards[idx] };
      },
      delete: async (input: { cardId: string }) => {
        const notes = getMockNotes();
        const cards = getMockCards(notes);
        const idx = cards.findIndex(c => c.cardId === input.cardId);
        if (idx === -1) throw new Error("Card not found");
        const deleted = cards.splice(idx, 1)[0];
        localStorage.setItem('ultra_cards', JSON.stringify(cards));
        return { data: deleted };
      }
    }
  }
};

// Seletor de Cliente: AWS real ou Mock dependendo do localStorage
export function getAmplifyClient() {
  if (typeof window === 'undefined') {
    return mockClient; // Server-side fallback para evitar falha
  }
  
  const mode = localStorage.getItem("ultra_api_mode") || "mock";
  if (mode === "aws") {
    try {
      return generateClient<Schema>();
    } catch (e) {
      console.warn("Falha ao gerar cliente real do Amplify Gen 2, usando mock.", e);
      return mockClient;
    }
  }
  
  return mockClient;
}
