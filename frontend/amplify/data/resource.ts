// amplify/data/resource.ts
// ClientSchema definition for AWS Amplify Gen 2

export interface Note {
  noteId: string;
  user_id?: string;
  deckId: string;
  noteType: "BASIC" | "BASIC_REVERSED" | "CLOZE" | "TYPE_ANSWER" | "IMAGE_OCCLUSION";
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
  state: "NEW" | "LEARNING" | "REVIEW";
  stability: number;
  difficulty: number;
  dueDate: string;
  lastReviewDate?: string | null;
  scheduledDays: number;
  createdAt?: string;
  updatedAt?: string;
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
};
