import { useState } from 'react';

const STEP_NAMES = ['Planning', 'Web Search', 'Introduction', 'Body', 'Conclusion', 'Review'];

function fmtMs(ms) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Row({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right ml-4">
        {value}
        {sub && <span className="text-xs font-normal text-gray-400 ml-1.5">{sub}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      <div className="bg-gray-50 rounded-xl px-4 py-1">{children}</div>
    </div>
  );
}

export default function AnalyticsReport({ report, onClose }) {
  const [showRaw, setShowRaw] = useState(false);
  const { summary, events } = report;
  const s = summary;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Session Report</h2>
            {s.prompt && (
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">"{s.prompt}"</p>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          <Section title="Session">
            <Row label="Duration" value={fmtMs(s.sessionDurationMs)} />
          </Section>

          <Section title="Step review times">
            {s.steps.map(step => (
              <Row
                key={step.step}
                label={step.name}
                value={
                  step.outcome === 'approved' ? '✓ Approved' :
                  step.outcome === 'skipped'  ? '⏭ Skipped'  : '—'
                }
                sub={step.reviewWaitMs != null ? `waited ${fmtMs(step.reviewWaitMs)}` : null}
              />
            ))}
          </Section>

          <Section title="Controls">
            <Row label="Paused" value={s.controls.pauses} sub="times" />
            <Row label="Resumed" value={s.controls.resumes} sub="times" />
            <Row label="Steps skipped" value={s.controls.stepsSkipped} />
          </Section>

          <Section title="Editing">
            <Row label="Manual paragraph edits" value={s.editing.manualEditsTotal}
              sub={`intro ${s.editing.manualEditsBySection.introduction} · body ${s.editing.manualEditsBySection.body} · conclusion ${s.editing.manualEditsBySection.conclusion}`}
            />
            <Row label="AI rewrites requested" value={s.editing.aiRewritesTotal}
              sub={`intro ${s.editing.aiRewritesBySection.introduction} · body ${s.editing.aiRewritesBySection.body} · conclusion ${s.editing.aiRewritesBySection.conclusion}`}
            />
            {s.editing.rewriteInstructions.length > 0 && (
              <div className="py-1.5">
                <p className="text-xs text-gray-400 mb-1">Rewrite instructions:</p>
                {s.editing.rewriteInstructions.map((instr, i) => (
                  <p key={i} className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 mb-1">
                    "{instr}"
                  </p>
                ))}
              </div>
            )}
          </Section>

          <Section title="Plan">
            <Row label="Plan modifications" value={s.plan.modifications} />
            <Row label="Re-write with plan" value={s.plan.rewriteTriggered} sub="times" />
            {s.plan.modifiedFields.length > 0 && (
              <Row label="Fields changed" value={s.plan.modifiedFields.join(', ')} />
            )}
          </Section>

          <Section title="Personas">
            <Row label="Persona edits" value={s.personas.editCount} />
            {s.personas.agentsEdited.length > 0 && (
              <Row label="Agents edited" value={s.personas.agentsEdited.join(', ')} />
            )}
          </Section>

          {s.search && (
            <Section title="Web search">
              <Row label="Sources selected" value={s.search.sourcesSelected} />
              <Row label="Pages visited" value={s.search.pagesVisited?.length ?? 0} />
              <Row label="External links opened" value={s.search.externalLinkClicks?.length ?? 0} />
              <Row label="Images selected" value={s.search.imagesSelected} />
              <Row label="Time reviewing" value={fmtMs(s.search.waitMs)} />
              {s.search.pagesVisited?.length > 0 && (
                <div className="py-1.5 space-y-1">
                  <p className="text-xs text-gray-400 mb-1">Pages visited:</p>
                  {s.search.pagesVisited.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 mt-0.5 flex-shrink-0 w-4">{i + 1}</span>
                      <div className="min-w-0">
                        {p.title && <p className="text-xs font-medium text-gray-700 truncate">{p.title}</p>}
                        <p className="text-[10px] text-blue-500 truncate">{p.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {s.search.externalLinkClicks?.length > 0 && (
                <div className="py-1.5 space-y-1">
                  <p className="text-xs text-gray-400 mb-1">External links opened:</p>
                  {s.search.externalLinkClicks.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 mt-0.5 flex-shrink-0 w-4">{i + 1}</span>
                      <div className="min-w-0">
                        {p.title && <p className="text-xs font-medium text-gray-700 truncate">{p.title}</p>}
                        <p className="text-[10px] text-blue-500 truncate">{p.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Review">
            <Row label="Decision"
              value={s.review.applied ? '✓ Applied suggestions' : s.review.skipped ? '⏭ Skipped' : '—'}
              sub={s.review.waitMs != null ? `waited ${fmtMs(s.review.waitMs)}` : null}
            />
          </Section>

          <Section title="Images">
            <Row label="Screenshots pasted" value={s.images.pasted} />
          </Section>

          <Section title="Auto mode">
            <Row label="Ever enabled" value={s.autoMode?.everEnabled ? 'Yes' : 'No'} />
            <Row label="Toggled" value={s.autoMode?.toggleCount ?? 0} sub="times" />
          </Section>

          {/* Raw JSON toggle */}
          <div className="mt-2">
            <button onClick={() => setShowRaw(v => !v)}
              className="text-xs text-blue-500 hover:text-blue-700 transition">
              {showRaw ? 'Hide raw events' : 'Show raw events'}
            </button>
            {showRaw && (
              <pre className="mt-2 text-[10px] text-gray-500 bg-gray-50 rounded-xl p-3 overflow-auto max-h-48 leading-relaxed">
                {JSON.stringify(events, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 flex-shrink-0 bg-gray-50">
          <button onClick={copyJson}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy JSON
          </button>
          <button onClick={onClose}
            className="text-xs font-semibold bg-blue-600 text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
