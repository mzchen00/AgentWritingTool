import { useState, useEffect, useCallback, useRef } from 'react';
import SetupScreen from './components/SetupScreen';
import AgentTimeline, { DEFAULT_PERSONAS } from './components/AgentTimeline';
import DocumentPanel from './components/DocumentPanel';
import WorkspacePanel from './components/WorkspacePanel';
import ControlBar from './components/ControlBar';
import AnalyticsReport from './components/AnalyticsReport';

const API = '/api';

// Stable session ID for this browser tab — scopes all API calls and SSE to this user.
// crypto.randomUUID() requires HTTPS; fall back to Math.random for plain HTTP.
const SESSION_ID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

const INITIAL_STEPS = [
  { id: 0, name: 'Planning',               color: 'blue',   status: 'pending' },
  { id: 1, name: 'Web Search',             color: 'purple', status: 'pending' },
  { id: 2, name: 'Writing — Introduction', color: 'green',  status: 'pending' },
  { id: 3, name: 'Writing — Body',         color: 'green',  status: 'pending' },
  { id: 4, name: 'Writing — Conclusion',   color: 'green',  status: 'pending' },
  { id: 5, name: 'Review',                 color: 'amber',  status: 'pending' },
];

const DEFAULT_CONFIG = {
  prompt: '',
  agentMode: 'single',
  executionMode: 'asynchronous',
};

// All API calls include sessionId so the server routes requests to the right controller.
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (method === 'GET') {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${API}${path}${sep}sessionId=${SESSION_ID}`, opts);
    return res.json();
  }
  opts.body = JSON.stringify({ ...(body || {}), sessionId: SESSION_ID });
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

function logEvent(type, payload = {}) {
  fetch(`${API}/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload, sessionId: SESSION_ID }),
  }).catch(() => {});
}

export default function App() {
  const [screen, setScreen]               = useState('setup');
  const [config, setConfig]               = useState(DEFAULT_CONFIG);

  // Agent execution state
  const [agentStatus, setAgentStatus]     = useState('idle');
  const [currentStep, setCurrentStep]     = useState(-1);
  const [steps, setSteps]                 = useState(INITIAL_STEPS);
  const [stepMsgs, setStepMsgs]           = useState({});
  const [multiAgent, setMultiAgent]       = useState(null); // 'writer' | 'reviewer' | null

  // Document state
  const [doc, setDoc]                     = useState({ introduction: [], body: [], conclusion: [] });
  const [streaming, setStreaming]         = useState({});   // { [section]: string }
  const [reviewText, setReviewText]       = useState('');

  // Workspace
  const [outline, setOutline]             = useState(null);
  const [planningTokens, setPlanningTokens] = useState('');

  // Search
  const [searchResults, setSearchResults] = useState([]);
  const [searchImages, setSearchImages]   = useState([]);
  const [browserScreenshot, setBrowserScreenshot] = useState(null); // { url, title, dataUrl, status }

  // Personas
  const [personas, setPersonas]           = useState(DEFAULT_PERSONAS);

  // Paragraph rewrites: { [paragraphId]: streamingText }
  const [rewritingParagraphs, setRewritingParagraphs] = useState({});

  // Pasted images: { [imageId]: { id, url, description } }
  const [pastedImages, setPastedImages] = useState({});

  // Auto-approve mode
  const [autoMode, setAutoMode] = useState(false);

  // Source scraping progress
  const [visitedCount, setVisitedCount]   = useState(0);
  const [totalSources, setTotalSources]   = useState(0);

  // Analytics report — data pre-fetched silently; modal only opens when user clicks Session Report
  const [analyticsReport, setAnalyticsReport] = useState(null);
  const [showReport, setShowReport]           = useState(false);

  // ── SSE connection ──────────────────────────────────────────
  const esRef = useRef(null);
  const streamingRef = useRef({});
  const configRef = useRef(config);
  const ignoreNextResetRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => { configRef.current = config; }, [config]);

  const handleEvent = useCallback((type, data) => {
    switch (type) {
      case 'connected':
        break;

      case 'agent_started':
        setAgentStatus('running');
        setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' })));
        setCurrentStep(-1);
        setStepMsgs({});
        setMultiAgent(null);
        break;

      case 'step_start':
        setCurrentStep(data.stepIndex);
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < data.stepIndex ? 'completed'
                : i === data.stepIndex ? 'in-progress'
                : 'pending',
        })));
        setMultiAgent(null);
        break;

      case 'step_status':
        setStepMsgs(prev => ({ ...prev, [data.stepIndex]: data.message }));
        break;

      case 'step_complete':
        setSteps(prev => prev.map((s, i) =>
          i === data.stepIndex ? { ...s, status: 'completed' } : s
        ));
        setStepMsgs(prev => { const n = { ...prev }; delete n[data.stepIndex]; return n; });
        if (data.stepIndex === 0 && data.outline) {
          setOutline(data.outline);
          setPlanningTokens('');
        }
        break;

      case 'planning_token':
        setPlanningTokens(prev => prev + data.text);
        break;

      case 'token':
        if (data.section === 'review') {
          setReviewText(prev => prev + data.text);
        } else {
          setStreaming(prev => ({ ...prev, [data.section]: (prev[data.section] || '') + data.text }));
        }
        break;

      case 'section_complete':
        setDoc(prev => ({ ...prev, [data.section]: data.paragraphs }));
        setStreaming(prev => { const n = { ...prev }; delete n[data.section]; return n; });
        break;

      case 'section_reset':
        setDoc(prev => ({ ...prev, [data.section]: [] }));
        setStreaming(prev => { const n = { ...prev }; delete n[data.section]; return n; });
        break;

      case 'search_results':
        setSearchResults(data.results);
        setSearchImages(data.images || []);
        setAgentStatus('search_review');
        break;

      case 'page_images':
        setSearchImages(data.images || []);
        break;

      case 'browser_screenshot':
        if (data.status !== 'idle') setBrowserScreenshot(data);
        if (data.status === 'done') setVisitedCount(prev => prev + 1);
        break;

      case 'waiting_approval':
        setAgentStatus('waiting_approval');
        break;

      case 'status_update':
        setAgentStatus(data.status);
        break;

      case 'log':
        break;

      case 'paragraph_token':
        setRewritingParagraphs(prev => ({
          ...prev,
          [data.paragraphId]: (prev[data.paragraphId] ?? '') + data.text,
        }));
        break;

      case 'paragraph_updated':
        setDoc(prev => {
          const section = prev[data.section] || [];
          // If paragraph no longer exists (e.g. review agent cleared the section), skip doc update
          if (!section.some(p => p.id === data.paragraphId)) return prev;
          return {
            ...prev,
            [data.section]: section.map(p =>
              p.id === data.paragraphId ? { ...p, text: data.text } : p
            ),
          };
        });
        // Always clear rewriting state so the UI never gets stuck
        setRewritingParagraphs(prev => {
          const n = { ...prev };
          delete n[data.paragraphId];
          return n;
        });
        break;

      case 'agent_completed':
        setAgentStatus('completed');
        setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
        // Pre-fetch analytics so Session Report button works, but don't open the modal
        setTimeout(() => {
          fetch(`${API}/analytics?sessionId=${SESSION_ID}`).then(r => r.json()).then(data => setAnalyticsReport(data)).catch(() => {});
        }, 500);
        break;

      case 'agent_paused':
        setAgentStatus('paused');
        break;

      case 'multi_agent_start':
        setMultiAgent(data.agent);
        break;

      case 'error': {
        const snap = streamingRef.current;
        setDoc(prev => {
          const updated = { ...prev };
          Object.entries(snap).forEach(([section, text]) => {
            if (text) {
              const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
                .map((t, i) => ({ id: `${section}_err_${Date.now()}_${i}`, text: t }));
              updated[section] = [...(prev[section] || []), ...paragraphs];
            }
          });
          return updated;
        });
        setStreaming({});
        setAgentStatus('error');
        break;
      }

      case 'restart_from': {
        const si = data.stepIndex;
        setAgentStatus('running');
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < si ? 'completed' : 'pending',
        })));
        setCurrentStep(si);
        setStepMsgs({});
        if (si <= 0) { setOutline(null); setPlanningTokens(''); }
        if (si <= 1) { setSearchResults([]); setSearchImages([]); }
        if (si <= 2) setDoc(prev => ({ ...prev, introduction: [] }));
        if (si <= 3) setDoc(prev => ({ ...prev, body: [] }));
        if (si <= 4) setDoc(prev => ({ ...prev, conclusion: [] }));
        setReviewText('');
        break;
      }

      case 'reset':
        if (ignoreNextResetRef.current) {
          ignoreNextResetRef.current = false;
        } else {
          doLocalReset();
        }
        break;

      default:
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let retryTimer;

    const connect = () => {
      const es = new EventSource(`${API}/stream?sessionId=${SESSION_ID}`);
      esRef.current = es;

      es.onmessage = e => {
        try {
          const { type, data } = JSON.parse(e.data);
          handleEvent(type, data);
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      esRef.current?.close();
      clearTimeout(retryTimer);
    };
  }, [handleEvent]);

  // ── Handlers ────────────────────────────────────────────────
  const handleStart = async cfg => {
    ignoreNextResetRef.current = true;
    setConfig(cfg);
    setScreen('running');
    setAgentStatus('running');
    setSteps(INITIAL_STEPS);
    setDoc({ introduction: [], body: [], conclusion: [] });
    setStreaming({});
    setReviewText('');

    setCurrentStep(-1);
    setStepMsgs({});
    const payload = { ...cfg, personas };
    const result = await api('/start', 'POST', payload);
    if (result?.error) {
      ignoreNextResetRef.current = true;
      await api('/reset', 'POST');
      setTimeout(() => api('/start', 'POST', payload), 300);
    }
  };

  const handleStop = async () => {
    await api('/stop', 'POST');
    setAgentStatus('paused');
  };

  const handleResume = async () => {
    await api('/resume', 'POST');
    // Don't overwrite if SSE already delivered waiting_approval; only clear the paused/error state
    setAgentStatus(prev => (prev === 'paused' || prev === 'error') ? 'running' : prev);
  };

  const handleSkip = async () => {
    if (!window.confirm('Skip this step and move to the next one?')) return;
    await api('/skip', 'POST');
  };

  const handleApprove = async () => {
    await api('/approve', 'POST');
    setAgentStatus('running');
  };

  const handleSearchConfirm = useCallback(async (selectedIds, selectedImageIds) => {
    setVisitedCount(0);
    setTotalSources(selectedIds.length);
    await api('/search/confirm', 'POST', { selectedIds, selectedImageIds });
    // Only update to 'running' if SSE hasn't already moved us further (e.g. to waiting_approval)
    setAgentStatus(prev => prev === 'search_review' ? 'running' : prev);
  }, []);

  const handleReSearch = useCallback(async () => {
    setSearchResults([]);
    setSearchImages([]);
    setVisitedCount(0);
    setTotalSources(0);
    setAgentStatus('running');
    await api('/search/retry', 'POST');
  }, []);

  const handleRewriteRestart = async newPrompt => {
    ignoreNextResetRef.current = true;
    const newConfig = { ...config, prompt: newPrompt };
    setConfig(newConfig);
    setDoc({ introduction: [], body: [], conclusion: [] });
    setStreaming({});
    setReviewText('');
    setOutline(null);
    setPlanningTokens('');

    setCurrentStep(-1);
    setStepMsgs({});
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' })));
    setSearchResults([]);
    setSearchImages([]);
    setMultiAgent(null);
    setAgentStatus('idle');
    await api('/reset', 'POST');
    setTimeout(() => api('/start', 'POST', newConfig), 350);
  };

  const handleEditParagraph = async (section, paragraphId, text) => {
    await api('/document/edit', 'POST', { section, paragraphId, text });
  };

  const handleRemoveParagraph = (section, paragraphId) => {
    setDoc(prev => ({
      ...prev,
      [section]: (prev[section] || []).filter(p => p.id !== paragraphId),
    }));
    api('/document/remove', 'POST', { section, paragraphId });
  };

  // afterParagraphId: insert after this paragraph
  // replaceParagraphId: replace this paragraph with the new image
  const handleDropImage = (section, afterParagraphId, url, description) => {
    const imageId = `drop_${Date.now()}`;
    const paraId  = `img_para_${Date.now()}`;
    setPastedImages(prev => ({ ...prev, [imageId]: { id: imageId, url, description: description || '' } }));
    setDoc(prev => {
      const paras = prev[section] || [];
      const afterIdx = paras.findIndex(p => p.id === afterParagraphId);
      const insertIdx = afterIdx === -1 ? paras.length : afterIdx + 1;
      const next = [...paras];
      next.splice(insertIdx, 0, { id: paraId, text: `[IMAGE:${imageId}]` });
      return { ...prev, [section]: next };
    });
  };

  const handlePasteImage = (dataUrl, section, afterParagraphId, replaceParagraphId) => {
    const imageId = `paste_${Date.now()}`;
    const paraId  = `img_para_${Date.now()}`;
    logEvent('image_pasted', { section });
    setPastedImages(prev => ({
      ...prev,
      [imageId]: { id: imageId, url: dataUrl, description: 'Pasted screenshot' },
    }));
    setDoc(prev => {
      const paras = prev[section] || [];
      if (replaceParagraphId) {
        return { ...prev, [section]: paras.map(p => p.id === replaceParagraphId ? { ...p, text: `[IMAGE:${imageId}]` } : p) };
      }
      const afterIdx = paras.findIndex(p => p.id === afterParagraphId);
      const insertIdx = afterIdx === -1 ? paras.length : afterIdx + 1;
      const next = [...paras];
      next.splice(insertIdx, 0, { id: paraId, text: `[IMAGE:${imageId}]` });
      return { ...prev, [section]: next };
    });
  };

  const handleRewriteParagraph = async (section, paragraphId, instruction, originalText) => {
    setRewritingParagraphs(prev => ({ ...prev, [paragraphId]: '' }));
    const result = await api('/document/rewrite', 'POST', { section, paragraphId, instruction, originalText });
    if (result?.error) {
      // Clear stuck rewriting state on API-level error
      setRewritingParagraphs(prev => { const n = { ...prev }; delete n[paragraphId]; return n; });
    }
  };

  const handleRestart = () => handleRestartFrom(0);

  const handleRestartFrom = async (stepIndex, newPrompt) => {
    // Clear state immediately — don't wait for SSE event
    if (newPrompt) setConfig(prev => ({ ...prev, prompt: newPrompt }));
    setAgentStatus('running');
    setStreaming({});
    setReviewText('');
    setStepMsgs({});
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i < stepIndex ? 'completed' : 'pending',
    })));
    setCurrentStep(stepIndex);
    if (stepIndex <= 0) { setOutline(null); setPlanningTokens(''); setAnalyticsReport(null); }
    if (stepIndex <= 1) { setSearchResults([]); setSearchImages([]); setBrowserScreenshot(null); }
    if (stepIndex <= 2) setDoc(prev => ({ ...prev, introduction: [] }));
    if (stepIndex <= 3) setDoc(prev => ({ ...prev, body: [] }));
    if (stepIndex <= 4) setDoc(prev => ({ ...prev, conclusion: [] }));

    logEvent('plan_rewrite_triggered', { stepIndex });
    const body = { stepIndex };
    if (newPrompt) body.prompt = newPrompt;
    await api('/restart-from', 'POST', body);
  };

  const handlePersonaEdit = async (type, draft) => {
    const updated = { ...personas, [type]: { ...personas[type], ...draft } };
    setPersonas(updated);
    await api('/personas', 'POST', { personas: updated });
  };

  const handlePlanUpdate = async (partial) => {
    setOutline(prev => ({ ...prev, ...partial }));
    await api('/plan/update', 'POST', partial);
  };

  // Auto-approve mode: fire approve/confirm automatically when agent pauses
  useEffect(() => {
    if (!autoMode) return;
    if (agentStatus === 'waiting_approval') {
      const t = setTimeout(() => handleApprove(), 600);
      return () => clearTimeout(t);
    }
    if (agentStatus === 'search_review') {
      const allIds    = searchResults.map(r => r.id);
      const allImgIds = searchImages.map(i => i.id);
      const t = setTimeout(() => handleSearchConfirm(allIds, allImgIds), 600);
      return () => clearTimeout(t);
    }
  }, [autoMode, agentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFullReset = async () => {
    await api('/reset', 'POST');
    doLocalReset();
  };

  const doLocalReset = () => {
    setScreen('setup');
    setAgentStatus('idle');
    setSteps(INITIAL_STEPS);
    setDoc({ introduction: [], body: [], conclusion: [] });
    setStreaming({});
    setReviewText('');

    setCurrentStep(-1);
    setStepMsgs({});
    setSearchResults([]);
    setSearchImages([]);
    setBrowserScreenshot(null);
    setMultiAgent(null);
    setOutline(null);
    setPlanningTokens('');
    setConfig(DEFAULT_CONFIG);
  };

  // ── Render ──────────────────────────────────────────────────
  if (screen === 'setup') {
    return <SetupScreen config={config} setConfig={setConfig} onStart={handleStart} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Control Bar */}
      <ControlBar
        agentStatus={agentStatus}
        currentStep={currentStep}
        onStop={handleStop}
        onSkip={handleSkip}
        onApprove={handleApprove}
        onReset={handleFullReset}
        onResume={handleResume}
        onRestart={handleRestart}
        onDismissPause={() => setAgentStatus('idle')}
        onViewReport={() => {
          fetch(`${API}/analytics?sessionId=${SESSION_ID}`)
            .then(r => r.json())
            .then(data => { setAnalyticsReport(data); setShowReport(true); })
            .catch(() => { if (analyticsReport) setShowReport(true); });
        }}
        autoMode={autoMode}
        onToggleAutoMode={() => setAutoMode(v => {
          const next = !v;
          logEvent('auto_mode_toggled', { enabled: next });
          return next;
        })}
      />

      {/* Three-panel main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Agent Timeline */}
        <aside className="w-80 xl:w-96 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <AgentTimeline
            steps={steps}
            currentStep={currentStep}
            stepMsgs={stepMsgs}
            agentMode={config.agentMode}
            multiAgent={multiAgent}
            agentStatus={agentStatus}
            outline={outline}
            personas={personas}
            prompt={config.prompt}
            onPersonaEdit={handlePersonaEdit}
            onPlanUpdate={handlePlanUpdate}
            onRestartFrom={handleRestartFrom}
          />
        </aside>

        {/* Middle — Agent Workspace */}
        <WorkspacePanel
          currentStep={currentStep}
          outline={outline}
          planningTokens={planningTokens}
          agentStatus={agentStatus}
          searchResults={searchResults}
          searchImages={searchImages}
          browserScreenshot={browserScreenshot}
          visitedCount={visitedCount}
          totalSources={totalSources}
          executionMode={config.executionMode}
          onConfirmSearch={handleSearchConfirm}
        />

        {/* Right — Document Output */}
        <main className="flex-1 overflow-y-auto relative">
          {agentStatus === 'completed' && (
            <div className="sticky top-0 z-10 bg-emerald-50 border-b border-emerald-200 px-6 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">Article complete</span>
            </div>
          )}
          <DocumentPanel
            doc={doc}
            streaming={streaming}
            reviewText={reviewText}
            currentStep={currentStep}
            agentStatus={agentStatus}
            onEditParagraph={handleEditParagraph}
            onRemoveParagraph={handleRemoveParagraph}
            images={searchImages}
            rewritingParagraphs={rewritingParagraphs}
            onRewriteParagraph={handleRewriteParagraph}
            pastedImages={pastedImages}
            onPasteImage={handlePasteImage}
            onDropImage={handleDropImage}
          />
        </main>
      </div>

      {showReport && analyticsReport && (
        <AnalyticsReport
          report={analyticsReport}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
