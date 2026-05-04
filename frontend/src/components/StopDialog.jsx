export default function StopDialog({ onResume, onEditPrompt, onRestart, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="5" width="5" height="14" rx="1.5" />
                <rect x="14" y="5" width="5" height="14" rx="1.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Agent Paused</h2>
              <p className="text-sm text-gray-500 mt-0.5">What would you like to do?</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* Resume */}
          <button
            onClick={onResume}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition group focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center flex-shrink-0 transition">
              <svg className="w-5 h-5 text-emerald-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-emerald-800">Resume</p>
              <p className="text-xs text-emerald-600 mt-0.5">Continue from where the agent stopped</p>
            </div>
          </button>

          {/* Edit prompt */}
          <button
            onClick={onEditPrompt}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0 transition">
              <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-blue-800">Edit prompt</p>
              <p className="text-xs text-blue-600 mt-0.5">Inject new instructions before resuming</p>
            </div>
          </button>

          {/* Restart */}
          <button
            onClick={() => {
              if (window.confirm('Restart from the beginning? All progress will be lost.')) onRestart();
            }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition group focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition">
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Restart</p>
              <p className="text-xs text-gray-500 mt-0.5">Return to setup and start a new task</p>
            </div>
          </button>
        </div>

        {/* Close link */}
        <div className="px-6 pb-5 text-center">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition underline"
          >
            Dismiss (keep paused)
          </button>
        </div>
      </div>
    </div>
  );
}
