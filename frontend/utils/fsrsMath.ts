// FSRS v4.5 default weights
export const W = [
    0.40255, 1.18385, 3.173, 15.69105, 
    7.1949, 0.5345, 1.4604, 0.0046, 
    1.5457, 0.1192, 1.0192, 1.9395, 
    0.11, 0.29605, 2.2698, 0.2315, 
    2.9898, 0.51655, 0.6621
];

export const R_TARGET = 0.90;

export function calculateNextFSRSState(rating: number, card: any) {
    const state = card.state || "NEW";
    const currentStability = parseFloat(card.stability || 0);
    const currentDifficulty = parseFloat(card.difficulty || 0);
    
    let newS = 0;
    let newD = 0;
    let newState: "NEW" | "LEARNING" | "REVIEW" = "REVIEW";

    // 1. Inicialização de novos cards
    if (state === "NEW" || currentStability <= 0) {
        newS = W[rating - 1];
        const rawD = W[4] - Math.exp(W[5] * (rating - 1)) + 1.0;
        newD = Math.min(Math.max(rawD, 1.0), 10.0);
        newState = rating > 1 ? "REVIEW" : "LEARNING";
    } 
    // 2. Revisões subsequentes
    else {
        const lastRevStr = card.lastReviewDate || card.createdAt;
        let tDays = 0;
        if (lastRevStr) {
            const diffTime = Math.abs(new Date().getTime() - new Date(lastRevStr).getTime());
            tDays = Math.max(0.0, diffTime / (1000 * 60 * 60 * 24));
        }
        
        // Retrievability R
        const r = Math.pow(1.0 + tDays / (9.0 * currentStability), -1.0);
        
        // Próxima Dificuldade
        const d0Good = W[4] - Math.exp(W[5] * 2) + 1.0;
        const deltaD = -W[6] * (rating - 3);
        const dPrime = currentDifficulty + deltaD;
        newD = W[7] * d0Good + (1.0 - W[7]) * dPrime;
        newD = Math.min(Math.max(newD, 1.0), 10.0);

        if (rating === 1) { // Lapso / Erro
            const sForget = W[11] * Math.pow(newD, -W[12]) * (Math.pow(currentStability + 1.0, W[13]) - 1.0) * Math.exp(W[14] * (1.0 - r));
            newS = Math.max(0.1, Math.min(sForget, currentStability));
            newState = "LEARNING";
        } else { // Acerto
            let wFactor = 1.0;
            if (rating === 2) wFactor = W[15];
            else if (rating === 4) wFactor = W[16];

            const hardEasyBoost = Math.exp(W[8]) * (11.0 - newD) * Math.pow(currentStability, -W[9]) * (Math.exp(W[10] * (1.0 - r)) - 1.0) * wFactor;
            newS = currentStability * (1.0 + hardEasyBoost);
            newState = "REVIEW";
        }
    }

    // Agendamento do próximo intervalo
    const intervalDays = Math.max(1, Math.round(9.0 * newS * ((1.0 / R_TARGET) - 1.0)));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + intervalDays);

    return {
        stability: parseFloat(newS.toFixed(4)),
        difficulty: parseFloat(newD.toFixed(4)),
        state: newState,
        dueDate: dueDate.toISOString(),
        scheduledDays: intervalDays
    };
}
