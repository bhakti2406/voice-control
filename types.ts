export type ChunkingStrategy = 'fixed_overlap' | 'semantic_sentence' | 'hierarchical' | 'recursive_char';

export type GeneratorMode = 'extractive' | 'llm';

export interface DocumentSource {
  id: string;
  title: string;
  text: string;
  score: number;
  chunkStrategy?: ChunkingStrategy;
  metadata?: {
    category?: string;
    passageId?: string;
    charCount?: number;
    wordCount?: number;
  };
}

export interface GuardrailResult {
  passed: boolean;
  groundingScore: number;
  confidence: number;
  checks: {
    safety: boolean;
    domainRelevance: boolean;
    hallucinationSafe: boolean;
  };
  rejectionReason?: string;
}

export interface LatencyTimings {
  transcriptionMs: number;
  preprocessingMs: number;
  retrievalMs: number;
  generationMs: number;
  guardrailsMs: number;
  totalMs: number;
}

export interface RAGResponse {
  answer: string;
  sources: DocumentSource[];
  confidence: number;
  grounded: boolean;
  latency_ms: number;
  timings: LatencyTimings;
  guardrail: GuardrailResult;
  generator: GeneratorMode;
  chunkingStrategy: ChunkingStrategy;
  query: string;
  transcribedText?: string;
  status: 'success' | 'refused' | 'error';
  errorMessage?: string;
}

export interface BenchmarkQueryItem {
  id: string;
  query: string;
  category: string;
  expectedAnswerSubstring?: string;
  isOffTopic?: boolean;
}

export interface BenchmarkResultItem {
  id: string;
  query: string;
  answer: string;
  grounded: boolean;
  confidence: number;
  latency_ms: number;
  timings: LatencyTimings;
  status: string;
  category: string;
}

export interface BenchmarkSummary {
  totalQueries: number;
  successfulQueries: number;
  avgLatencyMs: number;
  p50Ms: number;
  p70Ms: number;
  p90Ms: number;
  p100Ms: number;
  minLatencyMs: number;
  targetMet: boolean; // <200ms
  results: BenchmarkResultItem[];
}

export interface ChunkingStats {
  strategy: ChunkingStrategy;
  totalDocuments: number;
  totalChunks: number;
  avgChunkSizeChars: number;
  avgChunkSizeWords: number;
  indexingTimeMs: number;
  dimension: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  latency_ms: number;
  timestamp: Date | string;
  status: 'success' | 'refused' | 'error';
  grounded?: boolean;
  generator?: GeneratorMode;
  chunkingStrategy?: ChunkingStrategy;
  confidence?: number;
}
