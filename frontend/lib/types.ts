export type ArticleCard = {
  id: string;
  entity_id: string;
  slug: string;
  title: string;
  summary: string;
  domain: string;
  ontology: string;
  symbol?: string;
  claim_count?: number;
  updated_at?: string;
  reasons?: string[];
};
export type Source = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  source_type: string;
  published_at: string | null;
  retrieved_at: string;
  license: string;
  excerpt?: string;
  stance?: string;
  health?: string;
};
export type Claim = {
  id: string;
  text: string;
  status: string;
  rationale: string;
  article_id?: string;
  slug?: string;
  title?: string;
  sources?: Source[];
};
export type Content = {
  schemaVersion: number;
  sections: {
    id: string;
    title: string;
    claims: string[];
    explanation?: string;
    reviewed?: boolean;
  }[];
  attributes: Record<string, { value: string; claimId: string }>;
  editorialNote?: string;
};
export type Article = ArticleCard & {
  content: Content;
  version: number;
  claims: Claim[];
  sources: Source[];
  evidence_summary?: {
    total_claims: number;
    verified_claims: number;
    contradicting_excerpts: number;
    last_verified_at: string | null;
  };
  indexing: {
    destination: string;
    version: number;
    state: string;
    error?: string;
  }[];
};
export type Entity = {
  id: string;
  name: string;
  slug: string;
  article_slug?: string;
  domain: string;
  ontology: string;
  description: string;
  degree?: number;
};
export type Edge = {
  id: string;
  from_entity: string;
  to_entity: string;
  type: string;
  claim_id: string;
  status: string;
  explanation: string;
};
export type GraphData = { nodes: Entity[]; edges: Edge[]; source: string };
export type JobEvent = {
  id: number;
  stage: string;
  message: string;
  created_at: string;
};
export type ResearchClaim = {
  id: string;
  text: string;
  status: string;
  rationale: string;
  evidence: { sourceId: string; excerpt: string; stance: string }[];
};
export type ResearchSource = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  text: string;
  sourceType: string;
  license: string;
};
export type Job = {
  id: string;
  topic: string;
  ontology: string;
  state: string;
  error: string | null;
  created_at: string;
  events: JobEvent[];
  checkpoint: {
    sources?: ResearchSource[];
    claims?: ResearchClaim[];
    warnings?: string[];
    questions?: string[];
    triples?: unknown[];
    media?: unknown[];
  };
  draft?: { title: string; summary: string; method: string; content?: Content };
  article_id?: string;
};
export type User = {
  authenticated: boolean;
  id?: string;
  email?: string;
  role?: string;
};
export type Collection = {
  id: string;
  name: string;
  description: string;
  public: boolean;
  item_count: number;
  items?: ArticleCard[];
};
