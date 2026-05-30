require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const https = require('https');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const screenshotStore = new Map(); // id -> dataUrl

// ── Auto-start Python scraper service ────────────────────────
const SCRAPER_PORT = 3002;
let scraperReady = false;

function startScraper() {
  const proc = spawn('python3', ['-m', 'uvicorn', 'main:app', '--port', String(SCRAPER_PORT), '--host', '127.0.0.1', '--log-level', 'warning'], {
    cwd: path.join(__dirname, 'scraper'),
    stdio: 'inherit',
  });
  proc.on('error', err => console.error('[scraper] failed to start:', err.message));
  process.on('exit', () => proc.kill());
  const poll = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${SCRAPER_PORT}/health`, res => {
      if (res.statusCode === 200) { scraperReady = true; clearInterval(poll); console.log('[scraper] ready on port', SCRAPER_PORT); }
    });
    req.on('error', () => {});
  }, 800);
}
startScraper();

// ── Call Python scraper (single URL) ─────────────────────────
function scrapeOnePage(url) {
  return new Promise((resolve) => {
    if (!scraperReady) return resolve({ images: [], screenshot: null, title: '' });
    const body = JSON.stringify({ url });
    const req = http.request({
      hostname: '127.0.0.1', port: SCRAPER_PORT, path: '/scrape-one', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ images: [], screenshot: null, title: '' }); }
      });
    });
    req.on('error', () => resolve({ images: [], screenshot: null, title: '' }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ images: [], screenshot: null, title: '' }); });
    req.write(body);
    req.end();
  });
}

function tavilySearch(query, maxResults = 8) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: 'advanced',
    });
    const req = https.request({
      hostname: 'api.tavily.com',
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ results: parsed.results || [] });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// Execution Controller (one instance per session)
// ─────────────────────────────────────────────────────────────
class ExecutionController {
  constructor(sendEvent) {
    this._sendEvent = sendEvent;
    this.reset();
  }

  reset() {
    this.config = null;
    this.currentStep = -1;
    this.status = 'idle';
    this.document = { introduction: [], body: [], conclusion: [] };
    this.outline = null;
    this.searchResults = [];
    this.searchImages = [];
    this.selectedSourceIds = [];
    this.selectedImageIds = [];
    this.pendingInstructions = [];
    this.logs = [];

    this._resumeResolvers = [];
    this._approvalResolver = null;
    this._searchResolver = null;
    this._stopFlag = false;
    this._skipFlag = false;
    this._executing = false;

    // Analytics
    this.analyticsLog = [];
    this._sessionStartTime = null;
    this._approvalStartTime = null;
  }

  logEvent(type, payload = {}) {
    this.analyticsLog.push({ type, ts: Date.now(), ...payload });
  }

  getState() {
    return {
      status: this.status,
      currentStep: this.currentStep,
      document: this.document,
      searchResults: this.searchResults,
      selectedSourceIds: this.selectedSourceIds,
      outline: this.outline,
      config: this.config,
    };
  }

  addLog(message) {
    const entry = { id: `${Date.now()}-${Math.random()}`, message, timestamp: new Date().toISOString() };
    this.logs.push(entry);
    this._sendEvent('log', entry);
  }

  // ── Control ───────────────────────────────────────────────
  pause() {
    this.logEvent('agent_paused', { stepIndex: this.currentStep });
    this.status = 'paused';
    this._sendEvent('status_update', { status: 'paused', currentStep: this.currentStep });
  }

  resume() {
    this.logEvent('agent_resumed', { stepIndex: this.currentStep });
    if (this._approvalResolver) {
      this.status = 'waiting_approval';
      this._sendEvent('waiting_approval', { stepIndex: this.currentStep });
      this._sendEvent('status_update', { status: 'waiting_approval', currentStep: this.currentStep });
    } else if (this._searchResolver) {
      this.status = 'search_review';
      this._sendEvent('status_update', { status: 'search_review', currentStep: this.currentStep });
    } else {
      this.status = 'running';
      this._sendEvent('status_update', { status: 'running', currentStep: this.currentStep });
      const rs = [...this._resumeResolvers];
      this._resumeResolvers = [];
      rs.forEach(r => r());
    }
  }

  abort() {
    this._stopFlag = true;
    const rs = [...this._resumeResolvers];
    this._resumeResolvers = [];
    rs.forEach(r => r());
    if (this._approvalResolver) { this._approvalResolver({ action: 'stop' }); this._approvalResolver = null; }
    if (this._searchResolver)   { this._searchResolver([]);                    this._searchResolver = null;   }
  }

  skip() {
    this._skipFlag = true;
    const waitMs = this._approvalStartTime ? Date.now() - this._approvalStartTime : null;
    this.logEvent('step_skipped', { stepIndex: this.currentStep, waitMs });
    const rs = [...this._resumeResolvers];
    this._resumeResolvers = [];
    rs.forEach(r => r());
    if (this._approvalResolver) { this._approvalResolver({ action: 'skip' }); this._approvalResolver = null; this._approvalStartTime = null; }
    if (this._searchResolver)   { this._searchResolver(this.selectedSourceIds); this._searchResolver = null; }
  }

  approve() {
    if (this._approvalResolver) {
      const waitMs = this._approvalStartTime ? Date.now() - this._approvalStartTime : null;
      this.logEvent('step_approved', { stepIndex: this.currentStep, waitMs });
      this._approvalResolver({ action: 'approve' });
      this._approvalResolver = null;
      this._approvalStartTime = null;
    }
  }

  injectInstructions(text) {
    this.pendingInstructions.push(text);
    this.addLog(`User instruction injected: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
  }

  confirmSearch(ids, imageIds) {
    this._approvalStartTime = null;
    this.selectedSourceIds = ids;
    if (imageIds !== undefined) this.selectedImageIds = imageIds;
    if (this.status === 'paused') {
      this.status = 'running';
      this._sendEvent('status_update', { status: 'running', currentStep: this.currentStep });
    }
    if (this._searchResolver) { this._searchResolver(ids); this._searchResolver = null; }
  }

  editParagraph(section, paragraphId, newText) {
    const arr = this.document[section];
    const idx = arr.findIndex(p => p.id === paragraphId);
    if (idx !== -1) {
      arr[idx].text = newText;
      this._sendEvent('paragraph_updated', { section, paragraphId, text: newText });
    }
  }

  consumePendingInstructions() {
    const out = [...this.pendingInstructions];
    this.pendingInstructions = [];
    return out;
  }

  // ── Async waits ───────────────────────────────────────────
  async waitIfPaused() {
    if (this.status !== 'paused') return;
    await new Promise(resolve => { this._resumeResolvers.push(resolve); });
  }

  async waitForApproval() {
    this._approvalStartTime = Date.now();
    return new Promise(resolve => { this._approvalResolver = resolve; });
  }

  async waitForSearchConfirmation() {
    this._approvalStartTime = Date.now();
    return new Promise(resolve => { this._searchResolver = resolve; });
  }
}

// ─────────────────────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────────────────────
const sessions = new Map(); // sessionId -> { controller, sseClient, sendEvent, cleanupTimer }
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    const session = { sseClient: null, cleanupTimer: null, controller: null, sendEvent: null };

    const sendEvent = (type, data) => {
      const client = session.sseClient;
      if (client && !client.writableEnded) {
        try { client.write(`data: ${JSON.stringify({ type, data })}\n\n`); }
        catch (e) { console.error('SSE write error:', e.message); }
      }
    };

    session.sendEvent = sendEvent;
    session.controller = new ExecutionController(sendEvent);
    sessions.set(sessionId, session);
    console.log(`[session] created ${sessionId} (total: ${sessions.size})`);
  }
  return sessions.get(sessionId);
}

function scheduleSessionCleanup(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  session.cleanupTimer = setTimeout(() => {
    const s = sessions.get(sessionId);
    if (s && !s.sseClient) {
      s.controller.abort();
      sessions.delete(sessionId);
      console.log(`[session] cleaned up ${sessionId} (remaining: ${sessions.size})`);
    }
  }, SESSION_TIMEOUT_MS);
}

// Extract sessionId from request and return the session, or send 400.
function requireSession(req, res) {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return null; }
  return getOrCreateSession(sessionId);
}

// ─────────────────────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, name: 'Planning',                 color: 'blue'   },
  { id: 1, name: 'Web Search',               color: 'purple' },
  { id: 2, name: 'Writing — Introduction',   color: 'green'  },
  { id: 3, name: 'Writing — Body',           color: 'green'  },
  { id: 4, name: 'Writing — Conclusion',     color: 'green'  },
  { id: 5, name: 'Review',                   color: 'amber'  },
];

// ─────────────────────────────────────────────────────────────
// Helper: streaming call with pause/skip support
// ─────────────────────────────────────────────────────────────
async function streamCall(controller, messages, onToken, { jsonMode = false } = {}) {
  const opts = { model: 'gpt-5.4-mini-2026-03-17', messages, stream: true };
  if (jsonMode) opts.response_format = { type: 'json_object' };

  const stream = await openai.chat.completions.create(opts);
  let full = '';

  for await (const chunk of stream) {
    await controller.waitIfPaused();
    if (controller._stopFlag) return null;
    if (controller._skipFlag) break;

    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) { full += delta; onToken(delta); }
  }
  return full;
}

// ─────────────────────────────────────────────────────────────
// Step: Planning
// ─────────────────────────────────────────────────────────────
async function executePlanning(controller, sendEvent) {
  sendEvent('step_status', { stepIndex: 0, message: 'Generating document structure...' });
  controller.addLog('Agent is planning the document structure...');

  if (controller._skipFlag) {
    controller.addLog('Planning step skipped by user.');
    sendEvent('step_complete', { stepIndex: 0, skipped: true });
    return true;
  }

  const { prompt: userPrompt = '' } = controller.config;
  const instructions = controller.consumePendingInstructions();

  const messages = [
    {
      role: 'system',
      content: (() => {
        const p = controller.config?.personas?.planner;
        const name = p?.name || 'Alex'; const role = p?.role || 'Strategic Planner';
        const desc = p?.description ? `\n${p.description}` : '';
        return `You are ${name}, a ${role}.${desc}\nAnalyze the user's writing prompt and produce a structured document outline suited to the content type — articles, technical docs, README pages, product pages, guides, etc.`;
      })(),
    },
    {
      role: 'user',
      content: `User writing prompt: "${userPrompt}"
${instructions.length ? 'Additional instructions: ' + instructions.join('. ') : ''}

Create a detailed outline. Infer the topic, appropriate writing style, target audience, and the key sections needed for the body.
Sections should match the content type — e.g. for a food article: dish sections; for a software README: installation/features/usage sections; for a product page: overview/benefits/specs sections.

Respond with JSON:
{
  "topic": "concise subject of the document",
  "writing_style": "inferred style (e.g. technical, casual, journalistic, formal)",
  "target_audience": "inferred audience",
  "introduction_points": ["point1","point2","point3"],
  "sections": [
    {"name":"Section Name","description":"what this section covers","key_points":["specific detail to include","another detail"]},
    {"name":"Section Name","description":"what this section covers","key_points":["specific detail to include","another detail"]},
    {"name":"Section Name","description":"what this section covers","key_points":["specific detail to include"]}
  ],
  "conclusion_points": ["point1","point2"]
}

Generate 3–5 sections.`,
    },
  ];

  const stepStart = Date.now();
  try {
    let planText = '';
    const result = await streamCall(controller, messages, delta => {
      planText += delta;
      sendEvent('planning_token', { text: delta });
    }, { jsonMode: true });

    if (result === null) return false;

    try { controller.outline = JSON.parse(planText); }
    catch { controller.outline = { topic: 'the topic', introduction_points: [], sections: [], conclusion_points: [] }; }

    controller.logEvent('step_generation_complete', { stepIndex: 0, generationMs: Date.now() - stepStart });
    sendEvent('step_complete', { stepIndex: 0, outline: controller.outline });
    controller.addLog(`Planning complete. Document topic: ${controller.outline.topic || 'unknown'}.`);

    if (controller.config.executionMode === 'synchronous') {
      controller.status = 'waiting_approval';
      sendEvent('waiting_approval', { stepIndex: 0 });
      controller.addLog('Waiting for user approval before continuing...');
      const res = await controller.waitForApproval();
      if (res.action === 'stop') return false;
      controller.status = 'running';
    }
    return true;
  } catch (err) {
    console.error('Planning error:', err);
    sendEvent('error', { message: err.message });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Step: Web Search
// ─────────────────────────────────────────────────────────────
async function executeSearch(controller, sendEvent, sessionId) {
  const topic = controller.outline?.topic || 'the topic';
  sendEvent('step_status', { stepIndex: 1, message: `Searching for references on: ${topic}...` });
  controller.addLog(`Searching web for: ${topic}`);

  if (controller._skipFlag) {
    controller.addLog('Web search step skipped by user.');
    sendEvent('step_complete', { stepIndex: 1, skipped: true });
    return true;
  }

  const instructions = controller.consumePendingInstructions();
  const sectionNames = (controller.outline?.sections || []).slice(0, 3).map(s => s.name).join(', ');

  const researcherPersona    = controller.config?.personas?.search || controller.config?.personas?.researcher;
  const researcherName       = researcherPersona?.name           || 'Scout';
  const researcherRole       = researcherPersona?.role           || 'Research Agent';
  const researcherDesc       = researcherPersona?.description    || '';
  const extraKeywords        = (researcherPersona?.searchKeywords || '').trim();
  const maxResults           = Math.min(10, Math.max(5, Number(researcherPersona?.maxResults) || 5));

  const stepStart = Date.now();
  try {
    let query = `${topic} ${sectionNames}`.trim();
    const queryMessages = [
      {
        role: 'system',
        content: `You are ${researcherName}, a ${researcherRole}.${researcherDesc ? '\n' + researcherDesc : ''}
Your job is to find the most relevant web sources for a writing project. Generate a focused search query that reflects your research perspective and expertise.`,
      },
      {
        role: 'user',
        content: `Writing topic: "${topic}"
Key sections to cover: ${sectionNames}
${instructions.length ? 'Special focus: ' + instructions.join('. ') : ''}

Write a single web search query (under 120 characters) that will find the most useful sources for this writing project from your research perspective. Return only the query text, no explanation.`,
      },
    ];
    let generatedQuery = '';
    await streamCall(controller, queryMessages, delta => { generatedQuery += delta; });
    if (generatedQuery.trim()) {
      query = generatedQuery.trim().replace(/^["']|["']$/g, '');
    }
    if (extraKeywords) query = `${query} ${extraKeywords}`;
    controller.addLog(`Search query (by ${researcherName}): "${query}"`);

    const { results: tavilyRes } = await tavilySearch(query, maxResults);

    const results = tavilyRes.map((r, i) => ({
      id: String(i + 1),
      title: r.title,
      source: new URL(r.url).hostname.replace('www.', ''),
      url: r.url,
      summary: r.content,
      rawContent: r.raw_content || '',
      relevance: r.score >= 0.7 ? 'high' : r.score >= 0.4 ? 'medium' : 'low',
    }));

    controller.searchResults = results;
    controller.searchImages = [];
    controller.selectedSourceIds = results.map(r => r.id);
    controller.selectedImageIds = [];

    controller.logEvent('step_generation_complete', { stepIndex: 1, generationMs: Date.now() - stepStart });
    controller.status = 'search_review';
    sendEvent('search_results', { results, images: [] });
    controller.addLog('Search complete. Pausing for user to review and confirm sources...');
    sendEvent('step_status', { stepIndex: 1, message: 'Waiting for source confirmation...' });

    const confirmedIds = await controller.waitForSearchConfirmation();
    if (controller._stopFlag) return false;

    const confirmed = results.filter(r => confirmedIds.includes(r.id));
    controller.addLog(`User confirmed ${confirmed.length} of ${results.length} sources.`);

    // Scrape confirmed pages one by one, streaming screenshots live
    if (confirmed.length > 0 && scraperReady) {
      controller.addLog('Scraping confirmed pages for images...');
      const allImages = [];
      const screenshotImages = [];
      const seenImgUrls = new Set();
      let sIdx = 0;
      // Use session prefix so screenshot IDs don't collide across sessions
      const scrnshotPrefix = `${sessionId.slice(0, 8)}_scrn`;

      for (let pIdx = 0; pIdx < confirmed.length; pIdx++) {
        const source = confirmed[pIdx];
        if (controller._stopFlag) break;
        sendEvent('step_status', { stepIndex: 1, message: `Visiting page ${pIdx + 1} of ${confirmed.length}: ${source.source}…` });
        sendEvent('browser_screenshot', { url: source.url, title: source.title, dataUrl: null, status: 'loading' });

        const result = await scrapeOnePage(source.url);

        if (result.screenshot) {
          const sid = `${scrnshotPrefix}_${sIdx++}`;
          screenshotStore.set(sid, result.screenshot);
          screenshotImages.push({
            id: sid,
            url: `/api/screenshot/${sid}`,
            description: `Screenshot of "${result.title || source.title}"`,
            type: 'screenshot',
            sourcePage: source.url,
          });
        }

        for (const img of result.images || []) {
          if (!seenImgUrls.has(img.url)) {
            seenImgUrls.add(img.url);
            allImages.push(img);
          }
        }

        const sortedRegular = [...allImages]
          .sort((a, b) => (b.width * b.height) - (a.width * a.height))
          .slice(0, 15)
          .map((img, i) => ({
            id: `page_img_${i}`,
            url: img.data_url || img.url,
            description: img.alt || '',
            width: img.width,
            height: img.height,
            sourcePage: img.source_page,
          }));
        const currentImages = [...screenshotImages, ...sortedRegular].slice(0, 20);
        controller.searchImages = currentImages;
        controller.selectedImageIds = currentImages.map(i => i.id);
        sendEvent('page_images', { images: currentImages });

        controller.logEvent('page_visited', { url: source.url, title: result.title || source.title || source.source || '' });

        sendEvent('browser_screenshot', {
          url: source.url,
          title: result.title || source.title,
          dataUrl: result.screenshot || null,
          status: 'done',
        });

        await new Promise(r => setTimeout(r, 800));
      }

      controller.addLog(`Found ${controller.searchImages.length} images (${screenshotImages.length} screenshots).`);
    }

    controller.status = 'running';
    sendEvent('step_complete', { stepIndex: 1, selectedSources: confirmed });

    if (controller.config.executionMode === 'synchronous') {
      controller.status = 'waiting_approval';
      sendEvent('waiting_approval', { stepIndex: 1 });
      sendEvent('status_update', { status: 'waiting_approval', currentStep: 1 });
      controller.addLog('Search & scraping complete. Click Next to start writing.');
      const res = await controller.waitForApproval();
      if (res.action === 'stop') return false;
      controller.status = 'running';
    }

    return true;
  } catch (err) {
    console.error('Search error:', err);
    sendEvent('error', { message: err.message });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Step: Writing (introduction / body / conclusion)
// ─────────────────────────────────────────────────────────────
async function executeWriting(section, controller, sendEvent) {
  const stepIndexMap = { introduction: 2, body: 3, conclusion: 4 };
  const labelMap     = { introduction: 'Introduction', body: 'Body', conclusion: 'Conclusion' };
  const stepIndex    = stepIndexMap[section];
  const label        = labelMap[section];

  if (controller._skipFlag) {
    controller.addLog(`${label} writing skipped by user.`);
    sendEvent('step_complete', { stepIndex, skipped: true });
    return true;
  }

  const { agentMode } = controller.config;
  const writingStyle   = controller.outline?.writing_style  || 'clear and engaging';
  const targetAudience = controller.outline?.target_audience || 'general readers';
  const topic          = controller.outline?.topic           || 'the topic';
  const instructions   = controller.consumePendingInstructions();

  const selectedSources = controller.searchResults.filter(r => controller.selectedSourceIds.includes(r.id));
  const sourceContext = selectedSources.length
    ? `Reference sources:\n${selectedSources.map(s => {
        const content = s.rawContent ? s.rawContent.substring(0, 800) : s.summary;
        return `- ${s.title} (${s.source}):\n  ${content}`;
      }).join('\n\n')}`
    : '';

  const selectedImages = controller.searchImages.filter(img => controller.selectedImageIds.includes(img.id));
  const imageContext = selectedImages.length
    ? `Embed images in the article by placing [IMAGE:id] alone on its own paragraph (surrounded by blank lines) at a natural breakpoint:\n${
        selectedImages.map(img => `  [IMAGE:${img.id}]: ${img.description || 'image'}`).join('\n')
      }\n\nEmbed 1–3 images where they add the most visual value. Each [IMAGE:id] must be its own paragraph separated by blank lines from surrounding text.`
    : '';

  let userPrompt = '';
  if (section === 'introduction') {
    userPrompt = `Write the introduction for a document about: ${topic}.

Key points to cover:
${(controller.outline?.introduction_points || []).map((p, i) => `${i + 1}. ${p}`).join('\n') || '- Introduce the topic'}

${sourceContext}
${imageContext}
${instructions.length ? `Special instructions: ${instructions.join('. ')}` : ''}

Write 2–3 engaging paragraphs separated by double newlines. Do not include headers or titles.`;

  } else if (section === 'body') {
    const sections = controller.outline?.sections || [];
    userPrompt = `Write the main body of the document about: ${topic}.

Cover these sections (use ## Section Name as a heading for each):
${sections.map((s, i) => {
  const pts = (s.key_points || []).map(p => `  - ${p}`).join('\n');
  return `${i + 1}. **${s.name}**: ${s.description}${pts ? `\n  Key points:\n${pts}` : ''}`;
}).join('\n\n')}

${sourceContext}
${imageContext}
${instructions.length ? `Special instructions: ${instructions.join('. ')}` : ''}

For each section write 2–3 paragraphs. Use "## Section Name" as a heading before each section. Separate paragraphs with double newlines.`;

  } else {
    const introSnippet = controller.document.introduction.map(p => p.text).join('\n\n').substring(0, 400);
    userPrompt = `Write the conclusion for a document about: ${topic}.

Key points:
${(controller.outline?.conclusion_points || []).map((p, i) => `${i + 1}. ${p}`).join('\n') || '- Summarise and close'}

${introSnippet ? `Document introduction (for continuity):\n${introSnippet}…` : ''}
${instructions.length ? `Special instructions: ${instructions.join('. ')}` : ''}

Write 2 paragraphs. Separate with double newlines. No headers.`;
  }

  const writerPersona = controller.config?.personas?.writer;
  const writerName = writerPersona?.name || 'Maya';
  const writerRole = writerPersona?.role || 'Writer Agent';
  const writerDesc = writerPersona?.description || '';
  const systemPrompt = `You are ${writerName}, a ${writerRole}.${writerDesc ? `\n${writerDesc}` : ''}
Writing style: ${writingStyle}
Target audience: ${targetAudience}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];

  const stepStart = Date.now();
  try {
    let sectionText = '';

    if (agentMode === 'multi') {
      // ── Writer Agent ──────────────────────────────────────
      sendEvent('step_status', { stepIndex, message: `Writing ${label}… (Writer Agent)` });
      sendEvent('multi_agent_start', { agent: 'writer', stepIndex });
      controller.addLog(`Writer Agent is drafting the ${section} section...`);

      const draft = await streamCall(controller, messages, delta => {
        sectionText += delta;
        sendEvent('token', { section, text: delta, agent: 'writer' });
      });

      if (draft === null) return false;

      if (!controller._skipFlag) {
        // ── Reviewer Agent ────────────────────────────────
        controller.addLog(`Writer Agent completed draft. Reviewer Agent is refining...`);
        sendEvent('step_status', { stepIndex, message: `Reviewing ${label}… (Reviewer Agent)` });
        sendEvent('multi_agent_start', { agent: 'reviewer', stepIndex });

        sendEvent('section_reset', { section });
        sectionText = '';

        const reviewMsgs = [
          {
            role: 'system',
            content: (() => {
              const p = controller.config?.personas?.reviewer;
              const name = p?.name || 'Kai'; const role = p?.role || 'Reviewer Agent';
              const desc = p?.description ? `\n${p.description}` : '';
              return `You are ${name}, a ${role}.${desc}\nWriting style: ${writingStyle}. Target audience: ${targetAudience}. Improve the draft—better flow, vivid details, stronger voice—while keeping the same structure and approximate length. Return only the improved text.`;
            })(),
          },
          { role: 'user', content: `Improve this ${section} draft:\n\n${draft}` },
        ];

        const refined = await streamCall(controller, reviewMsgs, delta => {
          sectionText += delta;
          sendEvent('token', { section, text: delta, agent: 'reviewer' });
        });

        if (refined === null) return false;
        controller.addLog(`Reviewer Agent completed ${section} refinement.`);
      }
    } else {
      // ── Single Agent ──────────────────────────────────────
      sendEvent('step_status', { stepIndex, message: `Writing ${label}...` });
      controller.addLog(`Agent is writing the ${section} section...`);

      const result = await streamCall(controller, messages, delta => {
        sectionText += delta;
        sendEvent('token', { section, text: delta });
      });

      if (result === null) return false;
    }

    if (sectionText) {
      const paragraphs = sectionText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map((text, i) => ({ id: `${section}_${Date.now()}_${i}`, text }));

      controller.document[section] = paragraphs;
      sendEvent('section_complete', { section, paragraphs });
      controller.addLog(`Draft complete for ${label} section.`);
    }

    controller.logEvent('step_generation_complete', { stepIndex, generationMs: Date.now() - stepStart });
    sendEvent('step_complete', { stepIndex });

    if (controller.config.executionMode === 'synchronous') {
      controller.status = 'waiting_approval';
      sendEvent('waiting_approval', { stepIndex });
      controller.addLog('Waiting for user approval before continuing...');
      const res = await controller.waitForApproval();
      if (res.action === 'stop') return false;
      controller.status = 'running';
    }

    return true;
  } catch (err) {
    console.error(`Writing ${section} error:`, err);
    sendEvent('error', { message: err.message });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Step: Review
// ─────────────────────────────────────────────────────────────
async function executeReview(controller, sendEvent) {
  sendEvent('step_status', { stepIndex: 5, message: 'Reviewing the complete document...' });
  controller.addLog('Agent is reviewing the complete document...');

  if (controller._skipFlag) {
    controller.addLog('Review step skipped by user.');
    sendEvent('step_complete', { stepIndex: 5, skipped: true });
    return true;
  }

  const instructions = controller.consumePendingInstructions();

  const introText      = controller.document.introduction.map(p => p.text).join('\n\n');
  const bodyText       = controller.document.body.map(p => p.text).join('\n\n');
  const conclusionText = controller.document.conclusion.map(p => p.text).join('\n\n');
  const fullDoc = [introText, bodyText, conclusionText].filter(Boolean).join('\n\n---\n\n');

  const reviewerPersona = controller.config?.personas?.reviewer;
  const reviewerName = reviewerPersona?.name || 'Kai';
  const reviewerRole = reviewerPersona?.role || 'Reviewer Agent';
  const reviewerDesc = reviewerPersona?.description ? `\n${reviewerPersona.description}` : '';
  const writingStyle   = controller.outline?.writing_style  || 'clear and engaging';
  const targetAudience = controller.outline?.target_audience || 'general readers';

  const feedbackMessages = [
    { role: 'system', content: `You are ${reviewerName}, a ${reviewerRole} and experienced editor.${reviewerDesc}\nProvide constructive, specific feedback on the document.` },
    {
      role: 'user',
      content: `Review this document and provide editorial feedback:

${fullDoc}

${instructions.length ? `Special focus: ${instructions.join('. ')}` : ''}

Format:

**EDITORIAL REVIEW**

**Strengths:**
1. [strength]
2. [strength]
3. [strength]

**Suggestions for Improvement:**
1. [suggestion]
2. [suggestion]

**Overall Assessment:**
[2–3 sentence assessment]`,
    },
  ];

  const stepStart = Date.now();
  try {
    // ── Phase 1: Generate feedback ────────────────────────────
    let feedbackText = '';
    const feedbackResult = await streamCall(controller, feedbackMessages, delta => {
      feedbackText += delta;
      sendEvent('token', { section: 'review', text: delta });
    });

    if (feedbackResult === null) return false;
    controller.logEvent('step_generation_complete', { stepIndex: 5, generationMs: Date.now() - stepStart });
    controller.addLog('Review feedback complete. Waiting for user to decide whether to apply suggestions…');

    // ── Pause: ask user whether to apply suggestions ──────────
    if (controller.config.executionMode === 'synchronous') {
      controller.status = 'waiting_approval';
      sendEvent('waiting_approval', { stepIndex: 5, type: 'review_confirm' });
      sendEvent('status_update', { status: 'waiting_approval', currentStep: 5 });
      const res = await controller.waitForApproval();
      if (res.action === 'stop') return false;
      if (res.action === 'skip') {
        sendEvent('step_complete', { stepIndex: 5, skipped: true });
        return true;
      }
      controller.status = 'running';
      sendEvent('status_update', { status: 'running', currentStep: 5 });
    }

    controller.addLog('Applying improvements to each section…');

    // ── Phase 2: Rewrite each section using the feedback ─────
    const sectionsToRevise = [
      { key: 'introduction', label: 'Introduction', text: introText },
      { key: 'body',         label: 'Body',         text: bodyText  },
      { key: 'conclusion',   label: 'Conclusion',   text: conclusionText },
    ].filter(s => s.text);

    for (const { key, label, text } of sectionsToRevise) {
      if (controller._stopFlag || controller._skipFlag) break;

      sendEvent('step_status', { stepIndex: 5, message: `Revising ${label}…` });
      sendEvent('section_reset', { section: key });
      controller.document[key] = [];

      const reviseMsgs = [
        {
          role: 'system',
          content: `You are ${reviewerName}, a ${reviewerRole}.${reviewerDesc}\nWriting style: ${writingStyle}. Target audience: ${targetAudience}.\nApply editorial improvements to the provided text. Return only the revised text — no commentary, no headings unless they existed in the original.`,
        },
        {
          role: 'user',
          content: `Apply the following review feedback to improve the ${label} section. Keep the same structure and approximate length.

Review feedback:
${feedbackText}

Original ${label}:
${text}

Write the improved ${label}:`,
        },
      ];

      let revised = '';
      const reviseResult = await streamCall(controller, reviseMsgs, delta => {
        revised += delta;
        sendEvent('token', { section: key, text: delta });
      });

      if (reviseResult === null) return false;

      if (revised) {
        const paragraphs = revised.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
          .map((t, i) => ({ id: `${key}_revised_${Date.now()}_${i}`, text: t }));
        controller.document[key] = paragraphs;
        sendEvent('section_complete', { section: key, paragraphs });
        controller.addLog(`${label} revised.`);
      }
    }

    controller.addLog('All sections revised. Review complete.');
    sendEvent('step_complete', { stepIndex: 5 });

    return true;
  } catch (err) {
    console.error('Review error:', err);
    sendEvent('error', { message: err.message });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Main agent runner
// ─────────────────────────────────────────────────────────────
async function runAgent(controller, sendEvent, sessionId, fromStep = 0) {
  controller.status = 'running';
  if (fromStep === 0) {
    sendEvent('agent_started', { steps: STEPS, config: controller.config });
    controller.addLog('Agent started.');
  } else {
    sendEvent('restart_from', { stepIndex: fromStep });
    controller.addLog(`Restarting from step ${fromStep + 1}.`);
  }

  const stepFns = [
    () => executePlanning(controller, sendEvent),
    () => executeSearch(controller, sendEvent, sessionId),
    () => executeWriting('introduction', controller, sendEvent),
    () => executeWriting('body', controller, sendEvent),
    () => executeWriting('conclusion', controller, sendEvent),
    () => executeReview(controller, sendEvent),
  ];

  for (let i = fromStep; i < stepFns.length; i++) {
    controller.currentStep = i;
    controller._skipFlag = false;
    sendEvent('step_start', { stepIndex: i, step: STEPS[i] });

    await controller.waitIfPaused();
    if (controller._stopFlag) break;

    const ok = await stepFns[i]();

    if (!ok || controller._stopFlag) {
      controller.status = 'paused';
      controller.addLog('Agent execution paused.');
      sendEvent('agent_paused', { currentStep: i });
      return;
    }
  }

  if (!controller._stopFlag) {
    controller.status = 'completed';
    controller.addLog('Article writing complete!');
    const durationMs = controller._sessionStartTime ? Date.now() - controller._sessionStartTime : null;
    controller.logEvent('session_complete', { durationMs });
    sendEvent('agent_completed', {});
  }
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// SSE endpoint — each client connects with its own sessionId
app.get('/api/stream', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const session = getOrCreateSession(sessionId);
  if (session.cleanupTimer) { clearTimeout(session.cleanupTimer); session.cleanupTimer = null; }
  session.sseClient = res;

  // Send current state so reconnecting clients can restore UI
  session.sendEvent('connected', { state: session.controller.getState() });

  req.on('close', () => {
    if (session.sseClient === res) {
      session.sseClient = null;
      scheduleSessionCleanup(sessionId);
    }
  });
});

app.post('/api/start', async (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;

  if (controller._executing) return res.status(400).json({ error: 'Already running' });

  // Reset all state so previous runs don't bleed into the new one
  controller.reset();
  controller.config = req.body;
  controller._executing = true;
  controller._sessionStartTime = Date.now();
  controller.logEvent('session_start', { prompt: req.body.prompt?.substring(0, 200) });
  res.json({ success: true });
  runAgent(controller, sendEvent, sessionId).finally(() => { controller._executing = false; });
});

app.post('/api/stop', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.controller.pause();
  res.json({ success: true });
});

app.post('/api/resume', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.controller.resume();
  res.json({ success: true });
});

app.post('/api/skip', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.controller.skip();
  res.json({ success: true });
});

app.post('/api/approve', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { controller, sendEvent } = session;
  controller.approve();
  controller.status = 'running';
  sendEvent('status_update', { status: 'running', currentStep: controller.currentStep });
  res.json({ success: true });
});

app.post('/api/inject', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { instructions } = req.body;
  if (!instructions) return res.status(400).json({ error: 'No instructions' });
  session.controller.injectInstructions(instructions);
  res.json({ success: true });
});

app.post('/api/search/confirm', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { controller } = session;
  const { selectedIds, selectedImageIds } = req.body;
  const waitMs = controller._approvalStartTime ? Date.now() - controller._approvalStartTime : null;
  controller.logEvent('search_confirmed', {
    sourceCount: (selectedIds || []).length,
    imageCount: (selectedImageIds || []).length,
    waitMs,
  });
  controller.confirmSearch(selectedIds || [], selectedImageIds);
  res.json({ success: true });
});

app.post('/api/search/retry', (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;
  const config = { ...controller.config };
  controller.abort();
  controller._executing = false;
  setTimeout(() => {
    controller._stopFlag = false;
    controller._skipFlag = false;
    controller.pendingInstructions = [];
    controller._resumeResolvers = [];
    controller._approvalResolver = null;
    controller._searchResolver = null;
    controller.searchResults = [];
    controller.searchImages = [];
    controller.selectedSourceIds = [];
    controller.selectedImageIds = [];
    controller.status = 'running';
    controller.config = config;
    controller._executing = true;
    runAgent(controller, sendEvent, sessionId, 1).finally(() => { controller._executing = false; });
  }, 200);
  res.json({ success: true });
});

app.post('/api/document/edit', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { section, paragraphId, text } = req.body;
  session.controller.logEvent('paragraph_edited', { section });
  session.controller.editParagraph(section, paragraphId, text);
  res.json({ success: true });
});

app.post('/api/document/remove', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { section, paragraphId } = req.body;
  if (!section || !paragraphId) return res.status(400).json({ error: 'section and paragraphId required' });
  const arr = session.controller.document[section];
  if (arr) session.controller.document[section] = arr.filter(p => p.id !== paragraphId);
  res.json({ success: true });
});

app.post('/api/document/rewrite', async (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;
  const { section, paragraphId, instruction, originalText } = req.body;
  if (!section || !paragraphId) return res.status(400).json({ error: 'section and paragraphId required' });
  controller.logEvent('paragraph_rewrite_requested', { section, instruction: instruction?.substring(0, 200) || null });

  const arr = controller.document[section];
  const para = arr?.find(p => p.id === paragraphId);
  const textToRewrite = para?.text || originalText;
  if (!textToRewrite) return res.status(400).json({ error: 'No text to rewrite' });

  res.json({ success: true });

  const writingStyle   = controller.outline?.writing_style  || 'clear and engaging';
  const targetAudience = controller.outline?.target_audience || 'general readers';
  const topic          = controller.outline?.topic           || 'the topic';
  const wp = controller.config?.personas?.writer;
  const systemPrompt = `You are ${wp?.name || 'Maya'}, a ${wp?.role || 'Writer Agent'}.${wp?.description ? `\n${wp.description}` : ''}
Writing style: ${writingStyle}. Target audience: ${targetAudience}.
Rewrite the provided paragraph. Return only the rewritten paragraph — no label, no explanation.`;

  const userPrompt = `Article topic: ${topic}

Original paragraph:
${textToRewrite}
${instruction ? `\nInstruction: ${instruction}` : ''}

Rewrite this paragraph.`;

  let full = '';
  try {
    await streamCall(
      controller,
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      delta => {
        full += delta;
        sendEvent('paragraph_token', { paragraphId, text: delta });
      }
    );
    const trimmed = full.trim();
    if (trimmed && para) {
      const idx = arr.findIndex(p => p.id === paragraphId);
      if (idx !== -1) arr[idx].text = trimmed;
    }
    sendEvent('paragraph_updated', { section, paragraphId, text: trimmed || textToRewrite });
  } catch (err) {
    console.error('Rewrite error:', err);
    sendEvent('paragraph_updated', { section, paragraphId, text: textToRewrite });
  }
});

app.post('/api/restart', (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;
  const config = controller.config;
  controller.abort();
  controller._executing = false;
  setTimeout(() => {
    controller.reset();
    controller.config = config;
    sendEvent('reset', {});
  }, 200);
  res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;
  controller.abort();
  controller._executing = false;
  setTimeout(() => {
    controller.reset();
    sendEvent('reset', {});
  }, 200);
  res.json({ success: true });
});

app.post('/api/restart-from', (req, res) => {
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getOrCreateSession(sessionId);
  const { controller, sendEvent } = session;
  const { stepIndex, prompt } = req.body;
  if (stepIndex === undefined) return res.status(400).json({ error: 'stepIndex required' });
  const config = { ...controller.config };
  if (prompt) config.prompt = prompt;

  controller.abort();
  controller._executing = false;

  setTimeout(() => {
    controller._stopFlag = false;
    controller._skipFlag = false;
    controller.pendingInstructions = [];
    controller._resumeResolvers = [];
    controller._approvalResolver = null;
    controller._searchResolver = null;
    controller.status = 'running';
    controller.config = config;

    // Drop analytics events belonging to restarted steps so times don't accumulate.
    const stepEvents = new Set(['step_generation_complete', 'step_approved', 'step_skipped']);
    const searchEvents = new Set(['search_confirmed', 'page_visited', 'external_link_clicked']);
    controller.analyticsLog = controller.analyticsLog.filter(e => {
      if (stepEvents.has(e.type) && e.stepIndex >= stepIndex) return false;
      if (searchEvents.has(e.type) && stepIndex <= 1) return false;
      return true;
    });

    if (stepIndex <= 0) { controller.outline = null; }
    if (stepIndex <= 1) {
      controller.searchResults = [];
      controller.searchImages = [];
      controller.selectedSourceIds = [];
      controller.selectedImageIds = [];
    }
    if (stepIndex <= 2) { controller.document.introduction = []; }
    if (stepIndex <= 3) { controller.document.body = []; }
    if (stepIndex <= 4) { controller.document.conclusion = []; }

    controller._executing = true;
    runAgent(controller, sendEvent, sessionId, stepIndex).finally(() => { controller._executing = false; });
  }, 200);

  res.json({ success: true });
});

app.post('/api/update-prompt', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (session.controller.config) session.controller.config.prompt = prompt;
  res.json({ success: true });
});

app.post('/api/personas', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { personas } = req.body;
  if (!personas || typeof personas !== 'object') return res.status(400).json({ error: 'Invalid personas' });
  session.controller.logEvent('persona_edited', { agents: Object.keys(personas) });
  if (session.controller.config) session.controller.config.personas = { ...(session.controller.config.personas || {}), ...personas };
  res.json({ success: true });
});

app.post('/api/plan/update', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { controller } = session;
  if (!controller.outline) return res.status(400).json({ error: 'No active outline' });
  const allowed = ['sections', 'introduction_points', 'conclusion_points', 'writing_style', 'target_audience', 'topic'];
  const changedKeys = allowed.filter(k => req.body[k] !== undefined);
  controller.logEvent('plan_modified', { fields: changedKeys });
  for (const key of changedKeys) controller.outline[key] = req.body[key];
  res.json({ success: true });
});

app.get('/api/state', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  res.json(session.controller.getState());
});

app.get('/api/screenshot/:id', (req, res) => {
  const dataUrl = screenshotStore.get(req.params.id);
  if (!dataUrl) return res.status(404).end();
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mime = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(Buffer.from(base64, 'base64'));
});

// ── Analytics ────────────────────────────────────────────────

app.post('/api/analytics/event', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { type, ...payload } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  session.controller.logEvent(type, payload);
  res.json({ success: true });
});

const STEP_NAMES = ['Planning', 'Web Search', 'Introduction', 'Body', 'Conclusion', 'Review'];

app.get('/api/analytics', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { controller } = session;

  const log = controller.analyticsLog;
  const sessionStart = controller._sessionStartTime;
  const now = Date.now();
  const sessionCompleteEvent = log.find(e => e.type === 'session_complete');

  const approvals  = log.filter(e => e.type === 'step_approved');
  const skips      = log.filter(e => e.type === 'step_skipped');
  const pauses     = log.filter(e => e.type === 'agent_paused');
  const resumes    = log.filter(e => e.type === 'agent_resumed');
  const paraEdits  = log.filter(e => e.type === 'paragraph_edited');
  const rewrites   = log.filter(e => e.type === 'paragraph_rewrite_requested');
  const planMods   = log.filter(e => e.type === 'plan_modified');
  const personaEds = log.filter(e => e.type === 'persona_edited');
  const imagePastes= log.filter(e => e.type === 'image_pasted');
  const planRewrites = log.filter(e => e.type === 'plan_rewrite_triggered');
  const searchConf      = log.find(e => e.type === 'search_confirmed');
  const pagesVisited    = log.filter(e => e.type === 'page_visited');
  const linkClicks      = log.filter(e => e.type === 'external_link_clicked');
  const autoToggles     = log.filter(e => e.type === 'auto_mode_toggled');
  const reviewApplied = approvals.find(e => e.stepIndex === 5);
  const reviewSkipped = skips.find(e => e.stepIndex === 5);

  const editsBySection = { introduction: 0, body: 0, conclusion: 0 };
  paraEdits.forEach(e => { if (editsBySection[e.section] !== undefined) editsBySection[e.section]++; });

  const rewritesBySection = { introduction: 0, body: 0, conclusion: 0 };
  rewrites.forEach(e => { if (rewritesBySection[e.section] !== undefined) rewritesBySection[e.section]++; });

  const generationEvents = log.filter(e => e.type === 'step_generation_complete');
  const stepBreakdown = STEP_NAMES.map((name, i) => {
    const approved    = approvals.find(e => e.stepIndex === i);
    const skipped     = skips.find(e => e.stepIndex === i);
    const genEvent    = generationEvents.find(e => e.stepIndex === i);
    return {
      step: i, name,
      outcome: approved ? 'approved' : skipped ? 'skipped' : 'pending',
      generationMs: genEvent?.generationMs ?? null,
      reviewWaitMs: (approved || skipped)?.waitMs ?? null,
    };
  });

  const summary = {
    sessionDurationMs: sessionCompleteEvent?.durationMs ?? (sessionStart ? now - sessionStart : null),
    prompt: controller.config?.prompt?.substring(0, 300) || null,

    steps: stepBreakdown,

    controls: {
      pauses: pauses.length,
      resumes: resumes.length,
      stepsApproved: approvals.length,
      stepsSkipped: skips.length,
    },

    editing: {
      manualEditsTotal: paraEdits.length,
      manualEditsBySection: editsBySection,
      aiRewritesTotal: rewrites.length,
      aiRewritesBySection: rewritesBySection,
      rewriteInstructions: rewrites.map(e => e.instruction).filter(Boolean),
    },

    plan: {
      modifications: planMods.length,
      rewriteTriggered: planRewrites.length,
      modifiedFields: [...new Set(planMods.flatMap(e => e.fields || []))],
    },

    personas: {
      editCount: personaEds.length,
      agentsEdited: [...new Set(personaEds.flatMap(e => e.agents || []))],
    },

    search: searchConf
      ? {
          sourcesSelected: searchConf.sourceCount,
          imagesSelected: searchConf.imageCount,
          waitMs: searchConf.waitMs,
          pagesVisited: pagesVisited.map(e => ({ url: e.url, title: e.title })),
          externalLinkClicks: linkClicks.map(e => ({ url: e.url, title: e.title })),
        }
      : null,

    review: {
      applied: !!reviewApplied,
      skipped: !!reviewSkipped,
      waitMs: (reviewApplied || reviewSkipped)?.waitMs ?? null,
    },

    images: { pasted: imagePastes.length },

    autoMode: {
      everEnabled: autoToggles.some(e => e.enabled),
      toggleCount: autoToggles.length,
    },
  };

  res.json({ summary, events: log });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Writing agent server running on http://localhost:${PORT}`));
