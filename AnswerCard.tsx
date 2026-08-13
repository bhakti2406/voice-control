import React, { useState } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { RAGResponse } from '../types.ts';

interface AnswerCardProps {
  response: RAGResponse | null;
  isLoading: boolean;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ response, isLoading }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (isLoading) {
    return (
      <div id="answer-card-loading" className="space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-800 rounded w-36"></div>
          <div className="h-4 bg-slate-800 rounded w-24"></div>
        </div>
        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 space-y-3">
          <div className="h-4 bg-slate-800 rounded w-full"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6"></div>
          <div className="h-4 bg-slate-800 rounded w-4/6"></div>
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-slate-800/40 rounded border border-slate-800"></div>
          <div className="h-8 bg-slate-800/40 rounded border border-slate-800"></div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div id="answer-card-empty" className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center min-h-[220px] flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">Awaiting Retrieval Query</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Speak or submit a question to extract grounded factual answers with sub-200ms vector retrieval.
        </p>
      </div>
    );
  }

  const handleSpeakAnswer = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(response.answer);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  return (
    <div id="rag-response-card" className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {response.generator === 'extractive' ? 'Extractive Response' : 'LLM Synthesized Response'}
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">
            ({response.latency_ms}ms)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
            Grounded: {response.grounded ? 'TRUE' : 'FALSE'}
          </span>
          <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">
            Conf: {(response.confidence * 100).toFixed(1)}%
          </span>
          <button
            id="speak-answer-btn"
            type="button"
            onClick={handleSpeakAnswer}
            className={`p-1 rounded border transition-all ${
              isPlayingAudio
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Read answer aloud via TTS"
          >
            {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Answer Body Container */}
      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 text-base text-slate-200 leading-relaxed min-h-[110px] relative">
        <p id="answer-text-content">
          {response.answer}
        </p>

        {response.transcribedText && (
          <div className="mt-3 pt-2.5 border-t border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-[10px] uppercase">STT Transcription:</span>
            <span className="italic text-slate-400">&quot;{response.transcribedText}&quot;</span>
          </div>
        )}
      </div>

      {/* Latency Breakdown Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Vector Search</div>
          <div className="text-cyan-400 font-bold mt-0.5">{response.timings?.retrievalMs || 0}ms</div>
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Generation</div>
          <div className="text-cyan-400 font-bold mt-0.5">{response.timings?.generationMs || 0}ms</div>
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Guardrails</div>
          <div className="text-emerald-400 font-bold mt-0.5">{response.timings?.guardrailsMs || 0}ms</div>
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Total Latency</div>
          <div className="text-emerald-400 font-bold mt-0.5">{response.latency_ms}ms</div>
        </div>
      </div>

      {/* Source References */}
      <div className="mt-2">
        <h3 className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-mono">
          Source References ({response.sources?.length || 0})
        </h3>
        <div className="space-y-2">
          {response.sources && response.sources.length > 0 ? (
            response.sources.map((src, idx) => (
              <div
                key={idx}
                id={`source-item-${idx}`}
                className="text-xs p-2.5 bg-slate-800/40 rounded border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200 truncate pr-2">
                    {src.id}.txt ({src.title})
                  </span>
                  <span className="text-cyan-400 font-mono text-[11px] flex-none">
                    Score: {src.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  {src.text}
                </p>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 italic">No source references found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

