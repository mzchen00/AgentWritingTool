import { useState } from 'react';

const PLACEHOLDER = `please start your writing here`;

export default function SetupScreen({ config, setConfig, onStart }) {
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!config.prompt?.trim()) { setError('Please enter a writing prompt.'); return; }
    setError('');
    onStart({ ...config, agentMode: 'single', executionMode: 'synchronous' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Research Prototype — User Study
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Writing Assistant</h1>
          <p className="text-gray-500 text-base">Describe what you want the agent to write.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Writing Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={6}
              value={config.prompt || ''}
              onChange={e => { setConfig(prev => ({ ...prev, prompt: e.target.value })); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleStart(); }}
              placeholder={PLACEHOLDER}
              className={`w-full border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none leading-relaxed ${
                error ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              autoFocus
            />
            {error
              ? <p className="mt-1.5 text-xs text-red-500">{error}</p>
              : <p className="mt-1.5 text-xs text-gray-400">⌘ + Enter to start</p>
            }
          </div>

          <div className="px-6 pb-6">
            <button
              onClick={handleStart}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl px-6 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Writing Task
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Human–Agent Collaborative Writing Study &nbsp;·&nbsp; Desktop only
        </p>
      </div>
    </div>
  );
}
