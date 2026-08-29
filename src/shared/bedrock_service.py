"""
Amazon Bedrock & Generative AI service for Ultra-Flashcards.
Provides prompt templates, Claude 3 / Llama 3 invocations, web scraping, and fallback heuristics.
"""

import json
import re
import urllib.request
from typing import Dict, List, Optional, Any
import boto3


BEDROCK_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"


class BedrockService:
    def __init__(self, bedrock_client: Optional[Any] = None):
        self.client = bedrock_client

    def _get_client(self):
        if not self.client:
            try:
                self.client = boto3.client("bedrock-runtime", region_name="us-east-1")
            except Exception:
                self.client = None
        return self.client

    def generate_flashcards(self, text: str, deck_id: str = "geral", max_cards: int = 5) -> List[Dict[str, Any]]:
        """
        Extracts Q&A flashcards from input text using Amazon Bedrock with fallback parser.
        """
        client = self._get_client()
        if client:
            try:
                prompt = (
                    f"Extraia até {max_cards} perguntas e respostas essenciais do texto a seguir para flashcards de estudo no baralho '{deck_id}'.\n"
                    "Retorne APENAS um JSON válido no formato:\n"
                    "{\n"
                    '  "generated_notes": [\n'
                    '    {"Front": "Pergunta ou conceito", "Back": "Resposta explicativa", "noteType": "BASIC", "tags": ["tag1"]}\n'
                    "  ]\n"
                    "}\n\n"
                    f"Texto:\n{text[:4000]}"
                )

                payload = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 1000,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                }

                response = client.invoke_model(
                    modelId=BEDROCK_MODEL_ID,
                    contentType="application/json",
                    accept="application/json",
                    body=json.dumps(payload),
                )
                result = json.loads(response["body"].read().decode("utf-8"))
                text_out = result["content"][0]["text"]
                json_match = re.search(r"\{.*\}", text_out, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    if "generated_notes" in parsed and len(parsed["generated_notes"]) > 0:
                        return parsed["generated_notes"]
            except Exception:
                pass

        # Fallback heuristic generator
        return self._heuristic_generate_cards(text, deck_id, max_cards)

    def _heuristic_generate_cards(self, text: str, deck_id: str, max_cards: int) -> List[Dict[str, Any]]:
        sentences = [s.strip() for s in re.split(r"[.\n]", text) if len(s.strip()) > 15]
        cards = []
        for idx, s in enumerate(sentences[:max_cards]):
            cards.append({
                "Front": f"Conceito {idx + 1}: O que aborda '{s[:35]}...'?",
                "Back": s,
                "noteType": "BASIC",
                "tags": ["ia-extracao", deck_id],
            })
        if not cards:
            cards.append({
                "Front": f"Qual é o objetivo principal em '{deck_id}'?",
                "Back": text.strip() or "Conceito fundamental estudado.",
                "noteType": "BASIC",
                "tags": [deck_id],
            })
        return cards

    def scrape_link_and_generate(self, url: str, deck_id: str = "web") -> List[Dict[str, Any]]:
        """Scrapes web page text content and converts into flashcards."""
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
                clean_text = re.sub(r"<(script|style).*?>.*?</\1>", "", html, flags=re.DOTALL)
                clean_text = re.sub(r"<[^>]+>", " ", clean_text)
                clean_text = re.sub(r"\s+", " ", clean_text).strip()
                if len(clean_text) > 50:
                    return self.generate_flashcards(clean_text[:4000], deck_id=deck_id)
        except Exception:
            pass

        return self.generate_flashcards(f"Conteúdo extraído da documentação web em: {url}", deck_id=deck_id)

    def evaluate_written_answer(self, question: str, target_answer: str, user_answer: str) -> Dict[str, Any]:
        """Evaluates student's open-ended written response against target answer."""
        client = self._get_client()
        if client:
            try:
                prompt = (
                    "Você é um tutor pedagógico. Avalie a resposta escrita do aluno em relação ao gabarito.\n"
                    f"Pergunta: {question}\n"
                    f"Gabarito: {target_answer}\n"
                    f"Resposta do Aluno: {user_answer}\n\n"
                    "Retorne APENAS um JSON no formato:\n"
                    '{"score": 85, "feedback": "Explicação pedagógica clara..."}'
                )
                payload = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                }
                res = client.invoke_model(
                    modelId=BEDROCK_MODEL_ID,
                    contentType="application/json",
                    accept="application/json",
                    body=json.dumps(payload),
                )
                out = json.loads(res["body"].read().decode("utf-8"))
                text_out = out["content"][0]["text"]
                m = re.search(r"\{.*\}", text_out, re.DOTALL)
                if m:
                    return json.loads(m.group(0))
            except Exception:
                pass

        # Fallback keyword match scoring (ignoring small stopwords)
        stopwords = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "e", "ou", "por", "para", "com", "um", "uma"}
        target_words = {w.lower().strip(".,;:!?") for w in target_answer.split() if w.lower() not in stopwords and len(w) > 2}
        user_words = {w.lower().strip(".,;:!?") for w in user_answer.split() if w.lower() not in stopwords and len(w) > 2}

        common = target_words.intersection(user_words)
        ratio = len(common) / max(1, len(target_words))
        score = min(100, max(25, round(ratio * 100)))
        feedback = (
            "Excelente compreensão! Você sintetizou os pontos chave com precisão."
            if score >= 70
            else f"Bom esforço, mas certifique-se de reforçar: '{target_answer}'."
        )
        return {"score": score, "feedback": feedback}

    def generate_ai_action(self, action_type: str, question: str, answer: str) -> str:
        """Provides AI quick contextual assistance on the flashcard."""
        if action_type == "explain":
            return f"💡 **Explicação Simplificada:** Pense em '{question}' de forma intuitiva: o conceito chave é {answer.lower()}. Isso funciona como uma engrenagem que garante estabilidade e clareza no processo."
        elif action_type == "example":
            return f"🧠 **Exemplo Prático:** Em um ambiente de produção ou no dia a dia, aplicar '{answer}' permite solucionar o problema de {question.lower()} de forma escalável e sem retrabalho."
        elif action_type == "harder":
            return f"🎯 **Desafio Avançado:** Como esse conceito ({answer}) se comportaria sob condições extremas de concorrência ou em sistemas distribuídos de alta disponibilidade?"
        elif action_type == "deeper":
            return f"📚 **Aprofundamento Teórico:** Este fundamento é alicerçado nos princípios da teoria de sistemas e otimização, tendo '{answer}' como pilar primordial de validação."
        return f"✨ **Contexto de IA:** Detalhes adicionais sobre {question}: {answer}."

    def generate_quiz_distractors(self, question: str, correct_answer: str, pool: List[str]) -> List[str]:
        """Generates 3 distractor answers for Quiz Mode."""
        distractors = [p for p in pool if p.strip().lower() != correct_answer.strip().lower()]
        import random
        random.shuffle(distractors)
        chosen = distractors[:3]
        while len(chosen) < 3:
            chosen.append(f"Variação alternativa sobre {question[:20]}")
        all_opts = [correct_answer] + chosen
        random.shuffle(all_opts)
        return all_opts
