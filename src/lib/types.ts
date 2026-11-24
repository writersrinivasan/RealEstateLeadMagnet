export type Intent = "buy" | "sell" | "rent" | "invest";
export type Financing = "cash" | "pre-approved" | "needs-mortgage" | "unknown";
export type Temperature = "hot" | "warm" | "cold";
export type Route = "call" | "nurture" | "drip";

export const FUNNEL_STAGES = [
  "new",
  "qualified",
  "contacted",
  "appointment",
  "negotiation",
  "client",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number] | "lost";

export const LEAD_SOURCES = [
  "Portal Inquiry",
  "Open House",
  "Referral",
  "Social Ads",
  "Website",
  "Expired Listing",
  "FSBO",
] as const;

export interface ScoreBreakdown {
  budget: number; // /25
  timeline: number; // /25
  financing: number; // /20
  engagement: number; // /15
  intent: number; // /15
}

export interface QualSignal {
  dimension: "budget" | "authority" | "need" | "timeline" | "objection" | "appointment";
  detail: string;
  strength: number; // 1-5
}

export interface CallTurn {
  role: "agent" | "prospect";
  text: string;
}

export interface CallAssessment {
  conversionProbability: number; // 0-100
  verdict: string;
  bant: { budget: number; authority: number; need: number; timeline: number }; // 0-10 each
  sentiment: number; // 0-100
  objections: string[];
  buyingSignals: string[];
  nextBestAction: string;
  recommendedStage: FunnelStage;
  summary: string;
  engine?: string;
}

export interface CallResult {
  at: string;
  transcript: CallTurn[];
  signals: QualSignal[];
  assessment?: CallAssessment;
  engine: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  neighborhood: string;
  intent: Intent;
  propertyType: string;
  budgetMin: number;
  budgetMax: number;
  timelineMonths: number;
  financing: Financing;
  source: string;
  engagement: number; // 0-10
  notes: string;
  // enrichment
  motivation?: string;
  intentStrength?: number; // 0-10
  signals?: string[];
  likelyObjections?: string[];
  // scoring
  score?: number;
  temperature?: Temperature;
  breakdown?: ScoreBreakdown;
  route?: Route;
  outreach?: string;
  // funnel
  stage: FunnelStage;
  call?: CallResult;
  createdAt: string;
}

export interface Criteria {
  city: string;
  intent: Intent | "mixed";
  propertyType: string;
  budgetMin: number;
  budgetMax: number;
  count: number;
}

export interface PipelineLog {
  node: string;
  message: string;
  at: string;
}
