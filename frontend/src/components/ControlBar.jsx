const STATUS_LABEL = {
  idle:             { text: 'Idle',             color: 'text-gray-400' },
  running:          { text: 'Running',          color: 'text-emerald-600' },
  paused:           { text: 'Paused',           color: 'text-red-600' },
  search_review:    { text: 'Reviewing sources',color: 'text-purple-600' },
  waiting_approval: { text: 'Step complete — click Next to continue', color: 'text-amber-600' },
  waiting_review:   { text: 'Review complete — apply suggestions?', color: 'text-amber-600' },
  completed:        { text: 'Completed',        color: 'text-emerald-600' },
  error:            { text: 'Error',            color: 'text-red-600' },
};

// ── Inline pause banner ───────────────────────────────────────
function PauseBanner({ onResume, onRestart, onDismiss }) {
  return (
    <div className="flex flex-1 items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 mr-auto min-w-0">
      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <rect x="5" y="4" width="5" height="16" rx="1.5" />
        <rect x="14" y="4" width="5" height="16" rx="1.5" />
      </svg>
      <span className="text-xs font-semibold text-red-700 flex-shrink-0">Paused</span>
      <span className="flex-1 text-[11px] text-red-400">Edit agent personas on the left, then re-run from that agent.</span>

      <button onClick={onResume}
        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 transition">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
        Resume
      </button>

      <button onClick={onRestart}
        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg transition">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Restart
      </button>

      <button onClick={onDismiss}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-100 transition">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ControlBar({
  agentStatus, currentStep, onStop, onSkip, onApprove, onReset,
  onResume, onRestart, onDismissPause, onViewReport,
  autoMode, onToggleAutoMode,
}) {
  const isPaused         = agentStatus === 'paused' || agentStatus === 'error';
  const active           = agentStatus === 'running' || agentStatus === 'waiting_approval' || agentStatus === 'search_review';
  const canApprove       = agentStatus === 'waiting_approval';
  const isReviewConfirm  = canApprove && currentStep === 5;
  const isSearchDone     = canApprove && currentStep === 1;
  const canSkip          = agentStatus === 'running';
  const label            = isReviewConfirm
    ? STATUS_LABEL.waiting_review
    : isSearchDone
    ? { text: 'Search complete — click Next to start writing', color: 'text-amber-600' }
    : (STATUS_LABEL[agentStatus] || STATUS_LABEL.idle);

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 z-20 shadow-sm min-h-[44px]">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-800 text-sm hidden lg:block">AI Writing Assistant</span>
      </div>

      {isPaused ? (
        <PauseBanner
          onResume={onResume}
          onRestart={onRestart}
          onDismiss={onDismissPause}
        />
      ) : (
        <>
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 mr-auto">
            <span className={`w-2 h-2 rounded-full inline-block ${
              agentStatus === 'running'   ? 'bg-emerald-500 pulse-ring' :
              agentStatus === 'completed' ? 'bg-emerald-500' :
              agentStatus === 'waiting_approval' || agentStatus === 'search_review' ? 'bg-amber-500 pulse-ring' :
              'bg-gray-300'
            }`} />
            <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* PAUSE */}
            <button onClick={onStop} disabled={!active} title="Pause the agent"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                active ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                       : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="4" width="5" height="16" rx="1.5" />
                <rect x="14" y="4" width="5" height="16" rx="1.5" />
              </svg>
              Pause
            </button>

            {/* SKIP — only shown while running */}
            {canSkip && (
              <button onClick={onSkip} title="Skip current step"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Skip step
              </button>
            )}

            {/* REVIEW CONFIRM — shown when review step is waiting */}
            {isReviewConfirm && (
              <>
                <button onClick={onApprove} title="Apply review suggestions to the article"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white hover:bg-emerald-700 shadow-md ring-2 ring-emerald-300 animate-pulse">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Apply suggestions
                </button>
                <button onClick={onSkip} title="Keep the current article as-is"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200">
                  Skip
                </button>
              </>
            )}

            {/* NEXT — shown when waiting for approval on other steps */}
            {canApprove && !isReviewConfirm && (
              <button onClick={onApprove} title="Proceed to next step"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition bg-blue-600 text-white hover:bg-blue-700 shadow-md ring-2 ring-blue-300 animate-pulse">
                Next
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* AUTO MODE TOGGLE */}
            <button
              onClick={onToggleAutoMode}
              title={autoMode ? 'Auto-approve on — click to turn off' : 'Auto-approve off — click to enable'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                autoMode
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition ${
                autoMode ? 'bg-white border-white' : 'bg-transparent border-gray-400'
              }`} />
              Auto
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* VIEW REPORT — shown when completed */}
            {agentStatus === 'completed' && onViewReport && (
              <button onClick={onViewReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Session Report
              </button>
            )}

            {/* RESET */}
            <button onClick={() => { if (window.confirm('Reset the entire session?')) onReset(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </>
      )}
    </header>
  );
}
