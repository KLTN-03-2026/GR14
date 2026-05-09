export type IndexedDoc = {
  id: number;
  text: string;
  payload: Record<string, unknown>;
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

export type IntentType =
  | 'search_property'
  | 'recommend_property'
  | 'qa_real_estate'
  | 'compare_property'
  | 'booking'
  | 'upgrade_account'
  | 'upgrade_listing'
  | 'greeting'
  | 'investment_advice'
  | 'market_analysis'
  | 'financing_advice'
  | 'consultation'
  | 'unknown';

export type ParsedIntent = {
  type: IntentType;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  locationTokens?: string[];
  sourceType?: 'house' | 'land' | 'post';
  requiredKeyword?: string;
  compareIds?: number[];
  compareDescriptions?: string[]; // named property descriptions to search separately
  transactionType?: 'sale' | 'rent';
  purpose?: 'invest' | 'live' | 'rent_out'; // user's purpose for buying
  monthlyIncome?: number; // for financing calculations
  downPayment?: number; // for financing calculations
};

export type VectorHit = {
  id: number;
  score: number;
  payload: Record<string, unknown>;
};

export type ChatSourcePayload = Record<string, unknown>;

export type ConversationState = {
  memoryKey: string;
  summaryKey: string;
  memory: ChatTurn[];
  summaryMemory: string;
};

export type ChatResponsePayload = {
  answer: string;
  structured: Record<string, unknown> | null;
  intent: ParsedIntent;
  confidence: number;
  sources: ChatSourcePayload[];
  relatedSources: ChatSourcePayload[];
  suggestedQuestions: string[];
};

export type ChatResult = {
  ok: true;
  sessionId: string;
  answer: string;
  structured: Record<string, unknown> | null;
  intent: ParsedIntent;
  confidence: number;
  sources: ChatSourcePayload[];
  relatedSources: ChatSourcePayload[];
  suggestedQuestions: string[];
  memoryTurns: number;
};

// ─── User Profile ───────────────────────────────────────────────────

export type UserProfile = {
  sessionId: string;
  preferredAreas: string[];
  preferredDistricts: string[];
  budgetMin?: number;
  budgetMax?: number;
  propertyType?: 'house' | 'land';
  purpose?: 'invest' | 'live' | 'rent_out';
  bedrooms?: number;
  transactionType?: 'sale' | 'rent';
  viewedPropertyIds: number[];
  dislikedPropertyIds: number[];
  interactionCount: number;
  lastActiveAt: string;
  keywords: string[]; // accumulated search keywords
};

// ─── Consultation Flow ──────────────────────────────────────────────

export type ConsultationStep =
  | 'idle'
  | 'ask_purpose'
  | 'ask_budget'
  | 'ask_location'
  | 'ask_property_type'
  | 'ask_criteria'
  | 'recommend'
  | 'completed';

export type ConsultationState = {
  step: ConsultationStep;
  purpose?: 'invest' | 'live' | 'rent_out';
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  propertyType?: 'house' | 'land';
  bedrooms?: number;
  additionalCriteria?: string;
  startedAt: string;
};

// ─── Market Insight ─────────────────────────────────────────────────

export type MarketInsight = {
  area: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalListings: number;
  avgPricePerM2: number;
  priceBreakdown: { range: string; count: number }[];
};

// ─── Financing ──────────────────────────────────────────────────────

export type FinancingResult = {
  maxLoanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  affordablePrice: number;
  loanToValue: number;
  interestRate: number;
  loanTermYears: number;
  downPaymentRequired: number;
};
