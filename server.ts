import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { RAGHarness } from './server/harness.ts';
import { SarvamSTTClient } from './server/sarvam.ts';
import { KNOWLEDGE_BASE, BENCHMARK_TEST_SUITE } from './server/dataset.ts';
import { ChunkingStrategy, BenchmarkSummary, BenchmarkResultItem } from './src/types.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure JSON parser with generous payload limit for base64 audio
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize server-side RAG Harness and Sarvam STT client
  const harness = new RAGHarness();
  const sarvamClient = new SarvamSTTClient();

  // --- API Routes ---

  // Health check endpoint (support both /health and /api/health)
  const healthHandler = (req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      service: 'Voice-Enabled RAG Pipeline',
      version: '1.0.0',
      dataset: 'MSMARCO-XI',
      engine: 'ServerVectorEngine',
      latency_target_ms: 200,
      timestamp: new Date().toISOString()
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Dataset info
  app.get('/api/dataset', (req, res) => {
    res.json({
      totalDocuments: KNOWLEDGE_BASE.length,
      datasetName: 'ai4bharat/MSMARCO-XI Knowledge Base',
      documents: KNOWLEDGE_BASE
    });
  });

  // Chunking stats
  app.get('/api/chunking-stats', (req, res) => {
    const stats = harness.getChunkingStats();
    res.json(stats);
  });

  // Reindex with chosen chunking strategy
  app.post('/api/chunking/reindex', (req, res) => {
    const { strategy } = req.body as { strategy: ChunkingStrategy };
    if (!strategy) {
      return res.status(400).json({ error: 'Missing strategy parameter' });
    }
    const result = harness.reindex(strategy);
    const stats = harness.getChunkingStats();
    res.json({ success: true, ...result, ...stats });
  });

  // Primary Query Endpoint (Text Input)
  // Supports POST /query and POST /api/query
  const queryHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { query, generator, strategy } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          answer: 'Please provide a valid query string.',
          sources: [],
          confidence: 0,
          grounded: false,
          latency_ms: 0,
          status: 'error'
        });
      }

      const result = await harness.executePipeline({
        query,
        generator: generator === 'llm' ? 'llm' : 'extractive',
        strategy
      });

      // Strict adherence to response specification:
      // answer, sources, confidence, grounded, latency_ms, status
      res.json(result);
    } catch (err: any) {
      console.error('Error in /query handler:', err);
      res.status(500).json({
        answer: 'An unexpected internal error occurred during retrieval.',
        sources: [],
        confidence: 0,
        grounded: false,
        latency_ms: 0,
        status: 'error',
        errorMessage: err.message
      });
    }
  };

  app.post('/query', queryHandler);
  app.post('/api/query', queryHandler);

  // Voice Query Endpoint (Audio Input or Base64 WebM/WAV)
  // Supports POST /voice-query and POST /api/voice-query
  const voiceQueryHandler = async (req: express.Request, res: express.Response) => {
    const t0 = performance.now();
    try {
      const { audioBase64, mimeType, transcript, generator, strategy } = req.body;
      let finalTranscript = transcript || '';
      let transcriptionMs = 0;

      // If audioBase64 provided, transcribe with Sarvam STT
      if (audioBase64) {
        try {
          const buffer = Buffer.from(audioBase64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
          const sttResult = await sarvamClient.transcribeAudio(buffer, mimeType || 'audio/webm');
          finalTranscript = sttResult.transcript;
          transcriptionMs = sttResult.duration_ms;
        } catch (sttErr: any) {
          console.warn('Sarvam STT failed, checking if client provided fallback transcript:', sttErr.message);
          if (!finalTranscript) {
            return res.status(422).json({
              answer: 'Voice transcription failed. Please try speaking again or use text input.',
              sources: [],
              confidence: 0,
              grounded: false,
              latency_ms: Math.round(performance.now() - t0),
              status: 'error',
              errorMessage: `STT Error: ${sttErr.message}`
            });
          }
        }
      }

      if (!finalTranscript || finalTranscript.trim().length === 0) {
        return res.status(400).json({
          answer: 'No speech could be recognized from the audio.',
          sources: [],
          confidence: 0,
          grounded: false,
          latency_ms: Math.round(performance.now() - t0),
          status: 'error'
        });
      }

      const result = await harness.executePipeline({
        query: finalTranscript,
        generator: generator === 'llm' ? 'llm' : 'extractive',
        strategy,
        transcriptionMs,
        transcribedText: finalTranscript
      });

      res.json(result);
    } catch (err: any) {
      console.error('Error in /voice-query handler:', err);
      res.status(500).json({
        answer: 'Failed to process voice query.',
        sources: [],
        confidence: 0,
        grounded: false,
        latency_ms: Math.round(performance.now() - t0),
        status: 'error',
        errorMessage: err.message
      });
    }
  };

  app.post('/voice-query', voiceQueryHandler);
  app.post('/api/voice-query', voiceQueryHandler);

  // Latency Analytics & Test Benchmark Suite
  app.post('/api/benchmark/run', async (req, res) => {
    try {
      const { generator = 'extractive', strategy = 'fixed_overlap' } = req.body;
      const results: BenchmarkResultItem[] = [];

      for (const item of BENCHMARK_TEST_SUITE) {
        const response = await harness.executePipeline({
          query: item.query,
          generator: generator as any,
          strategy: strategy as any
        });

        results.push({
          id: item.id,
          query: item.query,
          answer: response.answer,
          grounded: response.grounded,
          confidence: response.confidence,
          latency_ms: response.latency_ms,
          timings: response.timings,
          status: response.status,
          category: item.category
        });
      }

      // Calculate P50, P70, P90, P100 latency percentiles
      const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);
      const getPercentile = (p: number) => {
        const index = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
        return latencies[index];
      };

      const sumLatency = latencies.reduce((a, b) => a + b, 0);
      const avgLatency = Math.round(sumLatency / (latencies.length || 1));
      const p50 = getPercentile(50);
      const p70 = getPercentile(70);
      const p90 = getPercentile(90);
      const p100 = latencies[latencies.length - 1] || 0;
      const minLatency = latencies[0] || 0;

      const summary: BenchmarkSummary = {
        totalQueries: results.length,
        successfulQueries: results.filter(r => r.status === 'success').length,
        avgLatencyMs: avgLatency,
        p50Ms: p50,
        p70Ms: p70,
        p90Ms: p90,
        p100Ms: p100,
        minLatencyMs: minLatency,
        targetMet: p100 < 200 || p70 < 200,
        results
      };

      res.json(summary);
    } catch (err: any) {
      console.error('Benchmark execution error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite development middleware vs production static hosting
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Voice RAG Server running on http://localhost:${PORT}`);
  });
}

startServer();
