import { useState } from 'react';

// ── Persona definitions ───────────────────────────────────────
export const DEFAULT_PERSONAS = {
  planner: {
    name: 'Alex', role: 'Strategic Planner', emoji: '📋', color: 'blue',
    description: 'Analytical and methodical. Identifies core themes and structures a logical outline with appropriate depth for the target audience.',
  },
  search: {
    name: 'Scout', role: 'Research Agent', emoji: '🔍', color: 'purple',
    description: 'Thorough and discerning. Prioritises authoritative, relevant sources and surfaces key facts and context.',
    searchKeywords: '',
    maxResults: 5,
  },
  writer: {
    name: 'Maya', role: 'Writer Agent', emoji: '✍️', color: 'green',
    description: 'Clear and engaging. Adapts voice and structure to the content type, balancing detail with readability.',
  },
  reviewer: {
    name: 'Kai', role: 'Reviewer Agent', emoji: '✏️', color: 'amber',
    description: 'Precise and constructive. Tightens structure, improves clarity, and ensures consistency of tone throughout.',
  },
};

const STEP_AGENT = ['planner', 'search', 'writer', 'writer', 'writer', 'reviewer'];

const PALETTE = {
  blue:   { card: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',    dot: 'bg-blue-500',    ring: 'ring-blue-400',    btn: 'bg-blue-600'    },
  purple: { card: 'bg-purple-50 border-purple-200', text: 'text-purple-700',  dot: 'bg-purple-500',  ring: 'ring-purple-400',  btn: 'bg-purple-600'  },
  green:  { card: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-400', btn: 'bg-emerald-600' },
  amber:  { card: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   ring: 'ring-amber-400',   btn: 'bg-amber-600'   },
};

const AGENT_LABELS = {
  planner:  'Step 1 · Planning',
  search:   'Step 2 · Web Search',
  writer:   'Steps 3–5 · Writing',
  reviewer: 'Step 6 · Review',
};

const AGENT_RERUN = {
  planner:  { stepIndex: 0, label: 'Re-plan',   warning: 'Re-planning clears the outline, search results, and all written content.' },
  search:   { stepIndex: 1, label: 'Re-search', warning: 'Re-searching clears search results and all written content.' },
  writer:   { stepIndex: 2, label: 'Re-write',  warning: 'Re-writing clears all written sections (introduction, body, conclusion).' },
  reviewer: { stepIndex: 5, label: 'Re-review', warning: 'Re-reviewing re-generates the editorial feedback.' },
};
const AGENT_DONE_STEP = { planner: 0, search: 1, writer: 2, reviewer: 5 };

// ── Typing dots ───────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-0.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-current opacity-60"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ── Single Persona Card ───────────────────────────────────────
function PersonaCard({ type, persona, isActive, agentStatus, stepMsg, onEdit, isDone, canRestart, onRestartFrom, prompt }) {
  const [panel, setPanel]   = useState(null); // null | 'edit' | 'rerun'
  const [draft, setDraft]   = useState({ name: persona.name, role: persona.role, description: persona.description || '', searchKeywords: persona.searchKeywords || '', maxResults: persona.maxResults ?? 5 });
  const [promptDraft, setPromptDraft] = useState(prompt || '');
  const p = PALETTE[persona.color] || PALETTE.blue;
  const rerun = AGENT_RERUN[type];

  const isRunning  = isActive && ['running', 'search_review', 'waiting_approval'].includes(agentStatus);
  const isPaused   = isActive && (agentStatus === 'paused' || agentStatus === 'error');
  const isComplete = !isActive && agentStatus === 'completed';

  const openEdit = () => {
    setDraft({ name: persona.name, role: persona.role, description: persona.description || '', searchKeywords: persona.searchKeywords || '', maxResults: persona.maxResults ?? 5 });
    setPanel(panel === 'edit' ? null : 'edit');
  };
  const saveEdit = () => {
    const saved = { name: draft.name.trim() || persona.name, role: draft.role.trim() || persona.role, description: draft.description };
    if (type === 'search') {
      saved.searchKeywords = draft.searchKeywords;
      saved.maxResults = Math.min(10, Math.max(1, Number(draft.maxResults) || 5));
    }
    onEdit(type, saved);
    setPanel(null);
  };

  const openRerun = () => {
    setPromptDraft(prompt || '');
    setPanel(panel === 'rerun' ? null : 'rerun');
  };
  const confirmRerun = () => {
    const newPrompt = type === 'planner' ? (promptDraft.trim() || undefined) : undefined;
    onRestartFrom(rerun.stepIndex, newPrompt);
    setPanel(null);
  };

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      isActive ? `${p.card} shadow-sm` : 'border-gray-200 bg-white'
    }`}>
      {/* ── Collapsed row ── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Emoji avatar */}
        <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base
          ${isActive ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
          {persona.emoji}
          {isRunning && <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${p.dot} border-2 border-white pulse-ring`} />}
          {isPaused  && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />}
        </div>

        {/* Name + role + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xs font-bold leading-none ${isActive ? p.text : 'text-gray-600'}`}>{persona.name}</span>
            <span className={`text-[10px] ${isActive ? 'text-gray-500' : 'text-gray-400'} truncate`}>{persona.role}</span>
          </div>
          {isRunning && (
            <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${p.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot} pulse-ring flex-shrink-0`} />
              <span className="truncate">{stepMsg || 'Working…'}</span>
              <TypingDots />
            </div>
          )}
          {isPaused && <p className="text-[10px] text-red-500 font-medium mt-0.5">Paused</p>}
          {!isRunning && !isPaused && (
            <p className="text-[10px] mt-0.5 truncate text-gray-400">{AGENT_LABELS[type]}</p>
          )}
        </div>

        {/* Re-run button — only when agent's steps are done and not currently running */}
        {isDone && canRestart && (
          <button
            onClick={openRerun}
            title={`Re-run ${AGENT_LABELS[type]}`}
            className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition ${
              panel === 'rerun' ? 'bg-amber-500 text-white' : 'text-amber-400 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-600'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Edit toggle */}
        <button
          onClick={openEdit}
          title="Edit persona"
          className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition ${
            panel === 'edit' ? `${p.btn} text-white` : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {panel === 'edit' ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Edit panel ── */}
      {panel === 'edit' && (
        <div className={`border-t ${isActive ? 'border-current/10' : 'border-gray-100'} px-3 py-3 space-y-2.5 bg-white/80`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Name</label>
              <input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setPanel(null); }}
                autoFocus
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Role</label>
              <input
                value={draft.role}
                onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setPanel(null); }}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Personality &amp; Style
            </label>
            <textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Escape') setPanel(null); }}
              rows={3}
              placeholder="Describe how this agent should behave, write, or think…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
            />
          </div>

          {type === 'search' && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Extra Search Keywords <span className="normal-case font-normal text-gray-300">(appended to every Tavily query)</span>
                </label>
                <input
                  value={draft.searchKeywords}
                  onChange={e => setDraft(d => ({ ...d, searchKeywords: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setPanel(null); }}
                  placeholder="e.g. Melbourne site:.com.au -reddit"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Number of Results <span className="normal-case font-normal text-gray-300 ml-1">{draft.maxResults}</span>
                </label>
                <input
                  type="range" min={5} max={10} step={1}
                  value={draft.maxResults}
                  onChange={e => setDraft(d => ({ ...d, maxResults: Number(e.target.value) }))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                  <span>5</span><span>10</span>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={saveEdit}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white transition ${p.btn} hover:opacity-90`}>
              Save
            </button>
            <button onClick={() => setPanel(null)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Re-run panel ── */}
      {panel === 'rerun' && (
        <div className="border-t border-amber-200 px-3 py-3 space-y-2.5 bg-amber-50/60">
          <p className="text-[10px] text-amber-700 leading-relaxed">{rerun.warning}</p>

          {type === 'planner' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Update prompt (optional)</label>
              <textarea
                value={promptDraft}
                onChange={e => setPromptDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={confirmRerun}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition">
              {rerun.label}
            </button>
            <button onClick={() => setPanel(null)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step dots (compact progress) ─────────────────────────────
function StepDots({ steps, currentStep, agentStatus }) {
  const DOT_COLOR = {
    blue:   'bg-blue-500',
    purple: 'bg-purple-500',
    green:  'bg-emerald-500',
    amber:  'bg-amber-500',
  };
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, i) => {
        const isPaused = agentStatus === 'paused' && i === currentStep;
        return (
          <div key={step.id} title={step.name}
            className={`rounded-full transition-all ${
              step.status === 'completed'   ? `w-2 h-2 ${DOT_COLOR[step.color] || 'bg-gray-400'}`
            : step.status === 'in-progress' ? `w-2.5 h-2.5 ${isPaused ? 'bg-red-500' : (DOT_COLOR[step.color] || 'bg-gray-400')} pulse-ring`
            : 'w-2 h-2 bg-gray-200'
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Plan Editor ───────────────────────────────────────────────
function PlanItem({ item, index, status, isDragging, onDragStart, onDragOver, onDrop, onDragEnd, onRename, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed) onRename(index, trimmed);
    setEditing(false);
  };

  const statusIcon = () => {
    if (status === 'completed') return (
      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
    if (status === 'active') return <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-ring flex-shrink-0" />;
    return <span className="w-2 h-2 rounded-full border border-gray-300 flex-shrink-0" />;
  };

  return (
    <div
      draggable={item.draggable && canEdit}
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all select-none ${
        isDragging ? 'opacity-40' : ''
      } ${
        status === 'active'    ? 'bg-emerald-50 border border-emerald-200' :
        status === 'completed' ? 'bg-gray-50' : 'hover:bg-gray-50'
      } ${item.draggable && canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {item.draggable && canEdit ? (
        <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      ) : (
        <span className="w-3 flex-shrink-0" />
      )}
      {statusIcon()}
      {editing ? (
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(item.label); setEditing(false); } }}
          className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium"
          autoFocus
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className={`flex-1 text-xs font-medium truncate ${
            status === 'completed' ? 'text-gray-400 line-through' :
            status === 'active'    ? 'text-emerald-700' :
            item.draggable         ? 'text-gray-600' : 'text-gray-400'
          }`}
          onDoubleClick={() => { if (item.draggable && canEdit) { setDraft(item.label); setEditing(true); } }}
        >
          {item.label}
        </span>
      )}
    </div>
  );
}

// ── Section block (intro / conclusion) — editable ────────────
function SectionBlock({ label, points = [], status, icon, canEdit, onUpdate }) {
  const [open, setOpen]           = useState(true);
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft]         = useState('');
  const [adding, setAdding]       = useState(false);
  const [newPoint, setNewPoint]   = useState('');
  const isActive    = status === 'active';
  const isCompleted = status === 'completed';

  const saveEdit = (i) => {
    const t = draft.trim();
    if (t) {
      const updated = points.map((p, pi) => pi === i ? t : p);
      onUpdate(updated);
    }
    setEditingIdx(null);
  };
  const deletePoint = (i) => onUpdate(points.filter((_, pi) => pi !== i));
  const addPoint = () => {
    const t = newPoint.trim();
    if (t) onUpdate([...points, t]);
    setNewPoint('');
    setAdding(false);
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isActive    ? 'border-emerald-200 bg-emerald-50' :
      isCompleted ? 'border-gray-100 bg-gray-50' :
                    'border-gray-100 bg-white'
    }`}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <div className="flex-shrink-0 w-4 flex items-center justify-center">
          {isCompleted ? (
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : isActive ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-ring" />
          ) : (
            <span className="w-2 h-2 rounded-full border border-gray-300" />
          )}
        </div>
        <span className={`flex-1 text-xs font-semibold ${
          isActive ? 'text-emerald-700' : isCompleted ? 'text-gray-400' : 'text-gray-500'
        }`}>{icon} {label}</span>
        <svg className={`w-3 h-3 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-2.5 border-t border-black/5 space-y-1">
          {points.map((pt, i) => (
            <div key={i} className="flex items-start gap-1.5 pt-1.5 group">
              <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0 mt-[7px]" />
              {editingIdx === i ? (
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => saveEdit(i)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') setEditingIdx(null); }}
                  autoFocus
                  className="flex-1 text-[11px] border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              ) : (
                <span
                  className={`flex-1 text-[11px] leading-relaxed cursor-text ${
                    isCompleted ? 'text-gray-400' : 'text-gray-600'
                  } ${canEdit ? 'hover:text-gray-900' : ''}`}
                  onClick={() => { if (canEdit) { setDraft(pt); setEditingIdx(i); } }}
                >{pt}</span>
              )}
              {canEdit && editingIdx !== i && (
                <button onClick={() => deletePoint(i)}
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Add new point */}
          {canEdit && (
            adding ? (
              <div className="flex items-center gap-1.5 pt-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-300 flex-shrink-0 mt-[7px]" />
                <input
                  value={newPoint}
                  onChange={e => setNewPoint(e.target.value)}
                  onBlur={addPoint}
                  onKeyDown={e => { if (e.key === 'Enter') addPoint(); if (e.key === 'Escape') { setAdding(false); setNewPoint(''); } }}
                  autoFocus
                  placeholder="Add a point…"
                  className="flex-1 text-[11px] border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
                />
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 transition">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add point
              </button>
            )
          )}
          {!canEdit && points.length === 0 && (
            <p className="text-[11px] text-gray-300 italic pt-1.5">No points planned</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section body block (draggable, fully editable) ───────────
function DishBlock({ dish, index, status, isDragging, canEdit, onDragStart, onDragOver, onDrop, onDragEnd, onUpdate, onDelete }) {
  const [open, setOpen]           = useState(false);
  const [nameDraft, setNameDraft] = useState(null); // null = not editing
  const [descDraft, setDescDraft] = useState(dish.description || '');
  const [editingPt, setEditingPt] = useState(null);
  const [ptDraft, setPtDraft]     = useState('');
  const [adding, setAdding]       = useState(false);
  const [newPt, setNewPt]         = useState('');
  const points = dish.key_points || [];
  const isActive    = status === 'active';
  const isCompleted = status === 'completed';

  const PALETTE = ['border-blue-200 bg-blue-50', 'border-violet-200 bg-violet-50', 'border-pink-200 bg-pink-50'];
  const TEXT    = ['text-blue-600', 'text-violet-600', 'text-pink-600'];

  const commitDesc = () => onUpdate({ ...dish, description: descDraft });
  const savePoint = (i) => {
    const t = ptDraft.trim();
    if (t) onUpdate({ ...dish, key_points: points.map((p, pi) => pi === i ? t : p) });
    setEditingPt(null);
  };
  const deletePoint = (i) => onUpdate({ ...dish, key_points: points.filter((_, pi) => pi !== i) });
  const addPoint = () => {
    const t = newPt.trim();
    if (t) onUpdate({ ...dish, key_points: [...points, t] });
    setNewPt(''); setAdding(false);
  };

  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-xl border overflow-hidden transition-all ${isDragging ? 'opacity-40' : ''} ${
        isActive    ? 'border-emerald-200 bg-emerald-50' :
        isCompleted ? 'border-gray-100 bg-gray-50' :
                      PALETTE[index % 3]
      } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 group">
        <div className="flex-shrink-0 w-4 flex items-center justify-center">
          {isCompleted ? (
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : isActive ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-ring" />
          ) : (
            <span className={`text-[10px] font-bold ${TEXT[index % 3]}`}>#{index + 1}</span>
          )}
        </div>

        {/* Name — inline rename on click */}
        {nameDraft !== null ? (
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={() => { if (nameDraft.trim()) onUpdate({ ...dish, name: nameDraft.trim() }); setNameDraft(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (nameDraft.trim()) onUpdate({ ...dish, name: nameDraft.trim() }); setNameDraft(null); } if (e.key === 'Escape') setNameDraft(null); }}
            autoFocus
            className="flex-1 text-xs font-semibold border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={`flex-1 text-xs font-semibold truncate ${
              isCompleted ? 'text-gray-400' : isActive ? 'text-emerald-700' : 'text-gray-700'
            } ${canEdit ? 'cursor-text hover:opacity-70' : ''}`}
            onClick={e => { if (!canEdit) return; e.stopPropagation(); setNameDraft(dish.name); }}
          >{dish.name}</span>
        )}

        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="flex-shrink-0 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition"
            title="Delete section"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition">
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-black/5 pt-2">
          {/* Description */}
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              disabled={!canEdit}
              rows={2}
              placeholder="What this section covers…"
              className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none leading-relaxed disabled:bg-transparent disabled:border-transparent disabled:text-gray-500"
            />
          </div>

          {/* Key points */}
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Key points</p>
            <div className="space-y-1">
              {points.map((pt, i) => (
                <div key={i} className="flex items-start gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0 mt-[7px]" />
                  {editingPt === i ? (
                    <input
                      value={ptDraft}
                      onChange={e => setPtDraft(e.target.value)}
                      onBlur={() => savePoint(i)}
                      onKeyDown={e => { if (e.key === 'Enter') savePoint(i); if (e.key === 'Escape') setEditingPt(null); }}
                      autoFocus
                      className="flex-1 text-[11px] border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-[11px] leading-relaxed ${canEdit ? 'cursor-text hover:text-gray-900' : ''} ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}
                      onClick={() => { if (canEdit) { setPtDraft(pt); setEditingPt(i); } }}
                    >{pt}</span>
                  )}
                  {canEdit && editingPt !== i && (
                    <button onClick={() => deletePoint(i)}
                      className="flex-shrink-0 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                adding ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-blue-300 flex-shrink-0 mt-[7px]" />
                    <input
                      value={newPt}
                      onChange={e => setNewPt(e.target.value)}
                      onBlur={addPoint}
                      onKeyDown={e => { if (e.key === 'Enter') addPoint(); if (e.key === 'Escape') { setAdding(false); setNewPt(''); } }}
                      autoFocus
                      placeholder="Add a key point…"
                      className="flex-1 text-[11px] border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
                    />
                  </div>
                ) : (
                  <button onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add point
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentPlan({ outline, currentStep, agentStatus, onPlanUpdate, onRestartFrom }) {
  const [dragFrom, setDragFrom] = useState(null);
  const canEdit = !!outline;
  const isRunning = ['running', 'search_review', 'waiting_approval'].includes(agentStatus);
  const canRewrite = canEdit && !isRunning && currentStep >= 1;

  const sections = outline?.sections || [];

  const introStatus = currentStep > 2 || agentStatus === 'completed' ? 'completed'
    : currentStep === 2 && agentStatus === 'running' ? 'active' : 'pending';
  const bodyStatus = currentStep > 3 || agentStatus === 'completed' ? 'completed'
    : currentStep === 3 && agentStatus === 'running' ? 'active' : 'pending';
  const conclusionStatus = agentStatus === 'completed' ? 'completed'
    : currentStep === 4 && agentStatus === 'running' ? 'active' : 'pending';

  const handleDrop = (toIdx) => {
    if (dragFrom === null || dragFrom === toIdx) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(dragFrom, 1);
    newSections.splice(toIdx, 0, moved);
    onPlanUpdate({ sections: newSections });
    setDragFrom(null);
  };

  if (!outline) return (
    <div className="space-y-1.5">
      {['Introduction', 'Body sections', 'Conclusion'].map(label => (
        <div key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100">
          <span className="w-2 h-2 rounded-full border border-gray-200 flex-shrink-0" />
          <span className="text-xs text-gray-300 font-medium">{label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <SectionBlock
        label="Introduction"
        points={outline.introduction_points || []}
        status={introStatus}
        icon="📖"
        canEdit={canEdit}
        onUpdate={pts => onPlanUpdate({ introduction_points: pts })}
      />

      {sections.map((section, i) => (
        <DishBlock
          key={section.id || `section_${i}`}
          dish={section}
          index={i}
          status={bodyStatus}
          isDragging={dragFrom === i}
          canEdit={canEdit}
          onDragStart={() => setDragFrom(i)}
          onDragOver={() => {}}
          onDrop={() => handleDrop(i)}
          onDragEnd={() => setDragFrom(null)}
          onUpdate={updated => {
            const newSections = sections.map((s, si) => si === i ? { ...s, ...updated } : s);
            onPlanUpdate({ sections: newSections });
          }}
          onDelete={() => onPlanUpdate({ sections: sections.filter((_, si) => si !== i) })}
        />
      ))}

      {canEdit && (
        <button
          onClick={() => onPlanUpdate({ sections: [...sections, { id: `s_${Date.now()}`, name: 'New Section', description: '', key_points: [] }] })}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add section
        </button>
      )}

      <SectionBlock
        label="Conclusion"
        points={outline.conclusion_points || []}
        status={conclusionStatus}
        icon="🌟"
        canEdit={canEdit}
        onUpdate={pts => onPlanUpdate({ conclusion_points: pts })}
      />

      {sections.length > 0 && (
        <p className="text-[10px] text-gray-300 px-1 pt-0.5">Drag sections to reorder · Click name to rename · Expand to edit details</p>
      )}

      {canRewrite && (
        <button
          onClick={() => onRestartFrom(2)}
          className="w-full mt-2 text-xs font-semibold py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Re-write with this plan
        </button>
      )}

      {isRunning && canEdit && (
        <p className="text-[10px] text-amber-500 px-1 pt-1">Edits apply on next re-write</p>
      )}
    </div>
  );
}

// ── Step list (read-only status) ─────────────────────────────
const STEP_COLORS = {
  blue:   { dot: 'bg-blue-500',    text: 'text-blue-600'    },
  purple: { dot: 'bg-purple-500',  text: 'text-purple-600'  },
  green:  { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  amber:  { dot: 'bg-amber-500',   text: 'text-amber-600'   },
};

function StepList({ steps, currentStep, agentStatus }) {
  return (
    <div className="space-y-0.5">
      {steps.map((step, i) => {
        const c = STEP_COLORS[step.color] || STEP_COLORS.blue;
        const isActive = step.status === 'in-progress';
        const isDone   = step.status === 'completed';
        const isPaused = agentStatus === 'paused' && i === currentStep;

        return (
          <div key={step.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isActive ? 'bg-gray-50' : ''}`}>
            <div className="flex-shrink-0 w-4 flex items-center justify-center">
              {isDone ? (
                <svg className={`w-3.5 h-3.5 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-500' : c.dot} ${!isPaused ? 'pulse-ring' : ''}`} />
              ) : (
                <span className="w-2 h-2 rounded-full border border-gray-200" />
              )}
            </div>
            <span className={`flex-1 text-xs font-medium truncate ${
              isDone   ? 'text-gray-400' :
              isActive ? (isPaused ? 'text-red-500' : c.text) :
              'text-gray-300'
            }`}>
              {step.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function AgentTimeline({
  steps, currentStep, stepMsgs, agentMode, multiAgent, agentStatus,
  outline, personas, prompt, onPersonaEdit, onPlanUpdate, onRestartFrom,
}) {
  const agentType = currentStep >= 0 ? STEP_AGENT[currentStep] : null;
  const isWritingStep = currentStep >= 2 && currentStep <= 4;
  const showMulti = agentMode === 'multi' && isWritingStep &&
    ['running', 'waiting_approval', 'search_review', 'paused'].includes(agentStatus);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Agents ── */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Agents</p>
          <div className="space-y-2">
            {Object.entries(DEFAULT_PERSONAS).map(([type, defaults]) => {
              const p = personas[type] || defaults;
              const isActive = showMulti
                ? (type === 'writer' || type === 'reviewer')
                : type === agentType;
              const activeForMsg = showMulti
                ? (multiAgent === type || (!multiAgent && type === 'writer'))
                : type === agentType;
              const doneStep = AGENT_DONE_STEP[type];
              const isPausedHere = agentStatus === 'paused' && STEP_AGENT[currentStep] === type;
              const isDone = steps[doneStep]?.status === 'completed' || isPausedHere;
              const canRestart = isDone &&
                !['running', 'search_review', 'waiting_approval'].includes(agentStatus);
              return (
                <PersonaCard
                  key={type}
                  type={type}
                  persona={p}
                  isActive={isActive && ['running', 'waiting_approval', 'search_review', 'paused', 'error'].includes(agentStatus)}
                  agentStatus={agentStatus}
                  stepMsg={activeForMsg ? stepMsgs[currentStep] : null}
                  onEdit={onPersonaEdit}
                  isDone={isDone}
                  canRestart={canRestart}
                  onRestartFrom={onRestartFrom}
                  prompt={prompt}
                />
              );
            })}
          </div>
        </div>

        {/* ── Content Plan ── */}
        <div>
          <p className="text-sm font-bold text-gray-600 uppercase tracking-widest mb-2">Content Plan</p>
          <ContentPlan
            outline={outline}
            currentStep={currentStep}
            agentStatus={agentStatus}
            onPlanUpdate={onPlanUpdate}
            onRestartFrom={onRestartFrom}
          />
        </div>

      </div>

      {/* Footer: current status */}
      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5">
        <span className="text-[10px] text-gray-400 font-medium">
          {agentStatus === 'completed' ? '✓ All steps done' :
           agentStatus === 'idle'      ? 'Ready to start' :
           agentStatus === 'paused'    ? '⏸ Paused' :
           agentStatus === 'error'     ? '✕ Error' :
           steps.find(s => s.status === 'in-progress')?.name || ''}
        </span>
      </div>
    </div>
  );
}
