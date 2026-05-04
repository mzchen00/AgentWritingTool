import { useState, memo } from 'react';

const RELEVANCE_COLORS = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-500',
};

function SearchResultsModal({ results, onConfirm }) {
  const [selected, setSelected] = useState(() => new Set(results.map(r => r.id)));
  const [preview, setPreview] = useState(results[0] ?? null);

  const toggle = id => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selected.size === results.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.id)));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="bg-purple-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <svg className="w-5 h-5 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-white font-semibold text-base">Web Search Results</h2>
          </div>
          <p className="text-purple-200 text-sm">
            Select which sources the agent should use. Click a result to preview details.
          </p>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: results list */}
          <div className="w-2/5 flex flex-col border-r border-gray-200">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <span className="text-xs text-gray-500">{selected.size} of {results.length} selected</span>
              <button onClick={toggleAll} className="text-xs font-medium text-purple-600 hover:text-purple-800">
                {allSelected ? 'Remove all' : 'Select all'}
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {results.map(result => {
                const isSelected = selected.has(result.id);
                const isPreviewed = preview?.id === result.id;
                return (
                  <div
                    key={result.id}
                    onClick={() => setPreview(result)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      isPreviewed
                        ? 'border-purple-400 bg-purple-50 shadow-sm'
                        : isSelected
                          ? 'border-purple-200 bg-white hover:border-purple-300'
                          : 'border-gray-200 bg-gray-50 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <button
                        onClick={e => { e.stopPropagation(); toggle(result.id); }}
                        className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition ${
                          isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-snug truncate">{result.title}</p>
                        <p className="text-xs text-purple-600 truncate mt-0.5">{result.source}</p>
                        {result.relevance && (
                          <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RELEVANCE_COLORS[result.relevance] ?? RELEVANCE_COLORS.medium}`}>
                            {result.relevance} relevance
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: preview panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {preview ? (
              <>
                {/* Preview header */}
                <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{preview.title}</h3>
                      <p className="text-xs text-purple-600 font-medium mt-1">{preview.source}</p>
                    </div>
                    {preview.relevance && (
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${RELEVANCE_COLORS[preview.relevance] ?? RELEVANCE_COLORS.medium}`}>
                        {preview.relevance} relevance
                      </span>
                    )}
                  </div>

                  {/* URL link */}
                  {preview.url && (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {preview.url}
                    </a>
                  )}
                </div>

                {/* Preview body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide text-[11px]">Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{preview.summary}</p>
                </div>

                {/* Preview footer: USE / REMOVE */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                  <button
                    onClick={() => toggle(preview.id)}
                    className={`w-full text-xs font-semibold py-2 rounded-lg transition ${
                      selected.has(preview.id)
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {selected.has(preview.id) ? 'Remove this source' : 'Use this source'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Click a result to preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500">
            {selected.size === 0
              ? 'No sources selected — agent will write from general knowledge'
              : `${selected.size} source${selected.size !== 1 ? 's' : ''} will be used for writing`}
          </p>
          <button
            onClick={() => onConfirm([...selected])}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition shadow-sm"
          >
            Continue with {selected.size} source{selected.size !== 1 ? 's' : ''}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(SearchResultsModal);
