import type { Criteria, Lead, Route, ScoreBreakdown, Temperature } from "./types";

/**
 * Transparent, rule-based lead score (0-100). The LLM only contributes the
 * "intent strength" signal; everything else is deterministic so agents can
 * explain exactly why a lead is hot.
 */
export function scoreLead(lead: Lead, criteria?: Partial<Criteria>): {
  score: number;
  breakdown: ScoreBreakdown;
  temperature: Temperature;
  route: Route;
} {
  // Budget fit (25): overlap between the lead's range and the target market range.
  let budget = 12;
  if (criteria?.budgetMin != null && criteria?.budgetMax != null && lead.budgetMax > 0) {
    const lo = Math.max(lead.budgetMin, criteria.budgetMin);
    const hi = Math.min(lead.budgetMax, criteria.budgetMax);
    const span = Math.max(1, lead.budgetMax - lead.budgetMin);
    const overlap = Math.max(0, hi - lo) / span;
    budget = Math.round(8 + overlap * 17);
  } else if (lead.budgetMax > 0) {
    budget = 18;
  }

  const t = lead.timelineMonths;
  const timeline = t <= 3 ? 25 : t <= 6 ? 18 : t <= 12 ? 10 : 4;

  const financing =
    lead.financing === "cash"
      ? 20
      : lead.financing === "pre-approved"
        ? 18
        : lead.financing === "needs-mortgage"
          ? 8
          : 3;

  const engagement = Math.round((Math.min(10, Math.max(0, lead.engagement)) / 10) * 15);
  const intent = Math.round((Math.min(10, Math.max(0, lead.intentStrength ?? 5)) / 10) * 15);

  const breakdown = { budget, timeline, financing, engagement, intent };
  const score = Math.min(100, budget + timeline + financing + engagement + intent);
  const temperature: Temperature = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  const route: Route = temperature === "hot" ? "call" : temperature === "warm" ? "nurture" : "drip";
  return { score, breakdown, temperature, route };
}

export const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}K`
      : `$${n}`;
