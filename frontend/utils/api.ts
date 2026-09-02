// utils/api.ts
// Official REST API Client for Ultra Flashcards Backend

import { getAuthSessionToken } from '../app/amplify-client';
import type { 
  Note, 
  Card, 
  Deck, 
  ReviewResponse, 
  UserPreferences, 
  UserAggregates,
  AnalyticsSummaryResponse,
  RatingValue,
  StudyModeType,
  AiSourceType
} from '../amplify/data/resource';

/**
 * Retorna a URL base configurada para a API Backend Serverless.
 * Prioridade: Variável de ambiente (.env.local) -> LocalStorage -> Default local.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('ultra_api_url');
    if (customUrl && customUrl.trim()) return customUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:3001';
}

/**
 * Cria os headers padrão incluindo autenticação Bearer JWT se disponível.
 */
async function buildHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAuthSessionToken();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('ultra_user_id') || 'usr_dev_default' : 'usr_dev_default';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    ...customHeaders
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Helper genérico de requisição HTTP com tratamento de erro e serialização.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers = await buildHeaders(options.headers as Record<string, string>);
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (netErr: any) {
    console.error(`Erro de conexão com o backend (${url}):`, netErr);
    throw new Error(`Falha de conexão com a API Serverless (${url}). Verifique se a sessão Cognito está ativa e a internet está conectada.`);
  }

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        errorMessage = typeof errorBody.error === 'object' && errorBody.error.message
          ? errorBody.error.message
          : (typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error));
      } else if (errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      const text = await response.text();
      if (text) errorMessage = text;
    }
    if (response.status === 401) {
      errorMessage = 'Sessão expirada ou não autorizada. Por favor, faça login novamente no Cognito.';
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// 1. Baralhos / Decks
// ============================================================================

export async function apiFetchDecks(): Promise<Deck[]> {
  const data = await request<{ decks: any[] }>('/decks');
  return (data.decks || []).map((d: any) => ({
    deckId: d.deck_id || d.deckId || d.id,
    title: d.name || d.title || 'Sem título',
    description: d.description || '',
    icon: d.icon || 'BookOpen',
    color: d.color || '#8b5cf6',
    category: d.category || 'Geral',
    isFavorite: Boolean(d.is_favorite ?? d.isFavorite),
    tags: d.tags || [],
    totalNotes: d.total_notes ?? d.totalNotes ?? 0,
    totalCards: d.total_cards ?? d.totalCards ?? 0,
    createdAt: d.created_at || d.createdAt,
    updatedAt: d.updated_at || d.updatedAt
  }));
}

export async function apiCreateDeck(deck: {
  name?: string;
  title?: string;
  deck_id?: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
}): Promise<Deck> {
  const deckTitle = (deck.name || deck.title || '').trim();
  const slug = deckTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const fallbackId = slug || 'baralho';
  const deckId = (deck.deck_id && deck.deck_id.trim()) ? deck.deck_id.trim() : fallbackId;

  const payload = {
    deck_id: deckId,
    name: deckTitle,
    title: deckTitle,
    description: (deck.description || '').trim(),
    ...(deck.icon ? { icon: deck.icon } : {}),
    ...(deck.color ? { color: deck.color } : {}),
    ...(deck.category ? { category: deck.category } : {}),
    ...(deck.tags ? { tags: deck.tags } : {}),
  };

  const result = await request<any>('/decks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    deckId: result.id || result.deck_id || result.deckId || deckId,
    title: result.name || result.title || deckTitle || 'Sem título',
    description: result.description ?? deck.description ?? '',
    icon: result.icon || deck.icon || 'BookOpen',
    color: result.color || deck.color || '#8b5cf6',
    category: result.category || deck.category || 'Geral',
    isFavorite: Boolean(result.is_favorite ?? result.isFavorite),
    tags: result.tags || deck.tags || [],
    totalNotes: result.total_notes ?? 0,
    totalCards: result.total_cards ?? 0,
    createdAt: result.createdAt || result.created_at || new Date().toISOString(),
    updatedAt: result.updatedAt || result.updated_at || new Date().toISOString()
  };
}

export async function apiDeleteDeck(deckId: string): Promise<boolean> {
  await request<any>(`/decks/${encodeURIComponent(deckId)}`, {
    method: 'DELETE'
  });
  return true;
}

// ============================================================================
// 2. Notas e Flashcards
// ============================================================================

export async function apiCreateNote(note: {
  deck_id: string;
  note_type?: string;
  fields: Record<string, string>;
  tags?: string[];
}): Promise<{ note: Note; cards: Card[] }> {
  const data = await request<any>('/notes', {
    method: 'POST',
    body: JSON.stringify(note)
  });
  return {
    note: {
      noteId: data.note?.note_id || data.note?.noteId,
      deckId: data.note?.deck_id || data.note?.deckId,
      noteType: data.note?.note_type || data.note?.noteType || 'BASIC',
      fields: data.note?.fields || note.fields,
      tags: data.note?.tags || note.tags || [],
      createdAt: data.note?.created_at,
      updatedAt: data.note?.updated_at
    },
    cards: (data.cards || []).map((c: any) => ({
      cardId: c.card_id || c.cardId,
      noteId: c.note_id || c.noteId,
      deckId: c.deck_id || c.deckId,
      cardOrdinal: c.card_ordinal ?? c.cardOrdinal ?? 0,
      state: c.state || 'NEW',
      stability: c.stability || 0,
      difficulty: c.difficulty || 0,
      dueDate: c.due_date || c.dueDate,
      scheduledDays: c.scheduled_days ?? c.scheduledDays ?? 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }))
  };
}

export async function apiCreateBatchNotes(notes: Array<{
  deck_id: string;
  note_type?: string;
  fields: Record<string, string>;
  tags?: string[];
}>): Promise<{ notes_created: number; cards_generated: number }> {
  return await request<any>('/notes/batch', {
    method: 'POST',
    body: JSON.stringify({ notes })
  });
}

// ============================================================================
// 3. Fila de Estudo e Revisões FSRS
// ============================================================================

export async function apiFetchDueCards(deckId?: string | null, limit: number = 50): Promise<{ cards: Card[]; notes: Note[] }> {
  const queryParams = new URLSearchParams();
  if (deckId) queryParams.set('deck_id', deckId);
  if (limit) queryParams.set('limit', String(limit));

  const endpoint = `/study/due?${queryParams.toString()}`;
  const data = await request<any>(endpoint);

  const cards: Card[] = (data.cards || []).map((c: any) => ({
    cardId: c.card_id || c.cardId,
    noteId: c.note_id || c.noteId,
    deckId: c.deck_id || c.deckId,
    cardOrdinal: c.card_ordinal ?? c.cardOrdinal ?? 0,
    state: c.state || 'NEW',
    stability: c.stability || 0,
    difficulty: c.difficulty || 0,
    dueDate: c.due_date || c.dueDate,
    scheduledDays: c.scheduled_days ?? c.scheduledDays ?? 0,
    lastReviewDate: c.last_review_date || c.lastReviewDate,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }));

  const notes: Note[] = (data.notes || []).map((n: any) => ({
    noteId: n.note_id || n.noteId,
    deckId: n.deck_id || n.deckId,
    noteType: n.note_type || n.noteType || 'BASIC',
    fields: n.fields || {},
    tags: n.tags || [],
    createdAt: n.created_at,
    updatedAt: n.updated_at
  }));

  return { cards, notes };
}

export async function apiFetchAllCardsAndNotes(deckId?: string | null): Promise<{ cards: Card[]; notes: Note[] }> {
  const queryParams = new URLSearchParams({ all: 'true' });
  if (deckId) queryParams.set('deck_id', deckId);

  const endpoint = `/study/due?${queryParams.toString()}`;
  const data = await request<any>(endpoint);

  const cards: Card[] = (data.cards || []).map((c: any) => ({
    cardId: c.card_id || c.cardId,
    noteId: c.note_id || c.noteId,
    deckId: c.deck_id || c.deckId,
    cardOrdinal: c.card_ordinal ?? c.cardOrdinal ?? 0,
    state: c.state || 'NEW',
    stability: c.stability || 0,
    difficulty: c.difficulty || 0,
    dueDate: c.due_date || c.dueDate,
    scheduledDays: c.scheduled_days ?? c.scheduledDays ?? 0,
    lastReviewDate: c.last_review_date || c.lastReviewDate,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }));

  const notes: Note[] = (data.notes || []).map((n: any) => ({
    noteId: n.note_id || n.noteId,
    deckId: n.deck_id || n.deckId,
    noteType: n.note_type || n.noteType || 'BASIC',
    fields: n.fields || {},
    tags: n.tags || [],
    createdAt: n.created_at,
    updatedAt: n.updated_at
  }));

  return { cards, notes };
}

export async function apiSubmitReview(params: {
  cardId: string;
  rating: RatingValue;
  reviewTimeMs?: number;
  studyMode?: StudyModeType;
  writtenAnswer?: string;
}): Promise<ReviewResponse> {
  const payload = {
    card_id: params.cardId,
    rating: params.rating,
    study_mode: params.studyMode || 'REVIEW',
    review_time_ms: params.reviewTimeMs || 1000,
    written_answer: params.writtenAnswer
  };

  const data = await request<any>('/study/review', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    card_id: data.card_id || params.cardId,
    state: data.state,
    stability: data.stability,
    difficulty: data.difficulty,
    next_review: data.next_review,
    interval_days: data.interval_days,
    ai_feedback: data.ai_feedback,
    ai_score_percent: data.ai_score_percent
  };
}

// ============================================================================
// 4. Inteligência Artificial & Tutoria Contextual
// ============================================================================

export async function apiEvaluateWrittenAnswer(params: {
  question: string;
  expectedAnswer: string;
  userAnswer: string;
}): Promise<{ score: number; feedback: string }> {
  return await request<any>('/study/evaluate-answer', {
    method: 'POST',
    body: JSON.stringify({
      question: params.question,
      expected_answer: params.expectedAnswer,
      user_answer: params.userAnswer
    })
  });
}

export async function apiExecuteAiAction(params: {
  actionType: 'explain' | 'example' | 'harder' | 'deeper';
  question: string;
  answer: string;
}): Promise<{ explanation: string }> {
  return await request<any>('/study/ai-action', {
    method: 'POST',
    body: JSON.stringify({
      action_type: params.actionType,
      question: params.question,
      answer: params.answer
    })
  });
}

export async function apiGenerateQuizOptions(params: {
  question: string;
  answer: string;
  deckContext?: string;
}): Promise<{ options: string[]; correctIndex: number }> {
  const data = await request<any>('/study/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({
      question: params.question,
      answer: params.answer,
      deck_context: params.deckContext
    })
  });
  return {
    options: data.options || [params.answer, 'Opção A', 'Opção B', 'Opção C'],
    correctIndex: data.correct_index ?? 0
  };
}

export async function apiGenerateAiCards(params: {
  sourceType: AiSourceType;
  content: string;
  deckId: string;
  quantity?: number;
}): Promise<Array<{ front: string; back: string; tags?: string[]; type?: string }>> {
  const data = await request<any>('/ai/generate-cards', {
    method: 'POST',
    body: JSON.stringify({
      source_type: params.sourceType,
      content: params.content,
      deck_id: params.deckId,
      quantity: params.quantity || 5
    })
  });
  return data.flashcards || data.cards || [];
}

// ============================================================================
// 5. Analytics e Métricas
// ============================================================================

export async function apiFetchAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  const data = await request<any>('/analytics/summary');
  return {
    summary: {
      total_cards: data.summary?.total_cards ?? 0,
      mastered_cards: data.summary?.mastered_cards ?? 0,
      learning_cards: data.summary?.learning_cards ?? 0,
      difficult_cards: data.summary?.difficult_cards ?? 0,
      new_cards: data.summary?.new_cards ?? 0,
      review_cards: data.summary?.review_cards ?? 0,
      mastery_percent: data.summary?.mastery_percent ?? 0
    },
    gamification: {
      streak_days: data.gamification?.streak_days ?? 0,
      record_streak_days: data.gamification?.record_streak_days ?? 0,
      total_reviews: data.gamification?.total_reviews ?? 0,
      total_study_minutes: data.gamification?.total_study_minutes ?? 0,
      accuracy_rate: data.gamification?.accuracy_rate ?? 0
    },
    heatmap: data.heatmap || {},
    weak_topics: (data.weak_topics || []).map((w: any) => ({
      topic: w.topic || w.tag || 'Tópico',
      deck: w.deck || 'Geral',
      accuracy: w.accuracy ?? 0,
      total_reviews: w.total_reviews ?? w.card_count ?? 0
    })),
    timestamp: data.timestamp || new Date().toISOString()
  };
}

// ============================================================================
// 6. Preferências do Usuário
// ============================================================================

export async function apiFetchUserPreferences(): Promise<UserPreferences> {
  const data = await request<any>('/user/preferences');
  return {
    displayName: data.display_name,
    email: data.email,
    dailyGoal: data.daily_goal ?? 20,
    desiredRetention: data.desired_retention ?? 0.90,
    maxIntervalDays: data.max_interval_days ?? 36500,
    language: data.language ?? 'pt-BR',
    fsrsWeights: data.fsrs_weights,
    updatedAt: data.updated_at
  };
}

export async function apiUpdateUserPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const data = await request<any>('/user/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      display_name: prefs.displayName,
      daily_goal: prefs.dailyGoal,
      desired_retention: prefs.desiredRetention,
      max_interval_days: prefs.maxIntervalDays,
      language: prefs.language,
      fsrs_weights: prefs.fsrsWeights
    })
  });
  return {
    displayName: data.display_name,
    email: data.email,
    dailyGoal: data.daily_goal,
    desiredRetention: data.desired_retention,
    maxIntervalDays: data.max_interval_days,
    language: data.language,
    fsrsWeights: data.fsrs_weights,
    updatedAt: data.updated_at
  };
}
