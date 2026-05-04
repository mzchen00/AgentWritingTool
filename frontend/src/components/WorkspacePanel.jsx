import { useState, useRef, useEffect } from 'react';

const API = '/api';
function logEvent(type, payload = {}) {
  fetch(`${API}/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload }),
  }).catch(() => {});
}

// ── Helpers ───────────────────────────────────────────────────
function SectionHeader({ icon, label, color }) {
  const colors = {
    green:  'text-emerald-700 bg-emerald-100',
    blue:   'text-blue-700 bg-blue-100',
    amber:  'text-amber-700 bg-amber-100',
    purple: 'text-purple-700 bg-purple-100',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${colors[color]}`}>
      <span>{icon}</span>{label}
    </div>
  );
}

// ── Outline ───────────────────────────────────────────────────
function SectionCard({ section, index }) {
  const [open, setOpen] = useState(false);
  const palette = [
    'bg-blue-50 border-blue-200 text-blue-700',
    'bg-violet-50 border-violet-200 text-violet-700',
    'bg-pink-50 border-pink-200 text-pink-700',
  ];
  return (
    <div className={`rounded-xl border overflow-hidden ${palette[index % 3].split(' ').slice(0,2).join(' ')}`}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold flex-shrink-0 ${palette[index % 3].split(' ')[2]}`}>#{index + 1}</span>
          <span className="text-sm font-semibold text-gray-800 truncate">{section.name}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 pb-3 space-y-1.5 border-t border-black/5">
          {section.description && (
            <p className="text-xs text-gray-600 leading-relaxed pt-2">{section.description}</p>
          )}
          {(section.key_points || []).length > 0 && (
            <ul className="space-y-1 pt-1">
              {section.key_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />{pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function OutlineView({ outline, collapsed: initCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(initCollapsed);
  if (!outline) return null;
  return (
    <div className="space-y-1">
      <button onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 w-full text-left py-1 group">
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content Outline</span>
        {collapsed && outline.topic && (
          <span className="text-xs text-gray-400 truncate">— {outline.topic}</span>
        )}
      </button>

      {!collapsed && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            {outline.topic && (
              <div className="flex items-center gap-2">
                <span className="text-base">📄</span>
                <span className="text-sm font-bold text-gray-900">{outline.topic}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {outline.writing_style && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">✍️ {outline.writing_style}</span>
              )}
              {outline.target_audience && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">👥 {outline.target_audience}</span>
              )}
            </div>
          </div>

          {outline.introduction_points?.length > 0 && (
            <div>
              <div className="mb-2"><SectionHeader icon="📖" label="Introduction" color="green" /></div>
              <ul className="space-y-1.5">
                {outline.introduction_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />{pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {outline.sections?.length > 0 && (
            <div>
              <div className="mb-2"><SectionHeader icon="📝" label="Main Body" color="blue" /></div>
              <div className="space-y-2">
                {outline.sections.map((section, i) => <SectionCard key={i} section={section} index={i} />)}
              </div>
            </div>
          )}

          {outline.conclusion_points?.length > 0 && (
            <div>
              <div className="mb-2"><SectionHeader icon="🌟" label="Conclusion" color="amber" /></div>
              <ul className="space-y-1.5">
                {outline.conclusion_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />{pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Planning in progress ──────────────────────────────────────
function PlanningInProgress({ tokens }) {
  let topic = '', style = '', sections = [];
  try {
    const topicMatch = tokens.match(/"topic"\s*:\s*"([^"]+)"/);
    if (topicMatch) topic = topicMatch[1];
    const styleMatch = tokens.match(/"writing_style"\s*:\s*"([^"]+)"/);
    if (styleMatch) style = styleMatch[1];
    // Extract section names (inside the "sections" array)
    const sectionsStart = tokens.indexOf('"sections"');
    if (sectionsStart !== -1) {
      const nameMatches = [...tokens.slice(sectionsStart).matchAll(/"name"\s*:\s*"([^"]+)"/g)];
      sections = nameMatches.map(m => m[1]);
    }
  } catch {}

  const hasData = topic || sections.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500 pulse-ring flex-shrink-0" />
        <span className="text-xs font-semibold text-blue-700">
          {topic ? `Planning: ${topic}…` : 'Building outline…'}
        </span>
      </div>

      {hasData ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2.5">
          {topic && (
            <div className="flex items-center gap-2">
              <span className="text-base">📄</span>
              <span className="text-sm font-bold text-gray-900">{topic}</span>
              {style && <span className="text-xs text-gray-400 italic truncate">· {style}</span>}
            </div>
          )}
          {sections.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Sections so far</p>
              {sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 w-4 flex-shrink-0">#{i + 1}</span>
                  <span className="text-xs text-gray-700 font-medium">{s}</span>
                  {i === sections.length - 1 && (
                    <span className="inline-block w-0.5 h-3 bg-blue-400 animate-pulse ml-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-blue-100 rounded-full w-2/3" />
          <div className="h-3 bg-blue-100 rounded-full w-1/2" />
          <div className="h-8 bg-blue-50 border border-blue-100 rounded-xl" />
          <div className="h-8 bg-blue-50 border border-blue-100 rounded-xl" />
          <div className="h-8 bg-blue-50 border border-blue-100 rounded-xl" />
        </div>
      )}
    </div>
  );
}

// ── Search results (inline, non-blocking) ─────────────────────
const RELEVANCE = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-500',
};

function SearchSection({ results, images, onConfirm, autoConfirmed, agentStatus, currentStep }) {
  // Scraping is in progress when: confirmed but no images yet and still in search step (running)
  const isScrapingImages = confirmed => confirmed && (images || []).length === 0 && currentStep === 1 && agentStatus === 'running';
  const [selected, setSelected]         = useState(() => new Set(results.map(r => r.id)));
  const [selectedImgs, setSelectedImgs] = useState(() => new Set((images || []).map(i => i.id)));
  const [confirmed, setConfirmed]       = useState(autoConfirmed);
  const [tab, setTab]                   = useState('sources');

  // Mirror external confirmation (e.g. auto-mode bypasses the button)
  useEffect(() => {
    if (!confirmed && agentStatus !== 'search_review') setConfirmed(true);
  }, [agentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // When real scraped images arrive, select them all by default
  const prevImgCount = useState(images?.length || 0);
  if (!confirmed && images && images.length > 0 && selectedImgs.size === 0) {
    setSelectedImgs(new Set(images.map(i => i.id)));
  }

  const toggle = id => {
    if (confirmed) return;
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleImg = id => {
    if (confirmed) return;
    setSelectedImgs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm([...selected], [...selectedImgs]);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionHeader icon="🔍" label="Search Sources" color="purple" />
        {confirmed ? (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {selected.size} sources · {selectedImgs.size} images
          </span>
        ) : (
          <span className="text-xs text-gray-400">{selected.size}/{results.length} sources</span>
        )}
      </div>

      {/* Tabs */}
      {(images || []).length > 0 && (
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px] font-semibold">
          <button onClick={() => setTab('sources')}
            className={`flex-1 py-1.5 transition ${tab === 'sources' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            Sources ({results.length})
          </button>
          <button onClick={() => setTab('images')}
            className={`flex-1 py-1.5 transition ${tab === 'images' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            Images ({(images || []).length})
          </button>
        </div>
      )}

      {/* Sources list */}
      {tab === 'sources' && (
        <div className="space-y-2">
          {results.map(r => {
            const isSelected = selected.has(r.id);
            return (
              <div key={r.id}
                onClick={() => toggle(r.id)}
                className={`rounded-xl border p-3 transition-all ${confirmed ? 'cursor-default' : 'cursor-pointer'} ${
                  isSelected ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!confirmed && (
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition ${
                      isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-snug">{r.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-purple-600 truncate">{r.source}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        onClick={e => { e.stopPropagation(); logEvent('external_link_clicked', { url: r.url, title: r.title }); }}
                        className="flex-shrink-0 text-gray-400 hover:text-purple-600 transition">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-2">{r.summary}</p>
                    {r.relevance && (
                      <span className={`inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RELEVANCE[r.relevance] ?? RELEVANCE.medium}`}>
                        {r.relevance} relevance
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Images grid */}
      {tab === 'images' && (
        <div className="space-y-2">
          {isScrapingImages(confirmed) ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <span className="w-2 h-2 rounded-full bg-purple-500 pulse-ring" />
              <span className="text-xs text-purple-600 font-medium">Opening pages, extracting images…</span>
            </div>
          ) : (images || []).length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No images found yet. Confirm sources to start scraping.</p>
          ) : (
            <>
              <p className="text-[10px] text-gray-400">Extracted from source pages via Playwright. Select images to include as writing context.</p>
              <div className="grid grid-cols-2 gap-2">
                {(images || []).map(img => {
                  const isSelected = selectedImgs.has(img.id);
                  const hostname = img.sourcePage ? (() => { try { return new URL(img.sourcePage).hostname.replace('www.',''); } catch { return ''; } })() : '';
                  return (
                    <div key={img.id}
                      onClick={() => toggleImg(img.id)}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'search-image', url: img.url, description: img.description || '' }))}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing group ${
                        confirmed ? 'cursor-grab' :
                        isSelected ? 'border-purple-500' : 'border-transparent opacity-50'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.description || ''}
                        className="w-full h-24 object-cover"
                        onError={e => { e.target.closest('div').style.display = 'none'; }}
                      />
                      {!confirmed && isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                        {img.description && <p className="text-[9px] text-white leading-tight line-clamp-1">{img.description}</p>}
                        {hostname && <p className="text-[8px] text-purple-300 mt-0.5">{hostname}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!confirmed && (
        <button onClick={handleConfirm}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2.5 rounded-lg transition">
          Confirm {selected.size} source{selected.size !== 1 ? 's' : ''} · {selectedImgs.size} image{selectedImgs.size !== 1 ? 's' : ''} &amp; continue
        </button>
      )}
    </div>
  );
}

// ── Live browser screenshot ───────────────────────────────────
function BrowserView({ screenshot }) {
  // Updated synchronously during render — no useEffect lag between 'done' event and image paint
  const prevRef = useRef(null);
  if (screenshot?.status === 'done' && screenshot.dataUrl) {
    prevRef.current = { dataUrl: screenshot.dataUrl, title: screenshot.title || '' };
  }

  if (!screenshot) return null;
  const { url, status, dataUrl, title } = screenshot;
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const hostname  = url ? (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })() : '';

  return (
    <div className="space-y-2">
      <SectionHeader icon="🌐" label="Agent Browser" color="purple" />
      <div className="rounded-xl border border-purple-200 overflow-hidden bg-gray-900">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800">
          <div className="flex gap-1 flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 min-w-0 bg-gray-700 rounded-md px-2.5 py-1 flex items-center gap-1.5">
            {isLoading && <span className="w-2 h-2 rounded-full bg-purple-400 pulse-ring flex-shrink-0" />}
            {isDone && (
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            <span className="text-[10px] text-gray-300 truncate">{hostname || 'Loading…'}</span>
          </div>
        </div>

        {/* Screenshot area */}
        <div className="relative w-full bg-gray-900" style={{ aspectRatio: '16/10' }}>
          {/* Current screenshot — renders in the same React commit as the 'done' event */}
          {isDone && dataUrl && (
            <img src={dataUrl} alt={title || hostname} className="w-full h-full object-cover object-top" />
          )}

          {/* Previous screenshot dimmed while next page is loading */}
          {isLoading && prevRef.current?.dataUrl && (
            <img src={prevRef.current.dataUrl} alt="" className="w-full h-full object-cover object-top opacity-30" />
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500 pulse-ring" />
              <span className="text-[10px] text-purple-300">Loading page…</span>
            </div>
          )}

          {/* No screenshot available */}
          {isDone && !dataUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <span className="text-lg">🌐</span>
              <span className="text-[10px] text-gray-500">Page visited — no preview</span>
            </div>
          )}
        </div>

        {/* Page title */}
        {isDone && title && (
          <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700">
            <p className="text-[10px] text-gray-400 truncate">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      </div>
      <p className="text-xs text-gray-400 font-medium">Agent Workspace</p>
      <p className="text-xs text-gray-300 mt-1">Artifacts appear here as the agent works</p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function WorkspacePanel({
  currentStep, outline, planningTokens, agentStatus,
  searchResults, searchImages, browserScreenshot, visitedCount, totalSources, executionMode, onConfirmSearch,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef(null);

  const isPlanning      = currentStep === 0 && agentStatus === 'running';
  const isPlanReady     = currentStep === 0 && agentStatus === 'waiting_approval' && !!outline;
  const isSearching     = currentStep === 1 && agentStatus === 'running' && searchResults.length === 0;
  const hasSearch       = searchResults.length > 0;
  const hasOutline      = !!outline;
  const hasBrowser      = !!browserScreenshot && currentStep === 1;
  const hasContent      = isPlanning || isPlanReady || isSearching || hasSearch || hasOutline || hasBrowser;

  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-8 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <button onClick={() => setCollapsed(false)} title="Expand workspace"
          className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="mt-4 text-gray-300 text-xs font-medium"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          Workspace
        </span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 xl:w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">Agent Workspace</span>
        </div>
        <button onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {!hasContent && <EmptyState />}

        {isPlanning && <PlanningInProgress tokens={planningTokens} />}

        {isPlanReady && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
            <span className="text-lg flex-shrink-0">👈</span>
            <div>
              <p className="text-xs font-semibold text-blue-800">Content plan ready</p>
              <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                Review the outline in the panel on the left — check sections, style and audience before clicking Next.
              </p>
            </div>
          </div>
        )}

        {isSearching && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 pulse-ring" />
            <span className="text-xs font-medium text-purple-700">Searching the web…</span>
          </div>
        )}

        {hasBrowser && (
          <div className="space-y-2">
            {totalSources > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Sources visited</span>
                <span className="text-xs font-semibold text-gray-700">{visitedCount} / {totalSources}</span>
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-1 bg-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((visitedCount / totalSources) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <BrowserView screenshot={browserScreenshot} />
          </div>
        )}

        {hasSearch && (
          <SearchSection
            results={searchResults}
            images={searchImages || []}
            onConfirm={(ids, imgIds) => { onConfirmSearch(ids, imgIds); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            autoConfirmed={false}
            agentStatus={agentStatus}
            currentStep={currentStep}
          />
        )}

      </div>
    </div>
  );
}
