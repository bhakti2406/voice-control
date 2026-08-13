import React from 'react';
import { History, RotateCcw, Zap, Clock, ChevronRight, CheckCircle2, Trash2, ArrowUpRight } from 'lucide-react';
import { SearchHistoryItem } from '../types.ts';

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelectQuery: (query: string) => void;
  onClearHistory?: () => void;
  isLoading?: boolean;
  activeQuery?: string;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onSelectQuery,
  onClearHistory,
  isLoading = false,
  activeQuery = ''
}) => {
  return (
    <div id="search-history-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-black/30">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
              Search History
            </h2>
            <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-mono px-1.5 py-0.2 rounded border border-cyan-500/20">
              {history.length}/5
            </span>
          </div>

          {history.length > 0 && onClearHistory && (
            <button
              type="button"
              id="clear-history-btn"
              onClick={onClearHistory}
              title="Clear search history"
              className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* History List (max 5 items) */}
        {history.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-[11px]">No recent queries recorded.</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Run a query to track latency metrics.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((item, index) => {
              const isActive = activeQuery.trim().toLowerCase() === item.query.trim().toLowerCase();
              const isSub200 = item.latency_ms < 200;

              return (
                <div
                  key={item.id || index}
                  id={`history-item-${index}`}
                  className={`group relative p-2.5 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-cyan-950/30 border-cyan-500/60 shadow-sm'
                      : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <button
                      type="button"
                      id={`rerun-history-btn-${index}`}
                      onClick={() => onSelectQuery(item.query)}
                      disabled={isLoading}
                      className="text-left font-medium text-xs text-slate-200 hover:text-cyan-300 transition-colors line-clamp-2 flex-1"
                      title={`Click to re-run: "${item.query}"`}
                    >
                      <span className="font-mono text-slate-500 text-[10px] mr-1.5">#{index + 1}</span>
                      {item.query}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectQuery(item.query)}
                      disabled={isLoading}
                      className="flex-none opacity-80 group-hover:opacity-100 p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-all"
                      title="Re-run query"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
                          isSub200
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {item.latency_ms}ms
                      </span>

                      {item.generator && (
                        <span className="text-slate-500 uppercase text-[9px]">
                          {item.generator}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-500 text-[9px] flex items-center gap-1">
                      <span>{typeof item.timestamp === 'string' ? item.timestamp : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <ChevronRight className="w-2.5 h-2.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>History Cache: React State</span>
        <span className="text-cyan-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Fast Re-Run
        </span>
      </div>
    </div>
  );
};
