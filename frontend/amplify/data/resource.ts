// amplify/data/resource.ts
// ClientSchema and TypeScript interfaces for Ultra Flashcards

export type NoteType = "BASIC" | "BASIC_REVERSED" | "CLOZE" | "TYPE_ANSWER" | "IMAGE_OCCLUSION";
export type CardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING" | "MASTERED" | "DIFFICULT";
export type RatingValue = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type StudyModeType = "REVIEW" | "QUIZ" | "WRITTEN_ANSWER" | "GUIDED_TUTOR";
export type AiSourceType = "TEXT" | "FILE" | "URL" | "YOUTUBE" | "IMAGE" | "SCAN" | "VOICE" | "MANUAL";
export type AiJobStatusType = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Note {
  noteId: string;
  user_id?: string;
  deckId: string;
  noteType: NoteType;
  fields: Record<string, string>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Card {
  cardId: string;
  user_id?: string;
  noteId: string;
  deckId: string;
  cardOrdinal: number;
  state: CardState;
  stability: number;
  difficulty: number;
  elapsedDays?: number;
  scheduledDays: number;
  reps?: number;
  lapses?: number;
  dueDate: string;
  lastReviewDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Deck {
  deckId: string;
  user_id?: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  isFavorite?: boolean;
  tags?: string[];
  totalNotes?: number;
  totalCards?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudyLog {
  logId: string;
  user_id?: string;
  cardId: string;
  noteId?: string;
  deckId: string;
  rating: RatingValue;
  studyMode: StudyModeType;
  reviewDurationMs?: number;
  stabilityBefore?: number;
  stabilityAfter?: number;
  difficultyBefore?: number;
  difficultyAfter?: number;
  aiScorePercent?: number;
  createdAt: string;
}

export interface ReviewResponse {
  card_id: string;
  state: string;
  stability: number;
  difficulty: number;
  next_review: string;
  interval_days: number;
  ai_feedback?: string;
  ai_score_percent?: number;
}

export interface DailyStats {
  user_id?: string;
  date: string; // YYYY-MM-DD
  cardsStudied: number;
  timeSpentSeconds: number;
  ratingsCount: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  retentionRate: number;
}

export interface WeakTopic {
  topic: string;
  deck: string;
  accuracy: number;
  total_reviews?: number;
}

export interface AnalyticsSummaryResponse {
  summary: {
    total_cards: number;
    mastered_cards: number;
    learning_cards: number;
    difficult_cards: number;
    new_cards: number;
    review_cards: number;
    mastery_percent: number;
  };
  gamification: {
    streak_days: number;
    record_streak_days: number;
    total_reviews: number;
    total_study_minutes: number;
    accuracy_rate: number;
  };
  heatmap: Record<string, number>;
  weak_topics: WeakTopic[];
  timestamp: string;
}

export interface UserAggregates {
  user_id?: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: string;
  totalCardsStudied: number;
  totalTimeSpentSeconds: number;
  weakTopics: WeakTopic[];
  updatedAt?: string;
}

export interface UserPreferences {
  user_id?: string;
  displayName?: string;
  email?: string;
  dailyGoal: number;
  desiredRetention: number;
  maxIntervalDays: number;
  fsrsWeights?: number[];
  language?: string;
  updatedAt?: string;
}

export interface AiJob {
  jobId: string;
  user_id?: string;
  deckId: string;
  sourceType: AiSourceType;
  status: AiJobStatusType;
  sourcePayloadOrKey: string;
  generatedNotes: Array<{
    front: string;
    back: string;
    type?: NoteType;
    tags?: string[];
  }>;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export type Schema = {
  Note: {
    type: Note;
    create: (input: Omit<Note, "noteId" | "createdAt" | "updatedAt">) => Promise<{ data: Note }>;
    list: () => Promise<{ data: Note[] }>;
    get: (id: string) => Promise<{ data: Note | null }>;
    update: (input: Partial<Note> & { noteId: string }) => Promise<{ data: Note }>;
    delete: (input: { noteId: string }) => Promise<{ data: Note }>;
  };
  Card: {
    type: Card;
    create: (input: Omit<Card, "cardId" | "createdAt" | "updatedAt">) => Promise<{ data: Card }>;
    list: () => Promise<{ data: Card[] }>;
    get: (id: string) => Promise<{ data: Card | null }>;
    update: (input: Partial<Card> & { cardId: string }) => Promise<{ data: Card }>;
    delete: (input: { cardId: string }) => Promise<{ data: Card }>;
  };
  Deck: {
    type: Deck;
    create: (input: Omit<Deck, "deckId" | "createdAt" | "updatedAt">) => Promise<{ data: Deck }>;
    list: () => Promise<{ data: Deck[] }>;
    get: (id: string) => Promise<{ data: Deck | null }>;
    update: (input: Partial<Deck> & { deckId: string }) => Promise<{ data: Deck }>;
    delete: (input: { deckId: string }) => Promise<{ data: Deck }>;
  };
};
