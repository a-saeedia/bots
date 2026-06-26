/**
 * Quiz Scoring and Classification Logic
 * 14 questions across 5 sections + contact info
 * Scoring: 0-100 scale
 * Classification: 4 investor types
 */

export type InvestorType =
  | 'capital_protector'
  | 'balanced_investor'
  | 'growth_investor'
  | 'opportunity_seeker';

export interface PortfolioAllocation {
  gold: number;
  fixedIncome: number;
  stocks: number;
  crypto: number;
  cash: number;
}

export interface QuizScores {
  q1?: number; q2?: number; q3?: number; q4?: number;
  q5?: number; q6?: number; q7?: number; q8?: number;
  q9?: number; q10?: number; q11?: number; q12?: number;
  q13?: number; q14?: number;
}

/**
 * SCORING SYSTEM — Weighted + Non-linear
 *
 * Problems with equal-weight linear scoring:
 *  1. Capacity questions (income stability, emergency fund) inflate scores
 *     for conservative people who simply have stable jobs.
 *  2. Inverted questions with few options (3-4 opts) make "reasonable middle"
 *     answers score 0.67+, pushing everyone to 40+.
 *  3. No distinction between risk ATTITUDE (core) vs risk CAPACITY (support).
 *
 * Fix: Each question gets a custom weight and NON-LINEAR normalization.
 *
 * Category weights (sum = 100):
 *   CORE RISK ATTITUDE  (Q1,Q4,Q5,Q6,Q9,Q10)  = 60 pts total
 *   BEHAVIORAL           (Q7,Q8)                = 12 pts total
 *   CAPACITY             (Q2,Q3,Q11)            = 12 pts total
 *   KNOWLEDGE/EXPERIENCE (Q12,Q13,Q14)          = 16 pts total
 *
 * Non-linear normalization: each option maps to a hand-tuned 0.0–1.0 value
 * so that "sensible middle" answers map to ~0.4-0.5, not 0.65+.
 */

/** Non-linear normalization maps: option score → 0.0–1.0 risk value */
const NORM: Record<string, number[]> = {
  // Q1 (INVERT) invest all→bank: "split" (2) → 0.45
  q1:  [1.0, 0.75, 0.45, 0.2, 0.0],
  // Q2 (INVERT) stable→unstable: stable income = capacity, not attitude
  q2:  [1.0, 0.7, 0.4, 0.15, 0.0],
  // Q3 (INVERT) no problem→crisis
  q3:  [1.0, 0.7, 0.4, 0.15, 0.0],
  // Q4 (INVERT) buy more→exit: "hold" (1) → 0.65, "worried" (2) → 0.35
  q4:  [1.0, 0.65, 0.35, 0.15, 0.0],
  // Q5 (DIRECT) 5%→>30%: "20%" (2) → 0.45
  q5:  [0.0, 0.2, 0.45, 0.75, 1.0],
  // Q6 (INVERT) profit>risk→safety: "balanced" (1) → 0.45
  q6:  [1.0, 0.45, 0.0],
  // Q7 (INVERT) jump in→cautious: "research" (1) → 0.55
  q7:  [1.0, 0.55, 0.25, 0.0],
  // Q8 (DIRECT) always emotional→never: "sometimes" (2) → 0.45
  q8:  [0.0, 0.2, 0.45, 0.75, 1.0],
  // Q9 (INVERT) buying opp→exit: "wait" (1) → 0.55
  q9:  [1.0, 0.55, 0.2, 0.0],
  // Q10 (DIRECT) preserve→max return: "growth" (2) → 0.5
  q10: [0.0, 0.2, 0.5, 0.75, 1.0],
  // Q11 (DIRECT) <6mo→>5yr: "1-3yr" (2) → 0.45
  q11: [0.0, 0.2, 0.45, 0.75, 1.0],
  // Q12 (DIRECT) beginner→professional
  q12: [0.0, 0.25, 0.5, 0.75, 1.0],
  // Q13 (DIRECT) 0-5 markets — linear is fine here
  q13: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  // Q14 (DIRECT) <1yr→>5yr
  q14: [0.0, 0.3, 0.65, 1.0],
};

/** Per-question weights (sum = 100) */
const WEIGHTS: Record<string, number> = {
  q1:  9,   // core attitude — investment allocation
  q2:  3,   // capacity — income stability (low weight)
  q3:  3,   // capacity — emergency buffer (low weight)
  q4:  11,  // core attitude — loss reaction
  q5:  11,  // core attitude — loss tolerance
  q6:  10,  // core attitude — profit vs safety
  q7:  7,   // behavioral — FOMO
  q8:  5,   // behavioral — emotional decisions
  q9:  10,  // core attitude — bear market behavior
  q10: 10,  // core attitude — investment goal
  q11: 6,   // capacity — time horizon
  q12: 5,   // knowledge — self-assessment
  q13: 4,   // knowledge — market experience breadth
  q14: 6,   // knowledge — years of experience
};

export function calculateScore(scores: QuizScores): number {
  let total = 0;

  const keys = [
    'q1','q2','q3','q4','q5','q6','q7','q8',
    'q9','q10','q11','q12','q13','q14',
  ] as const;

  for (const key of keys) {
    const raw = scores[key];
    const normMap = NORM[key];
    const weight = WEIGHTS[key];

    // Default to middle option if undefined
    const midIdx = Math.floor(normMap.length / 2);
    const idx = Math.min(Math.max(raw ?? midIdx, 0), normMap.length - 1);
    const normalized = normMap[idx];

    total += normalized * weight;
  }

  return Math.max(0, Math.min(100, Math.round(total)));
}

export function classifyInvestor(score: number): InvestorType {
  if (score < 25) return 'capital_protector';
  if (score < 50) return 'balanced_investor';
  if (score < 75) return 'growth_investor';
  return 'opportunity_seeker';
}

export function getPortfolioRecommendation(type: InvestorType): PortfolioAllocation {
  const portfolios: Record<InvestorType, PortfolioAllocation> = {
    capital_protector: { gold: 40, fixedIncome: 35, stocks: 15, crypto: 5, cash: 5 },
    balanced_investor: { gold: 30, fixedIncome: 25, stocks: 30, crypto: 10, cash: 5 },
    growth_investor: { gold: 20, fixedIncome: 10, stocks: 45, crypto: 20, cash: 5 },
    opportunity_seeker: { gold: 10, fixedIncome: 5, stocks: 45, crypto: 35, cash: 5 },
  };
  return portfolios[type];
}

export function getExpectedMaxDrawdown(type: InvestorType): string {
  const drawdowns: Record<InvestorType, string> = {
    capital_protector: '5 تا 10 درصد',
    balanced_investor: '10 تا 15 درصد',
    growth_investor: '20 تا 30 درصد',
    opportunity_seeker: '30 تا 50 درصد',
  };
  return drawdowns[type];
}

export function getInvestorTypeDescription(type: InvestorType): string {
  const descriptions: Record<InvestorType, string> = {
    capital_protector: `🟢 محافظ سرمایه (Capital Protector)\n\nمشخصات:\n• ریسک‌پذیری پایین\n• حساس به ضرر\n• حفظ ارزش پول مهم‌تر از سود زیاد`,
    balanced_investor: `🔵 متعادل (Balanced Investor)\n\nمشخصات:\n• تعادل بین رشد و امنیت\n• مناسب اکثر افراد`,
    growth_investor: `🟠 رشدگرا (Growth Investor)\n\nمشخصات:\n• دید بلندمدت\n• تحمل نوسان`,
    opportunity_seeker: `🔴 فرصت‌جو (Opportunity Seeker)\n\nمشخصات:\n• ریسک‌پذیری بالا\n• به دنبال بازدهی حداکثری`,
  };
  return descriptions[type];
}

export function formatPortfolioString(portfolio: PortfolioAllocation): string {
  return `دارایی | درصد\nطلا | ${portfolio.gold}%\nصندوق درآمد ثابت | ${portfolio.fixedIncome}%\nسهام | ${portfolio.stocks}%\nکریپتو | ${portfolio.crypto}%\nنقد | ${portfolio.cash}%`;
}
