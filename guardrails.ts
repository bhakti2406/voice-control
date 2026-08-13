import { DocumentSource, GuardrailResult } from '../src/types.ts';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|prior\s+)?instructions/i,
  /reveal\s+(the\s+)?(system\s+prompt|developer\s+mode|internal\s+instructions)/i,
  /you\s+are\s+now\s+dan/i,
  /bypass\s+all\s+guardrails/i,
  /<script>/i,
  /drop\s+table/i
];

const PROFANITY_AND_UNSAFE = [
  /kill\s+yourself/i,
  /how\s+to\s+make\s+a\s+bomb/i,
  /hack\s+into/i
];

export class GuardrailEngine {
  /**
   * Pre-execution safety check on user input query
   */
  public static checkInputSafety(query: string): { safe: boolean; reason?: string } {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return { safe: false, reason: "Query is empty or too short." };
    }

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { safe: false, reason: "Prompt injection / policy violation detected." };
      }
    }

    for (const pattern of PROFANITY_AND_UNSAFE) {
      if (pattern.test(trimmed)) {
        return { safe: false, reason: "Inappropriate or unsafe content query detected." };
      }
    }

    return { safe: true };
  }

  /**
   * Post-retrieval and post-generation grounding & hallucination analysis
   */
  public static evaluateGrounding(
    query: string,
    answer: string,
    sources: DocumentSource[]
  ): GuardrailResult {
    // 1. Check if sources exist or if scores are negligible
    if (!sources || sources.length === 0 || sources[0].score < 0.18) {
      return {
        passed: false,
        groundingScore: 0.05,
        confidence: 0.1,
        checks: {
          safety: true,
          domainRelevance: false,
          hallucinationSafe: false
        },
        rejectionReason: "No relevant documents found in dataset for this query."
      };
    }

    // 2. Compute Lexical & Key Term Overlap between Answer and Retrieved Sources
    const combinedSourceText = sources.map(s => s.text.toLowerCase()).join(' ');
    const answerTokens = answer
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    let matchingTokens = 0;
    for (const token of answerTokens) {
      if (combinedSourceText.includes(token)) {
        matchingTokens++;
      }
    }

    const tokenOverlapRatio = answerTokens.length > 0 ? (matchingTokens / answerTokens.length) : 0;
    const topSourceScore = sources[0].score;

    // Composite Grounding Score
    const groundingScore = Number((0.6 * topSourceScore + 0.4 * tokenOverlapRatio).toFixed(3));
    const confidence = Number((Math.min(1.0, (topSourceScore * 0.7 + tokenOverlapRatio * 0.3) * 1.15)).toFixed(3));

    // Thresholds
    const domainRelevance = topSourceScore >= 0.22;
    const hallucinationSafe = tokenOverlapRatio >= 0.35 || topSourceScore >= 0.45;
    const passed = domainRelevance && hallucinationSafe && confidence >= 0.30;

    return {
      passed,
      groundingScore,
      confidence,
      checks: {
        safety: true,
        domainRelevance,
        hallucinationSafe
      },
      rejectionReason: passed ? undefined : "Answer lacks sufficient grounding in retrieved MS MARCO context."
    };
  }
}
