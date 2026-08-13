import { GoogleGenAI } from '@google/genai';
import { RawDocument, KNOWLEDGE_BASE } from './dataset.ts';
import { DocumentChunker } from './chunker.ts';
import { ServerVectorEngine } from './vectorEngine.ts';
import { GuardrailEngine } from './guardrails.ts';
import {
  ChunkingStrategy,
  GeneratorMode,
  RAGResponse,
  DocumentSource,
  LatencyTimings,
  GuardrailResult
} from '../src/types.ts';

export class RAGHarness {
  private vectorEngine: ServerVectorEngine;
  private currentStrategy: ChunkingStrategy = 'fixed_overlap';
  private documents: RawDocument[] = KNOWLEDGE_BASE;
  private geminiClient: GoogleGenAI | null = null;

  constructor() {
    this.vectorEngine = new ServerVectorEngine();
    this.reindex('fixed_overlap');
  }

  private getGemini(): GoogleGenAI | null {
    if (!this.geminiClient && process.env.GEMINI_API_KEY) {
      this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.geminiClient;
  }

  /**
   * Reindexes with the specified chunking strategy
   */
  public reindex(strategy: ChunkingStrategy): { totalChunks: number; indexingTimeMs: number } {
    this.currentStrategy = strategy;
    const chunks = DocumentChunker.chunkDocuments(this.documents, strategy);
    this.vectorEngine.buildIndex(chunks, strategy);
    const stats = this.vectorEngine.getStats();
    return {
      totalChunks: stats.totalChunks,
      indexingTimeMs: stats.indexingTimeMs
    };
  }

  public getChunkingStats() {
    const chunks = DocumentChunker.chunkDocuments(this.documents, this.currentStrategy);
    let totalChars = 0;
    let totalWords = 0;
    for (const c of chunks) {
      totalChars += c.metadata.charCount;
      totalWords += c.metadata.wordCount;
    }
    const avgChars = chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0;
    const avgWords = chunks.length > 0 ? Math.round(totalWords / chunks.length) : 0;

    return {
      strategy: this.currentStrategy,
      totalDocuments: this.documents.length,
      totalChunks: chunks.length,
      avgChunkSizeChars: avgChars,
      avgChunkSizeWords: avgWords,
      indexingTimeMs: this.vectorEngine.getStats().indexingTimeMs,
      dimension: this.vectorEngine.getStats().dimension
    };
  }

  /**
   * Complete End-to-End Orchestrated Query Execution
   */
  public async executePipeline(params: {
    query: string;
    generator?: GeneratorMode;
    strategy?: ChunkingStrategy;
    transcriptionMs?: number;
    transcribedText?: string;
  }): Promise<RAGResponse> {
    const pipelineStart = performance.now();
    const generator: GeneratorMode = params.generator || 'extractive';
    const strategy: ChunkingStrategy = params.strategy || this.currentStrategy;
    const transcriptionMs = params.transcriptionMs || 0;

    // If strategy changed, reindex
    if (strategy !== this.currentStrategy) {
      this.reindex(strategy);
    }

    // Step 1: Query Preprocessing & Normalization
    const tPrepStart = performance.now();
    const rawQuery = params.query || '';
    const cleanedQuery = rawQuery.trim().replace(/\s+/g, ' ');
    const prepMs = performance.now() - tPrepStart;

    // Step 2: Guardrail Input Safety Check
    const safetyCheck = GuardrailEngine.checkInputSafety(cleanedQuery);
    if (!safetyCheck.safe) {
      const totalMs = Math.round(performance.now() - pipelineStart + transcriptionMs);
      return {
        answer: `I cannot process this request: ${safetyCheck.reason}`,
        sources: [],
        confidence: 0,
        grounded: false,
        latency_ms: totalMs,
        timings: {
          transcriptionMs: Math.round(transcriptionMs),
          preprocessingMs: Math.round(prepMs),
          retrievalMs: 0,
          generationMs: 0,
          guardrailsMs: 1,
          totalMs
        },
        guardrail: {
          passed: false,
          groundingScore: 0,
          confidence: 0,
          checks: { safety: false, domainRelevance: false, hallucinationSafe: false },
          rejectionReason: safetyCheck.reason
        },
        generator,
        chunkingStrategy: this.currentStrategy,
        query: cleanedQuery,
        transcribedText: params.transcribedText,
        status: 'refused'
      };
    }

    // Step 3: Vector & Hybrid Retrieval (< 15ms target)
    const { sources, searchTimeMs } = this.vectorEngine.search(cleanedQuery, 3);
    const retrievalMs = searchTimeMs;

    // Step 4: Answer Generation
    const tGenStart = performance.now();
    let answerText = '';
    let genStatus: 'success' | 'refused' | 'error' = 'success';

    if (sources.length === 0 || sources[0].score < 0.18) {
      answerText = "Based on the retrieved context from the MS MARCO dataset, there is insufficient information to answer this question accurately.";
      genStatus = 'refused';
    } else if (generator === 'extractive') {
      answerText = this.generateExtractiveAnswer(cleanedQuery, sources);
    } else {
      // LLM Mode via Gemini with graceful extractive fallback
      try {
        answerText = await this.generateLLMAnswer(cleanedQuery, sources);
      } catch (err: any) {
        console.warn('LLM Generation fallback to extractive:', err.message);
        answerText = this.generateExtractiveAnswer(cleanedQuery, sources);
      }
    }
    const generationMs = performance.now() - tGenStart;

    // Step 5: Post-Generation Guardrail & Grounding Evaluation
    const tGuardStart = performance.now();
    const guardrailResult: GuardrailResult = GuardrailEngine.evaluateGrounding(cleanedQuery, answerText, sources);
    const guardrailsMs = performance.now() - tGuardStart;

    // If grounding check fails and not already refused
    if (!guardrailResult.passed && genStatus === 'success') {
      if (sources[0].score < 0.22) {
        answerText = "I am unable to answer this question with high confidence because it falls outside the verified dataset context.";
        genStatus = 'refused';
      }
    }

    const totalMs = Math.round(performance.now() - pipelineStart + transcriptionMs);
    const timings: LatencyTimings = {
      transcriptionMs: Math.round(transcriptionMs),
      preprocessingMs: Math.round(prepMs),
      retrievalMs: Math.round(retrievalMs),
      generationMs: Math.round(generationMs),
      guardrailsMs: Math.round(guardrailsMs),
      totalMs
    };

    return {
      answer: answerText,
      sources,
      confidence: guardrailResult.confidence,
      grounded: guardrailResult.passed,
      latency_ms: totalMs,
      timings,
      guardrail: guardrailResult,
      generator,
      chunkingStrategy: this.currentStrategy,
      query: cleanedQuery,
      transcribedText: params.transcribedText,
      status: genStatus
    };
  }

  /**
   * Ultra-Fast Extractive Generator (< 2ms)
   * Extracts the most relevant factual sentence/span from the top retrieved chunks
   */
  private generateExtractiveAnswer(query: string, sources: DocumentSource[]): string {
    const qLower = query.toLowerCase();
    const topChunk = sources[0];
    const text = topChunk.text;

    // 1. Check for specific acronym queries like "RAM", "ROM", "CPU", "GPU", "UPI", "ISRO", etc.
    const acronymMatch = qLower.match(/full\s+form\s+of\s+([a-z0-9]+)/i) || qLower.match(/what\s+is\s+([a-z0-9]{2,6})/i);
    if (acronymMatch) {
      const acronym = acronymMatch[1].toUpperCase();
      // Search for sentence containing "full form of <ACRONYM> is" or "<ACRONYM> is" or "<ACRONYM> stands for"
      const sentences = text.split(/(?<=[.?!])\s+/g);
      for (const sent of sentences) {
        if (sent.includes(acronym) || sent.toLowerCase().includes(acronymMatch[1].toLowerCase())) {
          return sent.trim();
        }
      }
    }

    // 2. Sentence-level relevance matching
    const queryWords = qLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const sentences = text.split(/(?<=[.?!])\s+/g).filter(s => s.trim().length > 0);

    let bestSent = sentences[0] || text;
    let maxMatches = -1;

    for (const sent of sentences) {
      const sentLower = sent.toLowerCase();
      let matchCount = 0;
      for (const word of queryWords) {
        if (sentLower.includes(word)) matchCount++;
      }
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestSent = sent;
      }
    }

    // If query asked a definition question, take the first 1-2 most informative sentences
    if (sentences.length > 1 && bestSent === sentences[0]) {
      return `${sentences[0]} ${sentences[1]}`.trim();
    }

    return bestSent.trim();
  }

  /**
   * Structured LLM Generator using Gemini 3.7 Flash with Grounding Prompt & Timeout
   */
  private async generateLLMAnswer(query: string, sources: DocumentSource[]): Promise<string> {
    const ai = this.getGemini();
    if (!ai || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return this.generateExtractiveAnswer(query, sources);
    }

    const contextPassages = sources
      .map((s, idx) => `[Source ${idx + 1}: ${s.title}]\n${s.text}`)
      .join('\n\n');

    const prompt = `You are a strictly grounded, voice-optimized factual answering assistant in a RAG pipeline.
Answer the user's question using ONLY the provided context passages below.
Guidelines:
- Keep the answer concise, direct, and conversational (1 to 3 sentences, perfect for voice read-out).
- State the direct answer immediately in the first sentence.
- If the context does not contain the answer, say "Based on the provided dataset context, I cannot answer this question."
- Do not speculate or introduce unverified outside knowledge.

Context Passages:
${contextPassages}

Question:
${query}

Answer:`;

    const apiCall = ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM call timed out after 4000ms')), 4000)
    );

    const response = await Promise.race([apiCall, timeoutPromise]);

    const text = (response as any).text ? (response as any).text.trim() : '';
    if (!text) {
      return this.generateExtractiveAnswer(query, sources);
    }
    return text;
  }
}
