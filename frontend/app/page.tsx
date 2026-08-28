// app/page.tsx
// Server Component for fetching initial database state

import Dashboard from "./components/Dashboard";
import type { Note, Card } from "../amplify/data/resource";

// Mock data seeds for Server-Side Render fallback
const serverSeedNotes: Note[] = [
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

const getCardsFromNotes = (notes: Note[]): Card[] => {
  const seedCards: Card[] = [];
  notes.forEach((note, idx) => {
    const timestamp = new Date().toISOString();
    if (note.noteType === "BASIC_REVERSED") {
      seedCards.push({
        cardId: `crd_s${idx}_0`,
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
        cardId: `crd_s${idx}_1`,
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
        cardId: `crd_s${idx}_0`,
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
  return seedCards;
};

export const revalidate = 0; // Disable server caching for real-time due card evaluations

export default async function Page() {
  let initialNotes: Note[] = serverSeedNotes;
  let initialCards: Card[] = getCardsFromNotes(serverSeedNotes);

  // Exemplo de integração SSR com Amplify runWithAmplifyServerContext:
  // try {
  //   const { cookies } = await import("next/headers");
  //   const { runWithAmplifyServerContext } = await import("@aws-amplify/adapter-nextjs");
  //   const { generateServerClientUsingCookies } = await import("@aws-amplify/adapter-nextjs/data");
  //   const outputs = await import("../amplify_outputs.json"); // ou amplifyconfiguration.json
  //
  //   const serverClient = generateServerClientUsingCookies<Schema>({ config: outputs.default });
  //   const notesRes = await runWithAmplifyServerContext({
  //     nextServerContext: { cookies },
  //     operation: (contextSpec) => serverClient.models.Note.list(contextSpec)
  //   });
  //   const cardsRes = await runWithAmplifyServerContext({
  //     nextServerContext: { cookies },
  //     operation: (contextSpec) => serverClient.models.Card.list(contextSpec)
  //   });
  //   if (notesRes.data) initialNotes = notesRes.data;
  //   if (cardsRes.data) initialCards = cardsRes.data;
  // } catch (e) {
  //   console.log("Servidor carregando dados mockados como fallback offline.");
  // }

  return (
    <Dashboard initialNotes={initialNotes} initialCards={initialCards} />
  );
}
