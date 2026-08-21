# 06 - Especificação Detalhada do Algoritmo FSRS v4.5

Este documento especifica a matemática, as regras de transição de estado e a implementação do algoritmo **FSRS (Free Spaced Repetition Scheduler)** para a função AWS Lambda `ProcessReviewFunction`.

---

## 1. Conceitos Fundamentais e Variáveis

O FSRS modela a memória humana com base em três métricas principais e uma nota dada pelo usuário a cada revisão:

* **Rating ($G \in \{1, 2, 3, 4\}$):** A nota atribuída pelo usuário na revisão:
  * `1` = Errei (Again)
  * `2` = Difícil (Hard)
  * `3` = Bom (Good)
  * `4` = Fácil (Easy)
* **Estabilidade ($S \in (0, +\infty)$):** O tempo (em dias) que leva para a probabilidade de retenção da memória cair para 90%.
* **Dificuldade ($D \in [1, 10]$):** A dificuldade intrínseca do conteúdo contido no cartão.
* **Retirabilidade ($R \in (0, 1]$):** A probabilidade calculada do usuário lembrar do cartão $t$ dias após a última revisão.

---

## 2. Parâmetros Padrão do Modelo ($w$)

O algoritmo utiliza um vetor de 19 pesos ($w_0$ a $w_{18}$) otimizados por aprendizado de máquina. Os valores padrão recomendados são:

```json
[
  0.40255, 1.18385, 3.173, 15.69105, 
  7.1949, 0.5345, 1.4604, 0.0046, 
  1.5457, 0.1192, 1.0192, 1.9395, 
  0.11, 0.29605, 2.2698, 0.2315, 
  2.9898, 0.51655, 0.6621
]
```

---

## 3. Lógica do Algoritmo

### 3.1. Probabilidade de Retenção (Retirabilidade $R$)
Dada a estabilidade atual $S$ e o número de dias decorridos desde a última revisão $t$:

$$R(t, S) = \left(1 + \frac{t}{9 \cdot S}\right)^{-1}$$

---

### 3.2. Inicialização de Cards Novos ($state = \text{"NEW"}$)

Na primeira vez que o usuário estuda um cartão, $S$ e $D$ são inicializados com base na nota $G$:

#### Estabilidade Inicial ($S_0$):
$$S_0(G) = w_{G-1}$$

#### Dificuldade Inicial ($D_0$):
$$D_0(G) = \min\left(\max\left(w_4 - e^{w_5 \cdot (G - 1)} + 1, 1\right), 10\right)$$

---

### 3.3. Atualização de Cards em Revisão ($state = \text{"REVIEW"}$)

Quando o cartão já possui histórico e é revisado após $t$ dias:

#### A. Atualização da Dificuldade ($D_{new}$)
A nova dificuldade reflete o desempenho recente com convergência para a média:

$$\Delta D = -w_6 \cdot (G - 3)$$
$$D' = D + \Delta D$$
$$D_{new} = \min\left(\max\left(w_7 \cdot D_0(3) + (1 - w_7) \cdot D', 1\right), 10\right)$$

#### B. Atualização da Estabilidade em Caso de Acerto ($G \ge 2$)
Se o usuário lembrou do cartão ($G = 2, 3, 4$), a nova estabilidade $S_{recall}$ é expandida:

$$S_{recall}(D, S, R, G) = S \cdot \left(1 + e^{w_8} \cdot (11 - D) \cdot S^{-w_9} \cdot \left(e^{w_{10} \cdot (1 - R)} - 1\right) \cdot w_{G}^{hard/easy}\right)$$

Onde o fator de ajuste $w_{G}^{hard/easy}$ é:
* Se $G = 2$ (Hard): $w_{15}$
* Se $G = 3$ (Good): $1.0$
* Se $G = 4$ (Easy): $w_{16}$

#### C. Atualização da Estabilidade em Caso de Esquecimento ($G = 1$)
Se o usuário errou o cartão ($G = 1$), ocorre um "lapso" e a estabilidade despenca:

$$S_{forget}(D, S, R) = w_{11} \cdot D^{-w_{12}} \cdot \left((S + 1)^{w_{13}} - 1\right) \cdot e^{w_{14} \cdot (1 - R)}$$

$$\text{Com limite máximo: } S_{forget} = \min(S_{forget}, S)$$

---

### 3.4. Cálculo do Próximo Intervalo ($I$) e `due_date`

O intervalo em dias até a próxima revisão $I$ é calculado para atingir a taxa de retenção desejada $R_{target}$ (padrão $0.90$ ou $90\%$):

$$I(S, R_{target}) = \frac{S \cdot \left(R_{target}^{-1} - 1\right)}{1/9} = 9 \cdot S \cdot \left(R_{target}^{-1} - 1\right)$$

Se $R_{target} = 0.90$, o intervalo é exatamente igual à estabilidade: $I = S$.

$$\text{Novo } due\_date = \text{Data/Hora Atual} + \text{round}(I) \text{ dias}$$

---

## 4. Implementação de Referência (Python)

Esta função é integrada à AWS Lambda para processar atualizações no DynamoDB.

```python
import math
from datetime import datetime, timezone, timedelta

# Pesos padrão do FSRS v4.5
W = [
    0.40255, 1.18385, 3.173, 15.69105, 
    7.1949, 0.5345, 1.4604, 0.0046, 
    1.5457, 0.1192, 1.0192, 1.9395, 
    0.11, 0.29605, 2.2698, 0.2315, 
    2.9898, 0.51655, 0.6621
]

R_TARGET = 0.90 # Retenção desejada: 90%

def calculate_retrievability(t_days: float, stability: float) -> float:
    if stability <= 0:
        return 0.0
    return (1.0 + t_days / (9.0 * stability)) ** -1.0

def calculate_next_interval(stability: float, r_target: float = R_TARGET) -> int:
    new_interval = 9.0 * stability * ((1.0 / r_target) - 1.0)
    return max(1, round(new_interval))

def process_fsrs(rating: int, card: dict) -> dict:
    """
    Entrada:
      rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
      card: dict com 'state', 'stability', 'difficulty', 'last_review_date'
    Retorna:
      dict com novos valores de 'stability', 'difficulty', 'due_date', 'state'
    """
    now = datetime.now(timezone.utc)
    state = card.get("state", "NEW")
    
    # 1. Cards Novos (Primeira Revisão)
    if state == "NEW":
        new_s = W[rating - 1]
        raw_d = W[4] - math.exp(W[5] * (rating - 1)) + 1.0
        new_d = min(max(raw_d, 1.0), 10.0)
    
    # 2. Cards em Revisão Continua
    else:
        last_review = datetime.fromisoformat(card["last_review_date"])
        t_days = max(0.0, (now - last_review).total_seconds() / 86400.0)
        
        old_s = card["stability"]
        old_d = card["difficulty"]
        r = calculate_retrievability(t_days, old_s)
        
        # Atualiza Dificuldade
        d_0_good = W[4] - math.exp(W[5] * 2) + 1.0
        delta_d = -W[6] * (rating - 3)
        d_prime = old_d + delta_d
        new_d = min(max(W[7] * d_0_good + (1.0 - W[7]) * d_prime, 1.0), 10.0)
        
        # Atualiza Estabilidade
        if rating == 1: # Errou (Lapse)
            new_s = W[11] * (new_d ** -W[12]) * (((old_s + 1.0) ** W[13]) - 1.0) * math.exp(W[14] * (1.0 - r))
            new_s = min(new_s, old_s) # Não cresce no erro
        else: # Acertou (Recall)
            w_factor = 1.0
            if rating == 2:
                w_factor = W[15]
            elif rating == 4:
                w_factor = W[16]
                
            hard_easy_boost = math.exp(W[8]) * (11.0 - new_d) * (old_s ** -W[9]) * (math.exp(W[10] * (1.0 - r)) - 1.0) * w_factor
            new_s = old_s * (1.0 + hard_easy_boost)
            
    # 3. Agendamento
    interval_days = calculate_next_interval(new_s, R_TARGET)
    due_date = now + timedelta(days=interval_days)
    
    return {
        "stability": round(new_s, 4),
        "difficulty": round(new_d, 4),
        "state": "REVIEW" if rating > 1 else "LEARNING",
        "last_review_date": now.isoformat(),
        "due_date": due_date.isoformat(),
        "scheduled_days": interval_days
    }
```