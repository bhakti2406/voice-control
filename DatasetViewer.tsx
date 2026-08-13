import React, { useState, useEffect } from 'react';
import { Database, Search, ExternalLink, BookOpen, Tag } from 'lucide-react';

interface DatasetDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  url?: string;
}

export const DatasetViewer: React.FC = () => {
  const [documents, setDocuments] = useState<DatasetDoc[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchDataset = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/dataset');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.warn('Error fetching dataset:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDataset();
  }, []);

  const categories = ['All', 'Hardware', 'AI & ML', 'Networking', 'Operating Systems', 'General Science', 'Digital India'];

  const filteredDocs = documents.filter(doc => {
    const matchesCat = filterCategory === 'All' || doc.category === filterCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div id="dataset-viewer-card" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            ai4bharat / MSMARCO-XI Knowledge Base
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Indexed benchmark corpus for Retrieval-Augmented Generation evaluation
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>{documents.length} Benchmark Passages</span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            id="dataset-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search corpus passages..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              id={`cat-filter-btn-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Passages List */}
      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            id={`doc-item-${doc.id}`}
            className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-sm">{doc.title}</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-300 font-mono">
                {doc.category}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed font-sans">{doc.content}</p>
            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
              <span>ID: {doc.id}</span>
              <span>ai4bharat/MSMARCO-XI</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
