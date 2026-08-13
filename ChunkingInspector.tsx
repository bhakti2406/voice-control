import React, { useState, useEffect } from 'react';
import { Layers, Split, Database, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ChunkingStrategy, ChunkingStats } from '../types.ts';

interface ChunkingInspectorProps {
  currentStrategy: ChunkingStrategy;
  onStrategyChange: (strategy: ChunkingStrategy) => void;
}

export const ChunkingInspector: React.FC<ChunkingInspectorProps> = ({
  currentStrategy,
  onStrategyChange
}) => {
  const [stats, setStats] = useState<ChunkingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = async (strategy = currentStrategy) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chunking-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Failed to fetch chunking stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentStrategy]);

  const handleSelectStrategy = async (strat: ChunkingStrategy) => {
    onStrategyChange(strat);
    setIsLoading(true);
    try {
      const res = await fetch('/api/chunking/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strat })
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Reindex error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const strategies = [
    {
      id: 'fixed_overlap' as ChunkingStrategy,
      name: 'Fixed-Size with Overlap',
      desc: '220-char windows with 45-char sliding overlap at whitespace boundaries. Prevents boundary token cutoff.',
      badge: 'Classic Benchmark'
    },
    {
      id: 'semantic_sentence' as ChunkingStrategy,
      name: 'Semantic Sentence Boundary',
      desc: 'Groups 2 sentences using NLP boundary detection. Preserves complete thought units without fragmentation.',
      badge: 'High Precision'
    },
    {
      id: 'hierarchical' as ChunkingStrategy,
      name: 'Hierarchical & Metadata-Aware',
      desc: 'Injects [Category | Title] breadcrumbs into every chunk, enabling category-grounded vector similarity.',
      badge: 'Context Rich'
    },
    {
      id: 'recursive_char' as ChunkingStrategy,
      name: 'Recursive Character Splitting',
      desc: 'Priority splitting on paragraphs (\\n\\n) -> sentences (\\n, .) -> clauses, keeping semantic coherence.',
      badge: 'Adaptive'
    }
  ];

  return (
    <div id="chunking-inspector-card" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Vast Multi-Strategy Chunking Architecture
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch chunking logic to observe how document partitioning and index density impact retrieval
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>{stats.totalChunks} Chunks</span>
            <span className="text-slate-600">•</span>
            <span>Dim: {stats.dimension}</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-bold">{stats.indexingTimeMs}ms index</span>
          </div>
        )}
      </div>

      {/* Strategy Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {strategies.map((strat) => {
          const isSelected = currentStrategy === strat.id;
          return (
            <button
              key={strat.id}
              type="button"
              id={`strat-btn-${strat.id}`}
              onClick={() => handleSelectStrategy(strat.id)}
              disabled={isLoading}
              className={`text-left p-4 rounded-xl border transition-all relative ${
                isSelected
                  ? 'bg-cyan-950/30 border-cyan-500/80 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-100">{strat.name}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {strat.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{strat.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Real-time Chunker Statistics Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-center text-xs">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Source Documents</div>
            <div className="text-base font-mono font-bold text-slate-200 mt-0.5">{stats.totalDocuments} docs</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Total Chunks</div>
            <div className="text-base font-mono font-bold text-cyan-400 mt-0.5">{stats.totalChunks}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Avg Chunk Length</div>
            <div className="text-base font-mono font-bold text-slate-200 mt-0.5">{stats.avgChunkSizeChars} chars</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Avg Word Count</div>
            <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">{stats.avgChunkSizeWords} words</div>
          </div>
        </div>
      )}
    </div>
  );
};
