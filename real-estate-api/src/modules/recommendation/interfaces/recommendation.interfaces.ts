export interface ScoredProperty {
  id: number;
  score: number;
  reason: string;
}

export interface HybridScoredProperty {
  id: number;
  type: 'house' | 'land';
  district: string;
  price: number;
  embeddingScore: number;
  ruleScore: number;
  finalScore: number;
  reasons: string[];
}

export interface UserProfile {
  avgPrice: number;
  avgArea: number;
  locationCounts: Record<string, number>;
  categoryCounts: Record<number, number>;
  totalWeight: number;
}

export interface VectorSearchResult {
  id: number;
  score: number;
  payload: Record<string, unknown>;
}

export interface WeightedInteraction {
  id: number;
  type: 'house' | 'land';
  qdrantId: number;
  weight: number;
}

export interface InteractedProperty {
  id: number;
  type: 'house' | 'land';
  price: any;
  city: string | null;
  district: string | null;
  area: number | null;
  categoryId: number | null;
  landType?: string | null;
}

export interface WeightedItem {
  id: number;
  price: any;
  city: string | null;
  district: string | null;
  area: number | null;
  categoryId: number | null;
  weight: number;
  landType?: string | null;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface PropertyCandidate {
  id: number;
  price: any;
  city: string | null;
  district: string | null;
  area: number | null;
  categoryId: number | null;
  createdAt: Date;
  category?: any;
  images?: any[];
  landType?: string | null;
}
