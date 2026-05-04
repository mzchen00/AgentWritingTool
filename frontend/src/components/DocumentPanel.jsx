import { useState, useRef, useEffect } from 'react';

function ImageBlock({ img }) {
  return (
    <figure className="my-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <img
        src={img.url}
        alt={img.description || ''}
        className="w-full object-cover max-h-80"
        onError={e => { const fig = e.target.closest('figure'); if (fig) fig.style.display = 'none'; }}
      />
      {img.description && (
        <figcaption className="px-3 py-2 text-xs text-gray-500 bg-gray-50 italic border-t border-gray-100">
          {img.description}
        </figcaption>
      )}
    </figure>
  );
}

// Render markdown-lite: bold (**text**), ## headings, images, and paragraphs
function RenderText({ text, imageMap }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const imgMatch = line.match(/^\[IMAGE:([^\]]+)\]$/);
        if (imgMatch) {
          const img = imageMap?.[imgMatch[1]];
          return img ? <ImageBlock key={i} img={img} /> : null;
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="text-base font-bold text-gray-800 mt-3 mb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return (
            <p key={i} className="font-semibold text-gray-800">
              {line.slice(2, -2)}
            </p>
          );
        }
        // Inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i} className="block text-gray-700 leading-relaxed text-[15px]">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </span>
        );
      })}
    </div>
  );
}

function EditableParagraph({ para, section, onSave, onRemove, onReplace, isSelected, onSelect, onDeselect, imageMap, onRequestRewrite, isRewriting, rewriteText, onDropImage }) {
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draft, setDraft] = useState(para.text);
  const [showRewritePanel, setShowRewritePanel] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const taRef = useRef(null);
  const isImageParagraph = /^\[IMAGE:[^\]]+\]$/.test(para.text.trim());

  useEffect(() => {
    if (!isSelected) {
      setEditing(false);
      setDraft(para.text);
      setShowRewritePanel(false);
      setRewriteInstruction('');
    }
  }, [isSelected, para.text]);

  useEffect(() => {
    if (!isRewriting) {
      setShowRewritePanel(false);
      setRewriteInstruction('');
    }
  }, [isRewriting]);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  const handleClick = () => { if (!isSelected) onSelect(para.id); };

  const handleSave = () => {
    if (draft.trim() !== para.text) onSave(section, para.id, draft.trim());
    setEditing(false);
    onDeselect();
  };

  const handleCancel = () => {
    setDraft(para.text);
    setEditing(false);
    setShowRewritePanel(false);
    onDeselect();
  };

  const handleRewrite = () => {
    onRequestRewrite(section, para.id, rewriteInstruction.trim(), para.text);
    setShowRewritePanel(false);
  };

  const ringClass = isRewriting
    ? 'ring-2 ring-emerald-400 bg-emerald-50'
    : isSelected
    ? 'ring-2 ring-blue-400 bg-blue-50'
    : 'hover:bg-gray-50 cursor-pointer';

  return (
    <div
      onClick={handleClick}
      onDragOver={e => { if (onDropImage) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.type === 'search-image' && onDropImage) onDropImage(section, para.id, data.url, data.description);
        } catch {}
      }}
      className={`group relative rounded-lg transition-all ${dragOver ? 'ring-2 ring-blue-400 ring-offset-1' : ringClass} p-3 -mx-3`}
    >
      {/* Action buttons */}
      {isSelected && !editing && !isRewriting && (
        <div className="absolute -top-2 right-0 flex gap-1.5 z-10">
          {isImageParagraph ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); onReplace && onReplace(section, para.id); }}
                className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-md font-medium hover:bg-blue-700 shadow-sm"
              >
                Replace (⌘V)
              </button>
              <button
                onClick={e => { e.stopPropagation(); onRemove(section, para.id); onDeselect(); }}
                className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-1 rounded-md font-medium hover:bg-red-100 shadow-sm"
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <button
                onClick={e => { e.stopPropagation(); setEditing(true); setShowRewritePanel(false); }}
                className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-md font-medium hover:bg-blue-700 shadow-sm"
              >
                Edit
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowRewritePanel(v => !v); }}
                className={`text-xs px-2.5 py-1 rounded-md font-medium shadow-sm transition ${
                  showRewritePanel
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'
                }`}
              >
                ✦ Rewrite
              </button>
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); handleCancel(); }}
            className="bg-white text-gray-600 text-xs px-2.5 py-1 rounded-md font-medium hover:bg-gray-100 shadow-sm border border-gray-200"
          >
            Deselect
          </button>
        </div>
      )}

      {editing ? (
        <div onClick={e => e.stopPropagation()}>
          <textarea
            ref={taRef}
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            className="w-full border border-blue-400 rounded-md px-3 py-2 text-[15px] text-gray-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            rows={4}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleSave} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-blue-700">Save Changes</button>
            <button onClick={handleCancel} className="bg-white text-gray-600 text-xs px-3 py-1.5 rounded-md font-medium hover:bg-gray-100 border border-gray-200">Cancel</button>
          </div>
        </div>
      ) : isRewriting ? (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-ring" />
            <span className="text-[10px] font-medium text-emerald-600">Agent rewriting…</span>
          </div>
          <div className="streaming-cursor">
            <RenderText text={rewriteText || '…'} imageMap={imageMap} />
          </div>
        </div>
      ) : (
        <>
          <RenderText text={para.text} imageMap={imageMap} />

          {/* Paste hint */}
          {isSelected && !showRewritePanel && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[9px] font-mono">⌘V</kbd>
              <span>{isImageParagraph ? 'paste to replace this screenshot' : 'paste screenshot after this paragraph'}</span>
            </div>
          )}

          {/* Rewrite instruction panel */}
          {showRewritePanel && (
            <div className="mt-3 pt-3 border-t border-violet-200 space-y-2" onClick={e => e.stopPropagation()}>
              <p className="text-[11px] font-medium text-gray-600">
                Rewrite instruction <span className="font-normal text-gray-400">(optional — press Enter to run)</span>
              </p>
              <textarea
                value={rewriteInstruction}
                onChange={e => setRewriteInstruction(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRewrite(); }
                  if (e.key === 'Escape') setShowRewritePanel(false);
                }}
                placeholder="e.g. make it more concise, add a specific example, use simpler language…"
                rows={2}
                autoFocus
                className="w-full text-xs border border-violet-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none placeholder:text-gray-300 leading-relaxed"
              />
              <div className="flex gap-2">
                <button onClick={handleRewrite} className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-violet-700">
                  Rewrite
                </button>
                <button onClick={() => setShowRewritePanel(false)} className="bg-white text-gray-600 text-xs px-3 py-1.5 rounded-md font-medium hover:bg-gray-100 border border-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Hover hint */}
          {!isSelected && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shadow-sm">
                click to select
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ label, color }) {
  const colors = {
    blue:   'text-blue-700 bg-blue-100 border-blue-200',
    green:  'text-emerald-700 bg-emerald-100 border-emerald-200',
    amber:  'text-amber-700 bg-amber-100 border-amber-200',
    purple: 'text-purple-700 bg-purple-100 border-purple-200',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${colors[color] || colors.blue}`}>
      {label}
    </div>
  );
}

function StreamingBlock({ text, imageMap }) {
  if (!text) return null;
  const paras = text.split(/\n\n+/).filter(p => p.trim());
  return (
    <div className="space-y-3">
      {paras.map((para, i) => {
        const isLast = i === paras.length - 1;
        const imgMatch = para.trim().match(/^\[IMAGE:([^\]]+)\]$/);
        if (imgMatch) {
          const img = imageMap?.[imgMatch[1]];
          return img ? <ImageBlock key={i} img={img} /> : null;
        }
        return (
          <div key={i} className={`text-gray-700 leading-relaxed text-[15px] p-3 -mx-3 ${isLast ? 'streaming-cursor' : ''}`}>
            <RenderText text={para} imageMap={imageMap} />
          </div>
        );
      })}
    </div>
  );
}

export default function DocumentPanel({ doc, streaming, reviewText, currentStep, agentStatus, onEditParagraph, onRemoveParagraph, images, rewritingParagraphs, onRewriteParagraph, pastedImages, onPasteImage, onDropImage }) {
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('article'); // 'article' | 'review'
  const imageMap = { ...(pastedImages || {}), ...Object.fromEntries((images || []).map(img => [img.id, img])) };
  const bottomRef = useRef(null);

  // Refs so the paste handler always has fresh state without re-registering
  const docRef        = useRef(doc);
  const selectedIdRef = useRef(selectedId);
  const sectionsRef   = useRef(null);
  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Switch to review tab when review text appears; back to article when it's cleared
  useEffect(() => {
    setTab(reviewText ? 'review' : 'article');
  }, [!!reviewText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch back to article when review apply starts or agent completes
  const prevStatus = useRef(agentStatus);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = agentStatus;
    if (prev === 'waiting_approval' && agentStatus === 'running' && currentStep === 5) {
      setTab('article');
    }
    if (agentStatus === 'completed') setTab('article');
  }, [agentStatus, currentStep]);

  // Also switch to article the moment any section_reset fires during review rewrite
  const prevDoc = useRef(doc);
  useEffect(() => {
    if (currentStep === 5 && agentStatus === 'running') {
      const wasCleared = ['introduction', 'body', 'conclusion'].some(
        k => prevDoc.current[k].length > 0 && doc[k].length === 0
      );
      if (wasCleared) setTab('article');
    }
    prevDoc.current = doc;
  }, [doc, currentStep, agentStatus]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (Object.keys(streaming).length > 0 || (tab === 'review' && reviewText)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [streaming, reviewText, tab]);

  // Paste-image listener (registered once; reads fresh state via refs)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const blob = imageItem.getAsFile();
      if (!blob) return;

      const currentDoc = docRef.current;
      const selectedId = selectedIdRef.current;
      const sectionKeys = ['introduction', 'body', 'conclusion'];

      let targetSection = null;
      let afterParagraphId = null;
      let replaceParagraphId = null;

      if (selectedId) {
        for (const key of sectionKeys) {
          const para = (currentDoc[key] || []).find(p => p.id === selectedId);
          if (para) {
            targetSection = key;
            // If selected paragraph is an image, replace it; otherwise insert after
            if (/^\[IMAGE:[^\]]+\]$/.test(para.text.trim())) {
              replaceParagraphId = selectedId;
            } else {
              afterParagraphId = selectedId;
            }
            break;
          }
        }
      }
      if (!targetSection) {
        for (let i = sectionKeys.length - 1; i >= 0; i--) {
          const paras = currentDoc[sectionKeys[i]] || [];
          if (paras.length > 0) {
            targetSection = sectionKeys[i];
            afterParagraphId = paras[paras.length - 1].id;
            break;
          }
        }
      }
      if (!targetSection) return;

      const reader = new FileReader();
      reader.onload = ev => onPasteImage(ev.target.result, targetSection, afterParagraphId, replaceParagraphId);
      reader.readAsDataURL(blob);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onPasteImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = id => setSelectedId(id);
  const handleDeselect = () => setSelectedId(null);

  // Trigger system paste dialog for replace (fallback: remind user to use ⌘V)
  const handleReplaceImage = (section, paragraphId) => {
    // The paste event listener above will detect the selected image paragraph and replace it.
    // Just make sure it's selected — user then presses ⌘V.
    setSelectedId(paragraphId);
  };

  const sections = [
    { key: 'introduction', label: 'Introduction', color: 'green', stepId: 2 },
    { key: 'body',         label: 'Main Body',    color: 'green', stepId: 3 },
    { key: 'conclusion',   label: 'Conclusion',   color: 'green', stepId: 4 },
  ];

  const hasAnyContent = sections.some(s => doc[s.key].length > 0 || streaming[s.key]) || reviewText;

  if (!hasAnyContent && currentStep < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">Document output will appear here</p>
        <p className="text-gray-400 text-xs mt-1">The agent is {currentStep === -1 ? 'starting…' : 'preparing to write…'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">

      {/* Tab bar — only shown once review text exists */}
      {reviewText && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setTab('article')}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
              tab === 'article'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Article
          </button>
          <button
            onClick={() => setTab('review')}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tab === 'review'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Review Suggestions
            {currentStep === 5 && agentStatus === 'running' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block pulse-ring" />
            )}
          </button>
        </div>
      )}

      {/* Article tab */}
      {tab === 'article' && (
        <div className="space-y-10">
          {sections.map(({ key, label, color, stepId }) => {
            const paragraphs = doc[key];
            const streamText = streaming[key];
            const hasContent = paragraphs.length > 0 || streamText;
            // Only animate the section currently being written; step 5 (review) can rewrite any section
            const isWritingActive = agentStatus === 'running' && (currentStep === stepId || currentStep === 5);

            if (!hasContent && !isWritingActive) return null;

            return (
              <section key={key}>
                <div className="flex items-center gap-3 mb-4">
                  <SectionLabel label={label} color={color} />
                  {(streamText || (isWritingActive && !paragraphs.length)) && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block pulse-ring" />
                      {currentStep === 5 ? 'Rewriting…' : 'Writing…'}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Skeleton while section is cleared and streaming hasn't started yet */}
                  {isWritingActive && !paragraphs.length && !streamText && (
                    <div className="space-y-2.5 animate-pulse">
                      <div className="h-3.5 bg-gray-100 rounded-full w-full" />
                      <div className="h-3.5 bg-gray-100 rounded-full w-11/12" />
                      <div className="h-3.5 bg-gray-100 rounded-full w-4/5" />
                      <div className="h-3.5 bg-gray-100 rounded-full w-full mt-4" />
                      <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
                    </div>
                  )}
                  {paragraphs.map(para => (
                    <EditableParagraph
                      key={para.id}
                      para={para}
                      section={key}
                      isSelected={selectedId === para.id}
                      onSelect={handleSelect}
                      onDeselect={handleDeselect}
                      onSave={onEditParagraph}
                      onRemove={onRemoveParagraph}
                      onReplace={handleReplaceImage}
                      imageMap={imageMap}
                      onRequestRewrite={onRewriteParagraph}
                      isRewriting={!!(rewritingParagraphs?.[para.id] !== undefined)}
                      rewriteText={rewritingParagraphs?.[para.id] || ''}
                      onDropImage={onDropImage}
                    />
                  ))}
                  {streamText && <StreamingBlock text={streamText} imageMap={imageMap} />}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Review tab */}
      {tab === 'review' && reviewText && (
        <section>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className={`text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap ${
              currentStep === 5 && agentStatus === 'running' ? 'streaming-cursor' : ''
            }`}>
              {reviewText}
            </div>
          </div>
        </section>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
