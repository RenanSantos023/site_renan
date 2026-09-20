export interface GenerateAiCardsRequest {
  sourceType: string;
  content: string;
  deckId: string;
  front?: string;
  back?: string;
  noteType?: string;
}

export async function apiGenerateAiCards(
  data: GenerateAiCardsRequest
) {

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/generate-ai-cards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Erro na API: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}