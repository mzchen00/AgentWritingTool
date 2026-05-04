import { useEffect, useRef } from 'react';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function logStyle(message) {
  if (message.startsWith('ERROR')) return 'text-red-600';
  if (message.includes('complete') || message.includes('confirmed')) return 'text-emerald-700';
  if (message.includes('Waiting') || message.includes('approval') || message.includes('Paused')) return 'text-amber-700';
  if (message.includes('Searching') || message.includes('Search')) return 'text-purple-700';
  if (message.includes('injected') || message.includes('instruction')) return 'text-blue-700';
  return 'text-gray-700';
}

export default function TransparencyLog({ logs, visible, onToggle }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (visible && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, visible]);

  return (
    <div className={`flex-shrink-0 bg-white border-t border-gray-200 transition-all duration-300 ${visible ? 'h-44' : 'h-9'}`}>
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Transparency Log
          </span>
          <span className="text-xs text-gray-400">({logs.length} entries)</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {visible ? 'Collapse' : 'Expand'}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${visible ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>

      {/* Log entries */}
      {visible && (
        <div className="h-[calc(100%-2.25rem)] overflow-y-auto px-4 pb-3 font-mono">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400 italic pt-2">No log entries yet…</p>
          ) : (
            <div className="space-y-0.5">
              {logs.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 py-0.5">
                  <span className="text-xs text-gray-400 flex-shrink-0 pt-px w-20">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={`text-xs leading-relaxed ${logStyle(entry.message)}`}>
                    {entry.message}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
