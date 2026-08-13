import { TextChunk } from './chunker.ts';
import { DocumentSource, ChunkingStrategy } from '../src/types.ts';

const EMBEDDING_DIM = 256;

/**
 * Server-Side High-Performance Hybrid Vector & Lexical Engine
 * Maintains dense float32 normalized embeddings and inverted BM25 index on the server.
 */
export class ServerVectorEngine {
  private chunks: TextChunk[] = [];
  private embeddings: Float32Array | null = null; // Stored as contiguous flat buffer: (N * EMBEDDING_DIM)
  private idfMap: Map<string, number> = new Map();
  private docLengths: number[] = [];
  private avgDocLength = 0;
  private strategy: ChunkingStrategy = 'fixed_overlap';
  private indexedAt = 0;

  constructor() {}

  /**
   * Rebuilds the server-side vector and lexical index
   */
  public buildIndex(chunks: TextChunk[], strategy: ChunkingStrategy): void {
    const startTime = Date.now();
    this.chunks = chunks;
    this.strategy = strategy;
    const numChunks = chunks.length;

    if (numChunks === 0) {
      this.embeddings = new Float32Array(0);
      return;
    }

    // Allocate exact server-side contiguous Float32 buffer (numChunks * EMBEDDING_DIM)
    // Note: Never pass raw byte lengths to Float32Array constructor!
    this.embeddings = new Float32Array(numChunks * EMBEDDING_DIM);

    // 1. Build IDF map and BM25 statistics
    const docFreq: Map<string, number> = new Map();
    this.docLengths = [];
    let totalLength = 0;

    chunks.forEach((chunk, idx) => {
      const tokens = this.tokenize(chunk.text + ' ' + chunk.title);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      for (const t of uniqueTokens) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }

      // Generate normalized dense embedding
      const vec = this.computeDenseVector(tokens, chunk.title);
      // Copy into contiguous buffer
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        this.embeddings![idx * EMBEDDING_DIM + d] = vec[d];
      }
    });

    this.avgDocLength = totalLength / (numChunks || 1);
    this.idfMap.clear();
    for (const [term, df] of docFreq.entries()) {
      // BM25 IDF formulation
      const idf = Math.log(1 + (numChunks - df + 0.5) / (df + 0.5));
      this.idfMap.set(term, Math.max(0.1, idf));
    }

    this.indexedAt = Date.now() - startTime;
  }

  /**
   * Query the index with hybrid BM25 + Dense Vector scoring
   */
  public search(query: string, topK = 4): { sources: DocumentSource[]; searchTimeMs: number } {
    const t0 = performance.now();
    if (!this.chunks.length || !this.embeddings) {
      return { sources: [], searchTimeMs: 0 };
    }

    const queryTokens = this.tokenize(query);
    const queryVec = this.computeDenseVector(queryTokens, query);
    const scores: { index: number; score: number; denseScore: number; bm25Score: number }[] = [];

    const numChunks = this.chunks.length;

    // Fast batch scoring
    for (let i = 0; i < numChunks; i++) {
      // 1. Dense cosine similarity (both vectors are L2-normalized, so dot product = cosine)
      let dot = 0;
      const offset = i * EMBEDDING_DIM;
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        dot += queryVec[d] * this.embeddings[offset + d];
      }
      const denseScore = Math.max(0, dot);

      // 2. BM25 Lexical Score
      const bm25Score = this.computeBM25(queryTokens, i);

      // 3. Hybrid Fusion Score (Reciprocal Rank / Weighted Fusion)
      // Dense captures semantic nuance; BM25 guarantees exact acronym matches like "RAM", "ROM", "UPI"
      const hybridScore = 0.55 * denseScore + 0.45 * Math.min(1.0, bm25Score / 8.0);

      scores.push({
        index: i,
        score: hybridScore,
        denseScore,
        bm25Score
      });
    }

    // Sort by descending score
    scores.sort((a, b) => b.score - a.score);
    const topResults = scores.slice(0, topK);

    const sources: DocumentSource[] = topResults.map(res => {
      const chunk = this.chunks[res.index];
      return {
        id: chunk.id,
        title: chunk.title,
        text: chunk.text,
        score: Number(res.score.toFixed(4)),
        chunkStrategy: chunk.strategy,
        metadata: {
          category: chunk.metadata.category,
          passageId: chunk.metadata.passageId,
          charCount: chunk.metadata.charCount,
          wordCount: chunk.metadata.wordCount
        }
      };
    });

    const searchTimeMs = performance.now() - t0;
    return { sources, searchTimeMs };
  }

  public getStats() {
    return {
      strategy: this.strategy,
      totalChunks: this.chunks.length,
      dimension: EMBEDDING_DIM,
      indexingTimeMs: this.indexedAt
    };
  }

  /**
   * Tokenization with lowercase, alphanumeric normalization & n-grams
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * Fast Dense Vector feature projection with dimensional hashing & character n-grams
   */
  private computeDenseVector(tokens: string[], contextStr: string): Float32Array {
    const vec = new Float32Array(EMBEDDING_DIM);
    if (tokens.length === 0) return vec;

    for (const token of tokens) {
      // Feature hash single word
      const h1 = this.hashString(token);
      const idx1 = Math.abs(h1) % EMBEDDING_DIM;
      const sign1 = (h1 & 1) === 0 ? 1 : -1;
      const weight1 = this.idfMap.get(token) || 1.2;
      vec[idx1] += sign1 * weight1;

      // Feature hash 3-gram character subwords for morphological matching
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const sub = token.slice(i, i + 3);
          const hSub = this.hashString(sub);
          const idxSub = Math.abs(hSub) % EMBEDDING_DIM;
          vec[idxSub] += 0.3;
        }
      }
    }

    // Hash context header / title
    const ctxHash = this.hashString(contextStr.toLowerCase());
    const ctxIdx = Math.abs(ctxHash) % EMBEDDING_DIM;
    vec[ctxIdx] += 0.8;

    // L2-Normalize vector
    let sumSq = 0;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      sumSq += vec[d] * vec[d];
    }
    const norm = Math.sqrt(sumSq) || 1e-8;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      vec[d] /= norm;
    }

    return vec;
  }

  private computeBM25(queryTokens: string[], docIndex: number): number {
    const chunk = this.chunks[docIndex];
    const chunkTokens = this.tokenize(chunk.text + ' ' + chunk.title);
    const docLen = this.docLengths[docIndex] || chunkTokens.length;

    const termFreq: Map<string, number> = new Map();
    for (const t of chunkTokens) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }

    const k1 = 1.5;
    const b = 0.75;
    let score = 0;

    for (const qTerm of queryTokens) {
      const tf = termFreq.get(qTerm) || 0;
      if (tf > 0) {
        const idf = this.idfMap.get(qTerm) || 1.0;
        const num = tf * (k1 + 1);
        const denom = tf + k1 * (1 - b + b * (docLen / (this.avgDocLength || 1)));
        score += idf * (num / denom);
      }
    }

    return score;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}
