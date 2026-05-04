import { useState } from 'react';

const QUICK_EXAMPLES = [
  'Focus more on street food culture',
  'Use more vivid sensory descriptions',
  'Include historical context for each dish',
  'Write in a more conversational tone',
  'Add more details about where to find these dishes',
];

export default function EditSidebar({ onClose, onInject, onRewriteRestart, currentPrompt, agentStatus }) {
  const [mode, setMode] = useState('inject'); // 'inject' | 'rewrite'
  const [injectText, setInjectText] = useState('');
  const [rewriteText, setRewriteText] = useState(currentPrompt || '');
  const [sent, setSent] = useState(false);

  const handleInject = () => {
    if (!injectText.trim()) return;
    onInject(injectText.trim());
    setSent(true);
    setTimeout(() => { setSent(false); setInjectText(''); }, 2000);
  };

  const handleRestart = () => {
    if (!rewriteText.trim()) return;
    if (!window.confirm('Restart with this new prompt? All current progress will be cleared.')) return;
    onRewriteRestart(rewriteText.trim());
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Modify Agent</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode('inject')}
            className={`flex-1 py-2.5 text-xs font-semibold transition ${
              mode === 'inject'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Add Instruction
          </button>
          <button
            onClick={() => setMode('rewrite')}
            className={`flex-1 py-2.5 text-xs font-semibold transition ${
              mode === 'rewrite'
                ? 'text-orange-700 border-b-2 border-orange-500 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rewrite & Restart
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {mode === 'inject' ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-xs text-blue-700 leading-relaxed">
                  {agentStatus === 'paused'
                    ? 'Instructions will be sent, then the agent resumes automatically.'
                    : 'Instructions are added to the agent\'s next step — no restart needed.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your instruction</label>
                <textarea
                  value={injectText}
                  onChange={e => setInjectText(e.target.value)}
                  placeholder="e.g. Focus more on street food and local markets…"
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInject(); }}
                />
                <p className="text-xs text-gray-400 mt-1">⌘ + Enter to send</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Quick examples</p>
                <div className="space-y-1.5">
                  {QUICK_EXAMPLES.map((ex, i) => (
                    <button key={i}
                      onClick={() => setInjectText(prev => prev ? `${prev}\n${ex}` : ex)}
                      className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <p className="text-xs text-orange-700 leading-relaxed">
                  The agent will <strong>discard all current progress</strong> — outline, search results, and written content — and restart from Planning with your new prompt.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New writing prompt</label>
                <textarea
                  value={rewriteText}
                  onChange={e => setRewriteText(e.target.value)}
                  placeholder="Describe the new writing task…"
                  rows={8}
                  className="w-full border border-orange-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none transition"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {mode === 'inject' ? (
            sent ? (
              <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-700 font-medium">
                  {agentStatus === 'paused' ? 'Sent — resuming…' : 'Instruction injected!'}
                </span>
              </div>
            ) : (
              <button onClick={handleInject} disabled={!injectText.trim()}
                className={`w-full font-semibold text-sm px-4 py-2.5 rounded-lg transition ${
                  injectText.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {agentStatus === 'paused' ? 'Send & Resume' : 'Inject Instruction'}
              </button>
            )
          ) : (
            <button onClick={handleRestart} disabled={!rewriteText.trim()}
              className={`w-full font-semibold text-sm px-4 py-2.5 rounded-lg transition ${
                rewriteText.trim()
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}>
              Restart with new prompt
            </button>
          )}
          <button onClick={onClose}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
