import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Command, Sparkles, MessageSquare, Settings, 
  Trash2, Send, User, Bot, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Folder, Clock, Play, Pencil, Share2, Copy, Check, CheckSquare, XSquare, Pin, Star, Search, Download, Upload, Lock, Unlock, Key, AppWindow, Ghost, Info, Eye, EyeOff, Network, Plus
} from 'lucide-react';
import { sha256 } from '../utils/crypto';
import { sanitizeUrl, isValidUrl } from '../utils/url';
import type { WorkspaceSession } from '../storage/db';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'folders' | 'map' | 'settings'>('chat');
  const [toastMessage, setToastMessage] = useState<{title: string, description?: string, type?: 'success'|'error'|'info'} | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (title: string, description?: string, type: 'success'|'error'|'info' = 'info') => {
    setToastMessage({title, description, type});
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  // Open launcher if navigated to dashboard with ?launcher=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('launcher') === 'true') {
      setLauncherOpen(true);
      // Clean up the URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listen for OPEN_LAUNCHER message from the service worker (when tab already open)
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'OPEN_LAUNCHER') setLauncherOpen(true);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // Also allow Cmd+K / Ctrl+K directly inside the dashboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setLauncherOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-[#090514] via-[#050505] to-[#050914] text-[#e0e0e0] font-sans selection:bg-accent-purple/30">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] border-r border-white/[0.04] flex flex-col pt-8 pb-6 px-4 bg-black/20 backdrop-blur-3xl">
        <div className="flex items-center gap-3 px-4 mb-10 text-white">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white">
              <rect x="8" y="4" width="14" height="12" rx="2" strokeWidth="1.5" opacity="0.4" />
              <rect x="5" y="7" width="14" height="12" rx="2" strokeWidth="1.5" opacity="0.7" />
              <rect x="2" y="10" width="14" height="12" rx="2" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
              <path d="M4 14H14" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <span className="font-medium tracking-wide text-sm text-white">Tabflow</span>
        </div>

        <nav className="flex-1 space-y-1.5 px-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium mb-4 pl-2">Workspace</div>
          <NavItem 
            icon={<MessageSquare />} label="Chat with Tabs" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
          />
          <NavItem 
            icon={<Folder />} label="Folders" 
            active={activeTab === 'folders'} 
            onClick={() => setActiveTab('folders')} 
          />
          <NavItem 
            icon={<Network />} label="Workspace Map" 
            active={activeTab === 'map'} 
            onClick={() => setActiveTab('map')} 
          />
        </nav>

        <div className="pt-6 border-t border-white/[0.04] px-2 flex flex-col gap-2">
          <NavItem 
            icon={<Settings />} label="Preferences" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
          {/* Smart Launcher trigger */}
          <button
            onClick={() => setLauncherOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-medium tracking-wide text-white/30 hover:bg-white/[0.03] hover:text-white/70 transition-all group mt-1"
          >
            <div className="w-4 h-4 flex items-center justify-center text-white/30 group-hover:text-white/60 transition-colors">
              <Command className="w-4 h-4" />
            </div>
            <span className="flex-1 text-left">Smart Launcher</span>
            <kbd className="text-[9px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/30 font-mono tracking-wider">
              {navigator.userAgent.toUpperCase().indexOf('MAC') >= 0 ? '⌘⇧K' : 'Ctrl+Shift+K'}
            </kbd>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col bg-transparent">
        {/* View Container */}
        <div id="main-scroll-container" className="flex-1 overflow-y-auto px-12 pb-12 pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-6xl h-full mx-auto w-full"
            >
              {activeTab === 'chat' && <ChatView />}
              {activeTab === 'folders' && <FoldersView showToast={showToast} />}
              {activeTab === 'map' && <WorkspaceMapView showToast={showToast} />}
              {activeTab === 'settings' && <SettingsView showToast={showToast} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#110e20]/90 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          >
            {toastMessage.type === 'error' && <Info className="w-5 h-5 text-accent-pink" />}
            {toastMessage.type === 'success' && <Check className="w-5 h-5 text-green-400" />}
            {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            <div>
              <p className="text-sm font-medium text-white">{toastMessage.title}</p>
              {toastMessage.description && <p className="text-xs text-white/50 mt-0.5">{toastMessage.description}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Launcher Modal */}
      <SmartLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        onNavigate={(tab) => { setActiveTab(tab); setLauncherOpen(false); }}
      />
    </div>
  );
}

// ─── Sub-Views ──────────────────────────────────────────────────────────────


function ChatView() {
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingCommands, setPendingCommands] = useState<{type: string, args: Record<string,string>, raw: string}[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    import('@/storage/db').then(({ getSetting }) => {
      getSetting<{role: 'user'|'assistant', content: string}[]>('chat_history', []).then(history => {
        setMessages(history.length > 200 ? history.slice(history.length - 200) : history);
      });
    });
  }, []);

  // Save chat history whenever it changes
  useEffect(() => {
    import('@/storage/db').then(({ setSetting }) => {
      setSetting('chat_history', messages.length > 200 ? messages.slice(messages.length - 200) : messages);
    });
  }, [messages]);

  // Auto scroll to bottom when message or typing state changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleAsk = async (overrideInput?: string) => {
    const query = overrideInput || input;
    if (!query.trim()) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }, { role: 'assistant', content: '' }]);
    setIsTyping(true);

    try {
      const port = chrome.runtime.connect({ name: 'chat-stream' });
      let receivedText = '';

      port.postMessage({ 
        type: 'CHAT_STREAM_PROMPT', 
        prompt: query, 
        history: [...messages, { role: 'user', content: query }] 
      });

      port.onMessage.addListener((msg: any) => {
        if (msg.type === 'CHUNK') {
          receivedText += msg.text;
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: receivedText };
            }
            return copy;
          });
        } else if (msg.type === 'DONE') {
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: msg.fullText };
            }
            return copy;
          });
          setIsTyping(false);
          port.disconnect();
        } else if (msg.type === 'COMMANDS_PENDING') {
          setPendingCommands(msg.commands);
        } else if (msg.type === 'ERROR') {
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: `Error: ${msg.error}` };
            }
            return copy;
          });
          setIsTyping(false);
          port.disconnect();
        }
      });
    } catch (err: any) {
      console.error(err);
      setMessages(prev => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err.message || err}` };
        }
        return copy;
      });
      setIsTyping(false);
    }
  };

  const handleClear = () => {
    setShowConfirm(true);
  };

  const suggestions = [
    { text: "Summarize my active tabs", desc: "Get a quick overview of your current workspace context" },
    { text: "Find the latest news on AI", desc: "Searches the web for recent updates" },
    { text: "Play some focus music on YouTube", desc: "Opens YouTube with a curated playlist" }
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col pb-4">
      {/* Top Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mb-1.5">Workspace Chat</h2>
          <p className="text-white/40 font-light text-sm">Converse with your currently open tabs and trigger actions.</p>
        </div>
        {messages.length > 0 && (
          <button 
            onClick={handleClear}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-medium text-red-300 transition-all flex items-center gap-2 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Main Chat Box */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0c0a1a]/40 border border-white/[0.04] rounded-3xl p-6 shadow-inner backdrop-blur-md relative group">
        {/* Floating Scroll Arrows */}
        {messages.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
              onClick={() => containerRef.current?.scrollBy({ top: -150, behavior: 'smooth' })}
              className="p-2 bg-[#0d0a1a]/90 hover:bg-[#1a1533]/90 hover:text-accent-blue border border-white/10 rounded-xl text-white/50 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md cursor-pointer"
              title="Scroll Up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button 
              onClick={() => containerRef.current?.scrollBy({ top: 150, behavior: 'smooth' })}
              className="p-2 bg-[#0d0a1a]/90 hover:bg-[#1a1533]/90 hover:text-accent-blue border border-white/10 rounded-xl text-white/50 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md cursor-pointer"
              title="Scroll Down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={containerRef} className="flex-1 overflow-y-auto mb-5 pl-2 pr-14 space-y-6 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center max-w-lg mx-auto py-12">
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-400 animate-pulse">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ask your Workspace Assistant</h3>
              <p className="text-center text-white/40 text-sm font-light leading-relaxed mb-8">
                I can help you navigate, search the web, analyze your tabs, or manage your workspace. Try one of these prompts to get started:
              </p>
              
              <div className="w-full space-y-3">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAsk(s.text)}
                    className="w-full text-left p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-blue-500/30 rounded-2xl transition-all group flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{s.text}</div>
                      <div className="text-xs text-white/30 font-light mt-0.5">{s.desc}</div>
                    </div>
                    <Send className="w-4 h-4 text-white/20 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 text-white">
                      <Bot className="h-5 w-5 text-blue-400" />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 leading-relaxed text-sm ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/30 text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/90 shadow-sm'
                  }`}>
                    {m.role === 'assistant' && m.content === '' ? (
                      <div className="flex items-center gap-1.5 py-1.5">
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    ) : m.role === 'assistant' ? (
                      <MarkdownPreview content={m.content} />
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70">
                      <User className="h-5 w-5 text-accent-blue" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="relative flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <input 
              type="text" 
              className="os-input w-full pr-14 pl-5 bg-[#07050f] border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all rounded-2xl h-12 text-sm placeholder:text-white/20" 
              placeholder="Ask a question or request an action (e.g. 'open youtube and play a song')..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
            />
            <button 
              className="absolute right-2 top-1.5 p-2 bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/20 hover:opacity-90 active:scale-95 transition-all text-white rounded-xl disabled:opacity-50 disabled:scale-100"
              onClick={() => handleAsk()}
              disabled={isTyping || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modern Confirm Modal */}
      {createPortal(
        <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 bg-black/60"
            />
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Clear Chat History</h3>
                <p className="text-white/40 text-sm font-light leading-relaxed mb-8">
                  Are you sure you want to clear all your messages? This action cannot be undone.
                </p>
                <div className="flex w-full gap-3">
                  <button 
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setMessages([]);
                      setShowConfirm(false);
                    }}
                    className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-sm font-medium text-red-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* Pending Commands Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
        {pendingCommands.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80 max-h-[80vh] flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Command className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Confirm Actions</h3>
                  <p className="text-sm text-blue-400/80 mt-1">The assistant wants to execute the following commands:</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6 scrollbar-hide">
                {pendingCommands.map((cmd, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-xs font-mono text-blue-300 mb-2">{cmd.type}</div>
                    <div className="space-y-1">
                      {Object.entries(cmd.args).map(([k, v]) => (
                        <div key={k} className="text-sm flex items-start gap-2">
                          <span className="text-white/40 shrink-0">{k}:</span>
                          <span className="text-white font-medium break-all">{v as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setPendingCommands([])} className="flex-1 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors">Reject</button>
                <button onClick={() => {
                  chrome.runtime.sendMessage({ type: 'EXECUTE_CONFIRMED_COMMANDS', commands: pendingCommands });
                  setPendingCommands([]);
                }} className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex justify-center items-center">
                  Approve & Execute
                </button>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}



function SettingsView({ showToast }: { showToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void }) {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  // Load configuration on mount
  useEffect(() => {
    import('@/storage/db').then(async ({ getSetting }) => {
      const p = await getSetting('aiProvider', 'gemini');
      const key = await getSetting(`apiKey_${p}`, '');
      const mod = await getSetting(`model_${p}`, '');
      setProvider(p);
      setApiKey(key);
      setModel(mod);
    });
  }, []);

  // When user switches provider manually in UI
  const handleProviderChange = async (newProvider: string) => {
    const { setSetting, getSetting } = await import('@/storage/db');
    // Save current provider's inputs to DB first to avoid data loss when switching
    await setSetting(`apiKey_${provider}`, apiKey);
    await setSetting(`model_${provider}`, model);

    setProvider(newProvider);
    const key = await getSetting(`apiKey_${newProvider}`, '');
    const mod = await getSetting(`model_${newProvider}`, '');
    setApiKey(key);
    setModel(mod);
  };

  const handleSave = async () => {
    const { setSetting } = await import('@/storage/db');
    await setSetting('aiProvider', provider);
    await setSetting(`apiKey_${provider}`, apiKey);
    await setSetting(`model_${provider}`, model);
    showToast('Configuration Saved', 'Successfully saved API keys and settings.', 'success');
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">Preferences</h2>
        <p className="text-white/40 font-light">Configure your AI providers and local settings.</p>
      </div>
      
      <div className="border border-white/[0.05] bg-white/[0.01] rounded-3xl p-8 space-y-8">
        <div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-medium mb-3">AI Provider</h3>
          <p className="text-sm text-white/40 font-light mb-4">
            Select the LLM provider for summarization and chat. Everything else runs locally.
          </p>
          <div className="relative w-full md:w-1/2">
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); setOpenActionMenu(openActionMenu === 'provider_select' ? null : 'provider_select'); }}
              className="w-full flex items-center justify-between bg-[#131313] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none hover:border-white/20 transition-all text-left font-medium"
            >
              <span>
                {provider === 'gemini' && 'Google Gemini'}
                {provider === 'openrouter' && 'OpenRouter'}
                {provider === 'chatgpt' && 'OpenAI ChatGPT'}
              </span>
              <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openActionMenu === 'provider_select' ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {openActionMenu === 'provider_select' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenActionMenu(null); }} />
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-[calc(100%+6px)] left-0 w-full bg-[#161616] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 py-1"
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleProviderChange('gemini'); setOpenActionMenu(null); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${provider === 'gemini' ? 'text-accent-blue bg-white/[0.02] font-medium' : 'text-white/70'}`}
                    >
                      <span>Google Gemini</span>
                      {provider === 'gemini' && <Check className="w-4 h-4 text-accent-blue" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleProviderChange('openrouter'); setOpenActionMenu(null); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${provider === 'openrouter' ? 'text-accent-blue bg-white/[0.02] font-medium' : 'text-white/70'}`}
                    >
                      <span>OpenRouter</span>
                      {provider === 'openrouter' && <Check className="w-4 h-4 text-accent-blue" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleProviderChange('chatgpt'); setOpenActionMenu(null); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${provider === 'chatgpt' ? 'text-accent-blue bg-white/[0.02] font-medium' : 'text-white/70'}`}
                    >
                      <span>OpenAI ChatGPT</span>
                      {provider === 'chatgpt' && <Check className="w-4 h-4 text-accent-blue" />}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-medium mb-3">API Key</h3>
          <div className="relative flex items-center">
            <input 
              type={showApiKey ? "text" : "password"} 
              className="os-input bg-[#0a0a0a] pr-10" 
              placeholder="Enter API Key (stored entirely locally)" 
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 text-white/40 hover:text-white transition-colors"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-medium mb-3">Custom Model Name</h3>
          <p className="text-sm text-white/40 font-light mb-4">
            Leave blank to use defaults (gemini-2.5-flash, gpt-4o-mini).
          </p>
          <input 
            type="text" 
            className="os-input bg-[#0a0a0a]" 
            placeholder="e.g. gemini-2.5-pro, anthropic/claude-3-sonnet" 
            value={model}
            onChange={e => setModel(e.target.value)}
          />
        </div>

        <div className="pt-4">
          <button className="os-btn-primary px-8 py-3 rounded-xl" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function FoldersView({ showToast }: { showToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void }) {
  const [folders, setFolders] = useState<WorkspaceSession[]>([]);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const [folderPage, setFolderPage] = useState(1);
  const [foldersPerPage, setFoldersPerPage] = useState(5);
  const [showDpasteWarning, setShowDpasteWarning] = useState(false);

  useEffect(() => {
    import('@/storage/db').then(db => {
      db.getSetting('tabflow_folders_per_page', 5).then(setFoldersPerPage);
    });
  }, []);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const [tabLimit, setTabLimit] = useState(30);

  useEffect(() => {
    setTabSearchQuery('');
    setTabLimit(30);
  }, [expandedFolder]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showAddTabModal, setShowAddTabModal] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');

  const [showTimerModal, setShowTimerModal] = useState<{sessionId: string, type: 'folder'|'tab', url?: string} | null>(null);
  const [timerAction, setTimerAction] = useState<'open'|'close'>('close');
  const [openTimerDates, setOpenTimerDates] = useState<Date[]>([]);
  const [closeTimerDates, setCloseTimerDates] = useState<Date[]>([]);
  const [showEditTabModal, setShowEditTabModal] = useState<{sessionId: string, oldUrl: string, title: string, url: string} | null>(null);
  const [editingFolder, setEditingFolder] = useState<{id: string, name: string} | null>(null);

  const [showShareModal, setShowShareModal] = useState<{folderId: string, folderName: string, tabs: any[]} | null>(null);
  const [shareMarkdown, setShareMarkdown] = useState('');
  const [shareViewMode, setShareViewMode] = useState<'preview' | 'edit'>('preview');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState(7);
  const [selectedShareTabs, setSelectedShareTabs] = useState<Set<string>>(new Set());

  const [showDeleteModal, setShowDeleteModal] = useState<{sessionId: string, url?: string} | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFolders, setSelectedExportFolders] = useState<Set<string>>(new Set());
  const [selectedExportTabs, setSelectedExportTabs] = useState<Set<string>>(new Set());
  const [expandedExportFolders, setExpandedExportFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLockSettingsModal, setShowLockSettingsModal] = useState<any>(null);
  const [showUnlockModal, setShowUnlockModal] = useState<any>(null);
  const [lockPassword, setLockPassword] = useState('');
  const [lockRecoveryWord, setLockRecoveryWord] = useState('');
  const [autoLock, setAutoLock] = useState(false);
  
  const [unlockPassword, setUnlockPassword] = useState('');
  const [recoveryWordInput, setRecoveryWordInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState<'verify_word' | 'new_password' | null>(null);
  const [unlockError, setUnlockError] = useState('');

  const [showLockPassword, setShowLockPassword] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [showRecoveryNewPassword, setShowRecoveryNewPassword] = useState(false);

  const handleScrollToTop = () => {
    const el = document.getElementById('main-scroll-container');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleScrollToBottom = () => {
    const el = document.getElementById('main-scroll-container');
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const handleUnlockSubmit = async () => {
    if (isRecoveryMode === 'verify_word') {
      const enteredWord = recoveryWordInput.trim().toLowerCase();
      const enteredHash = await sha256(showUnlockModal.id + enteredWord);
      chrome.runtime.sendMessage({
        type: 'VERIFY_RECOVERY_WORD',
        sessionId: showUnlockModal.id,
        recoveryWordHash: enteredHash
      }, (isCorrect) => {
        if (isCorrect) {
          setIsRecoveryMode('new_password');
          setUnlockError('');
          showToast('Recovery Verified', 'Word matches. Please set your new password.', 'success');
        } else {
          setUnlockError('Incorrect recovery word.');
        }
      });
    } else if (isRecoveryMode === 'new_password') {
      const hashedNewPassword = await sha256(showUnlockModal.id + recoveryNewPassword);
      chrome.runtime.sendMessage({ 
        type: 'UPDATE_FOLDER_LOCK', 
        sessionId: showUnlockModal.id, 
        password: hashedNewPassword, 
        autoLockEnabled: showUnlockModal.autoLockEnabled 
      }, () => {
        chrome.runtime.sendMessage({ 
          type: 'UNLOCK_FOLDER', 
          sessionId: showUnlockModal.id, 
          passwordHash: hashedNewPassword 
        }, (res) => {
          if (res && res.error) {
            setUnlockError(res.error);
          } else {
            loadFolders();
            setShowUnlockModal(null);
            setIsRecoveryMode(null);
            showToast('Password Reset', 'Your new folder password has been configured and the folder is unlocked.', 'success');
          }
        });
      });
    } else {
      const enteredHash = await sha256(showUnlockModal.id + unlockPassword);
      chrome.runtime.sendMessage({ 
        type: 'UNLOCK_FOLDER', 
        sessionId: showUnlockModal.id, 
        passwordHash: enteredHash 
      }, (res) => {
        if (res && res.error) {
          setUnlockError(res.error);
        } else {
          loadFolders();
          setShowUnlockModal(null);
          showToast('Folder Unlocked', `Successfully unlocked "${showUnlockModal.name}".`, 'success');
        }
      });
    }
  };

  const hasAutoLocked = useRef(false);

  const loadFolders = () => {
    chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (sessions) => {
      if (sessions && Array.isArray(sessions)) {
        // Show all folders — both manual and auto-saved (C: show auto-saved sessions)
        if (!hasAutoLocked.current) {
          sessions.forEach(f => {
            if (f.autoLockEnabled && !f.isLocked) {
               chrome.runtime.sendMessage({ type: 'LOCK_FOLDER', sessionId: f.id });
               f.isLocked = true;
            }
          });
          hasAutoLocked.current = true;
        }

        setFolders([...sessions]);
      }
    });
  };

  // Lifted toastMessage state to global App component

  useEffect(() => {
    loadFolders();
    const handleMessage = (msg: any) => {
      if (msg.type === 'REFRESH_FOLDERS') loadFolders();
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    const interval = setInterval(() => setFolders(f => [...f]), 60000);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      clearInterval(interval);
    };
  }, []);



  const submitCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    chrome.runtime.sendMessage({ 
      type: 'CREATE_FOLDER', 
      name, 
      tabs: [] 
    }, () => {
      loadFolders();
      setShowCreateModal(false);
      setNewFolderName('');
      showToast('Folder Created', `Successfully created folder "${name}".`, 'success');
    });
  };

  const submitAddTabManually = () => {
    if (!showAddTabModal || !newTabUrl.trim()) return;
    const url = newTabUrl.startsWith('http') ? newTabUrl : `https://${newTabUrl}`;
    chrome.runtime.sendMessage({
      type: 'ADD_TAB_TO_FOLDER',
      sessionId: showAddTabModal,
      tab: { title: newTabName.trim() || url, url }
    }, (response) => {
      loadFolders();
      setShowAddTabModal(null);
      setNewTabName('');
      setNewTabUrl('');
      if (response && response.added === false) {
        showToast('Tab Already Exists', 'This tab is already in the folder.', 'error');
      } else {
        showToast('Tab Added', 'Successfully added tab to folder.', 'success');
      }
    });
  };

  const submitEditTab = () => {
    if (!showEditTabModal) return;
    const { sessionId, oldUrl, title, url } = showEditTabModal;
    if (!title.trim() || !url.trim()) {
      setShowEditTabModal(null);
      return;
    }
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    chrome.runtime.sendMessage({
      type: 'EDIT_TAB_IN_FOLDER',
      sessionId,
      url: oldUrl,
      newTitle: title.trim(),
      newUrl: finalUrl
    }, () => {
      loadFolders();
      setShowEditTabModal(null);
      showToast('Tab Updated', 'Successfully saved tab edits.', 'success');
    });
  };

  const openShareModal = (folder: any) => {
    setShowShareModal({ folderId: folder.id, folderName: folder.name, tabs: folder.tabs });
    setShareMarkdown('');
    setShareViewMode(folder.shareLink ? 'edit' : 'preview');
    setIsGeneratingShare(false);
    setShareCopied(false);
    setShareLink(folder.shareLink || '');
    setLinkExpiry(7);
    setSelectedShareTabs(new Set(folder.tabs.map((t: any) => t.url)));
  };

  const generateShareableWorkspace = async () => {
    if (!showShareModal) return;
    setIsGeneratingShare(true);
    setShareCopied(false);
    setShareLink('');

    try {
      const selectedTabs = showShareModal.tabs.filter(t => selectedShareTabs.has(t.url));
      if (selectedTabs.length === 0) throw new Error("No tabs selected to share.");
      
      const tabsList = selectedTabs.map((t: any, i: number) => `${i + 1}. ${t.title} - ${t.url}`).join('\n');
      const prompt = `You are a helpful assistant. I have a workspace folder named '${showShareModal.folderName}' containing the following tabs:\n\n${tabsList}\n\nPlease generate a beautifully formatted Markdown document that summarizes this workspace. Provide a very brief, 1-2 sentence guess of what each tab is about based on its title and URL, and format the output beautifully so I can share it with my colleagues.`;
      
      const markdown = await import('../ai/llm').then(m => m.callLLM(prompt));
      setShareViewMode('preview');
      setShareMarkdown(markdown);
    } catch (e: any) {
      setShareViewMode('preview');
      setShareMarkdown(`Error generating summary: ${e.message}\n\nPlease check your AI provider settings in the Settings tab.`);
    } finally {
      setIsGeneratingShare(false);
    }
  };


  const generatePublicLink = async () => {
    if (!showDpasteWarning) {
      setShowDpasteWarning(true);
      return;
    }
    setIsGeneratingLink(true);
    try {
      const formData = new URLSearchParams();
      formData.append('content', shareMarkdown);
      formData.append('syntax', 'md');
      formData.append('title', `Tabflow Workspace: ${showShareModal?.folderName || 'Shared'}`);
      let expiresValue = '2592000'; // Default 30 days
      if (linkExpiry === 1) expiresValue = '86400';
      else if (linkExpiry === 7) expiresValue = '604800';
      else if (linkExpiry === 30) expiresValue = '2592000';
      else if (linkExpiry === 365) expiresValue = 'never';

      formData.append('expires', expiresValue);
      
      const res = await fetch('https://dpaste.com/api/v2/', {
        method: 'POST',
        body: formData
      });
      const link = await res.text();
      const finalLink = link.trim();
      setShareLink(finalLink);
      navigator.clipboard.writeText(finalLink);
      setShareCopied(true);
      
      if (showShareModal) {
        chrome.runtime.sendMessage({
          type: 'UPDATE_FOLDER_SHARE_LINK',
          sessionId: showShareModal.folderId,
          shareLink: finalLink
        }, () => {
          loadFolders();
        });
      }
      
      showToast('Link Generated', 'The public link has been generated and copied to your clipboard!', 'success');
      setTimeout(() => setShareCopied(false), 3000);
    } catch (e) {
      showToast('Link Failed', 'Could not generate a public link. Check your network connection.', 'error');
    } finally {
      setIsGeneratingLink(false);
      setShowDpasteWarning(false);
    }
  };

  const submitRenameFolder = () => {
    if (!editingFolder) return;
    const newName = editingFolder.name.trim();
    if (!newName) {
      setEditingFolder(null);
      return;
    }
    chrome.runtime.sendMessage({
      type: 'RENAME_FOLDER',
      sessionId: editingFolder.id,
      newName
    }, () => {
      loadFolders();
      setEditingFolder(null);
      showToast('Folder Renamed', `Folder renamed to "${newName}".`, 'success');
    });
  };

  const submitScanTabs = () => {
    if (!showAddTabModal) return;
    chrome.runtime.sendMessage({
      type: 'SCAN_TABS_TO_FOLDER',
      sessionId: showAddTabModal
    }, (response) => {
      loadFolders();
      setShowAddTabModal(null);
      if (response && response.error) {
        showToast('Error', response.error, 'error');
      } else if (response && response.validCount === 0) {
        showToast('No Tabs Open', 'No tabs open. Open some tabs to add them!', 'error');
      } else if (response && response.addedCount === 0) {
        showToast('No New Tabs Added', 'All open tabs already exist in this folder.', 'error');
      } else if (response) {
        showToast(`${response.addedCount} Tabs Added`, 'Successfully saved new open tabs.', 'success');
      }
    });
  };

  const openTimer = (folder: any, tabUrl?: string) => {
    const target = tabUrl ? folder.tabs.find((t: any) => t.url === tabUrl) : folder;
    setOpenTimerDates(target?.scheduledOpenTimes ? target.scheduledOpenTimes.map((t: number) => new Date(t)) : []);
    setCloseTimerDates(target?.scheduledCloseTimes ? target.scheduledCloseTimes.map((t: number) => new Date(t)) : []);
    setShowTimerModal({ sessionId: folder.id, type: tabUrl ? 'tab' : 'folder', url: tabUrl });
  };

  const submitTimer = (remove = false) => {
    if (!showTimerModal) return;
    
    let openTimes: number[] = [];
    let closeTimes: number[] = [];

    if (!remove) {
      openTimes = openTimerDates.map(d => d.getTime());
      closeTimes = closeTimerDates.map(d => d.getTime());
      
      if (openTimes.some(t => t <= Date.now()) || closeTimes.some(t => t <= Date.now())) {
        showToast('Invalid Time', 'Please select future dates and times.', 'error');
        return;
      }
    }

    if (showTimerModal.type === 'folder') {
      chrome.runtime.sendMessage({
        type: 'SET_FOLDER_TIMER',
        sessionId: showTimerModal.sessionId,
        action: 'open',
        times: openTimes
      }, () => {
        chrome.runtime.sendMessage({
          type: 'SET_FOLDER_TIMER',
          sessionId: showTimerModal.sessionId,
          action: 'close',
          times: closeTimes
        }, () => {
          loadFolders();
          setShowTimerModal(null);
          setOpenTimerDates([]);
          setCloseTimerDates([]);
          if (remove) {
            showToast('Schedule Removed', 'Folder auto-open/close schedules have been cleared.', 'info');
          } else {
            showToast('Schedule Saved', 'Successfully saved schedules for this folder.', 'success');
          }
        });
      });
    } else if (showTimerModal.type === 'tab' && showTimerModal.url) {
      chrome.runtime.sendMessage({
        type: 'SET_TAB_TIMER',
        sessionId: showTimerModal.sessionId,
        url: showTimerModal.url,
        action: 'open',
        times: openTimes
      }, () => {
        chrome.runtime.sendMessage({
          type: 'SET_TAB_TIMER',
          sessionId: showTimerModal.sessionId,
          url: showTimerModal.url,
          action: 'close',
          times: closeTimes
        }, () => {
          loadFolders();
          setShowTimerModal(null);
          setOpenTimerDates([]);
          setCloseTimerDates([]);
          if (remove) {
            showToast('Schedule Removed', 'Tab auto-open/close schedules have been cleared.', 'info');
          } else {
            showToast('Schedule Saved', 'Successfully saved schedules for this tab.', 'success');
          }
        });
      });
    }
  };

  const confirmDelete = () => {
    if (!showDeleteModal) return;
    if (showDeleteModal.url) {
      chrome.runtime.sendMessage({ type: 'REMOVE_TAB_FROM_FOLDER', sessionId: showDeleteModal.sessionId, url: showDeleteModal.url }, (response) => {
        if (response?.error) {
          showToast('Error', response.error, 'error');
          return;
        }
        loadFolders();
        setShowDeleteModal(null);
        showToast('Tab Removed', 'Successfully removed tab from folder.', 'info');
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', sessionId: showDeleteModal.sessionId }, (response) => {
        if (response?.error) {
          showToast('Error', response.error, 'error');
          return;
        }
        loadFolders();
        setShowDeleteModal(null);
        showToast('Folder Deleted', 'Successfully deleted the folder.', 'info');
      });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    let hasError = false;
    await Promise.all(ids.map(id => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', sessionId: id }, (response) => {
          if (response?.error) {
            hasError = true;
            showToast('Error', response.error, 'error');
          }
          resolve();
        });
      });
    }));
    loadFolders();
    if (!hasError) {
      showToast(
        'Folders Deleted',
        `Successfully deleted ${ids.length} folder${ids.length > 1 ? 's' : ''}.`,
        'info'
      );
    }
    setSelectedFolderIds(new Set());
    setIsSelectMode(false);
  };


  const openFolderTabs = async (folder: any, target: 'current' | 'new' | 'incognito' = 'current') => {
    if (folder.isLocked) {
      showToast('Folder Locked', 'This folder is locked. Please unlock it first.', 'error');
      return;
    }
    
    if (target === 'incognito') {
      const allowed = await chrome.extension.isAllowedIncognitoAccess();
      if (!allowed) {
        showToast('Incognito Access Required', 'Please enable "Allow in Incognito" in your Chrome extension settings to allow Tabflow to manage incognito tabs.', 'error');
      }
    }
    
    chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_TABS', sessionId: folder.id, target }, (response) => {
      if (response && response.success) {
        if (response.openedCount > 0) {
          showToast('Tabs Opened', `Opened ${response.openedCount} tabs.`, 'success');
        } else {
          showToast('No New Tabs', 'All tabs in this folder are already open in this window.', 'info');
        }
      } else {
        showToast('Error', 'Failed to open tabs.', 'error');
      }
    });
  };

  const lockFolder = (folderId: string) => {
    chrome.runtime.sendMessage({ type: 'LOCK_FOLDER', sessionId: folderId }, () => {
      loadFolders();
      const f = folders.find(folder => folder.id === folderId);
      showToast('Folder Locked', `Successfully locked "${f?.name || 'Folder'}".`, 'info');
    });
  };

  const closeFolderTabs = (folder: any) => {
    if (folder.isLocked) {
      showToast('Folder Locked', 'This folder is locked. Please unlock it first.', 'error');
      return;
    }
    chrome.runtime.sendMessage({ type: 'CLOSE_FOLDER_TABS', sessionId: folder.id }, (response) => {
      if (response && response.success) {
        if (response.allowedIncognito === false) {
          showToast('Tabs Closed', `Closed normal tabs. Enable "Allow in Incognito" in extension settings to allow closing incognito tabs.`, 'info');
        } else {
          showToast('Tabs Closed', `Closed all open tabs from "${folder.name}".`, 'info');
        }
      } else {
        showToast('Error', 'Failed to close tabs.', 'error');
      }
    });
  };

  const openTab = async (url: string, mode: 'current' | 'new' | 'incognito' = 'current') => {
    url = sanitizeUrl(url);
    if (!isValidUrl(url)) {
      showToast('Invalid URL', 'This URL is not allowed for security reasons.', 'error');
      return;
    }
    const openTabs = await chrome.tabs.query({});
    const existingTab = openTabs.find(t => t.url === url);
    
    if (existingTab && existingTab.id && existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
      await chrome.tabs.update(existingTab.id, { active: true });
      showToast('Tab Focused', 'Focused the existing open tab.', 'info');
      return;
    }

    if (mode === 'current') {
      chrome.tabs.create({ url, active: false });
      showToast('Tab Opened', 'Opened tab in current window.', 'success');
    } else if (mode === 'new') {
      chrome.windows.create({ url, focused: true });
      showToast('Window Created', 'Opened tab in a new window.', 'success');
    } else if (mode === 'incognito') {
      chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        if (!isAllowed) {
          showToast('Permission Required', 'Please enable "Allow in Incognito" in extension details.', 'error');
        } else {
          chrome.windows.create({ url, incognito: true, focused: true });
          showToast('Incognito Window Created', 'Opened tab in an incognito window.', 'success');
        }
      });
    }
  };

  const closeTab = (url: string) => {
    chrome.tabs.query({}, (openTabs) => {
      const tabToClose = openTabs.find(t => t.url === url);
      if (tabToClose?.id) {
        chrome.tabs.remove(tabToClose.id, () => {
          showToast('Tab Closed', 'Successfully closed the tab.', 'info');
        });
      } else {
        showToast('Tab Not Open', 'Tab is not currently open in any window.', 'info');
      }
    });
  };

  const togglePinFolder = (sessionId: string) => {
    const folder = folders.find(f => f.id === sessionId);
    const wasPinned = folder?.isPinned;
    chrome.runtime.sendMessage({ type: 'TOGGLE_PIN_FOLDER', sessionId }, () => {
      loadFolders();
      if (folder) {
        showToast(
          wasPinned ? 'Folder Unpinned' : 'Folder Pinned',
          `Successfully ${wasPinned ? 'unpinned' : 'pinned'} folder "${folder.name}".`,
          'success'
        );
      }
    });
  };

  const handleExport = () => {
    const exportData = folders
      .filter(f => selectedExportFolders.has(f.id) || (f.tabs && f.tabs.some((t: any) => selectedExportTabs.has(`${f.id}_${t.url}`))))
      .map(f => {
        const exportedFolder = { ...f };
        exportedFolder.tabs = (f.tabs || []).filter((t: any) => selectedExportTabs.has(`${f.id}_${t.url}`));
        delete exportedFolder.scheduledOpenTimes;
        delete exportedFolder.scheduledCloseTimes;
        exportedFolder.tabs = exportedFolder.tabs.map((t: any) => {
          const newTab = { ...t };
          delete newTab.scheduledOpenTimes;
          delete newTab.scheduledCloseTimes;
          return newTab;
        });
        return exportedFolder;
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabflow-folders-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
    showToast('Folders Exported', 'Successfully downloaded selected folders as a JSON file.', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) throw new Error('Invalid export file');
        
        const db = await import('@/storage/db');
        for (const folder of json) {
          if (!folder.name || !folder.tabs) continue;
          folder.id = crypto.randomUUID();
          delete folder.scheduledOpenTimes;
          delete folder.scheduledCloseTimes;
          folder.tabs = folder.tabs.map((t: any) => {
            delete t.scheduledOpenTimes;
            delete t.scheduledCloseTimes;
            return t;
          });
          await db.saveSession(folder);
        }
        loadFolders();
        showToast('Import Successful', `Successfully imported ${json.length} folders into your workspace.`, 'success');
      } catch (err) {
        console.error("Import failed", err);
        showToast('Import Failed', 'The file might be corrupted or in an invalid format.', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const toggleStarTab = (sessionId: string, url: string) => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_STAR_TAB', sessionId, url }, () => {
      loadFolders();
    });
  };

  const filteredFolders = folders
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const result = a.name.localeCompare(b.name);
      return sortDesc ? -result : result;
    });
  const pinnedFolders = filteredFolders.filter(f => f.isPinned);
  const unpinnedFolders = filteredFolders.filter(f => !f.isPinned);

  const totalPages = Math.ceil(unpinnedFolders.length / foldersPerPage);
  const activePage = Math.max(1, Math.min(folderPage, totalPages || 1));
  const paginatedUnpinnedFolders = unpinnedFolders.slice((activePage - 1) * foldersPerPage, activePage * foldersPerPage);

  const renderFolderList = (list: any[]) => {
    if (list.length === 0) return null;
    return list.map(folder => {
      // Filter tabs in folder based on local tab search query
      const matchingTabs = [...(folder.tabs || [])].filter((tab: any) => {
        if (!tabSearchQuery) return true;
        const q = tabSearchQuery.toLowerCase();
        return (tab.title || '').toLowerCase().includes(q) || (tab.url || '').toLowerCase().includes(q);
      });

      // Sort matching tabs (starred first)
      const sortedTabs = matchingTabs.sort((a: any, b: any) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return 0;
      });

      // Paginate/limit results to keep DOM responsive
      const visibleTabs = sortedTabs.slice(0, tabLimit);

      return (
        <div key={folder.id} className="border border-white/[0.08] bg-white/[0.02] rounded-2xl p-5 hover:border-white/[0.12] transition-all mb-4">
          <div 
            className="flex items-center justify-between cursor-pointer" 
            onClick={() => { 
              if (isSelectMode) {
                const newSelected = new Set(selectedFolderIds);
                if (newSelected.has(folder.id)) {
                  newSelected.delete(folder.id);
                } else {
                  newSelected.add(folder.id);
                }
                setSelectedFolderIds(newSelected);
              } else if (!folder.isLocked) {
                setExpandedFolder(expandedFolder === folder.id ? null : folder.id); 
              }
            }}
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-3">
                {isSelectMode && (
                  <div 
                    className="mr-1 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSelected = new Set(selectedFolderIds);
                      if (newSelected.has(folder.id)) {
                        newSelected.delete(folder.id);
                      } else {
                        newSelected.add(folder.id);
                      }
                      setSelectedFolderIds(newSelected);
                    }}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedFolderIds.has(folder.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20 bg-black/20'}`}>
                      {selectedFolderIds.has(folder.id) && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                )}
                <Folder className="w-5 h-5 text-accent-blue shrink-0" />
                {editingFolder?.id === folder.id ? (
                  <input
                    autoFocus
                    className="bg-transparent border-b border-accent-purple font-medium text-white outline-none"
                    value={editingFolder?.name || ''}
                    onChange={(e) => editingFolder && setEditingFolder({ ...editingFolder, name: e.target.value })}
                    onBlur={submitRenameFolder}
                    onKeyDown={(e) => e.key === 'Enter' && submitRenameFolder()}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="font-medium text-white truncate min-w-0 text-sm md:text-base">{folder.name}</span>
                )}
                <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">{folder.tabs?.length} tabs</span>
              </div>
              
              {((folder.scheduledOpenTimes && folder.scheduledOpenTimes.length > 0) || (folder.scheduledCloseTimes && folder.scheduledCloseTimes.length > 0)) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {folder.scheduledOpenTimes && folder.scheduledOpenTimes.length > 0 && (
                    <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5 animate-[spin_4s_linear_infinite]" />
                      Opens {folder.scheduledOpenTimes.length > 1 ? `on ${folder.scheduledOpenTimes.length} dates` : `${new Date(folder.scheduledOpenTimes[0]).toLocaleDateString()} ${new Date(folder.scheduledOpenTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                    </span>
                  )}
                  {folder.scheduledCloseTimes && folder.scheduledCloseTimes.length > 0 && (
                    <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5 animate-[spin_4s_linear_infinite]" />
                      Closes {folder.scheduledCloseTimes.length > 1 ? `on ${folder.scheduledCloseTimes.length} dates` : `${new Date(folder.scheduledCloseTimes[0]).toLocaleDateString()} ${new Date(folder.scheduledCloseTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {!isSelectMode && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Tooltip content={folder.isPinned ? "Unpin Folder" : "Pin Folder"}><button onClick={(e) => { e.stopPropagation(); togglePinFolder(folder.id); }} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${folder.isPinned ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}>
                  <Pin className={`w-4 h-4 ${folder.isPinned ? 'fill-current' : ''}`} />
                </button></Tooltip>
                
                {folder.isLocked ? (
                  <>
                    <Tooltip content="Unlock Folder"><button onClick={(e) => { e.stopPropagation(); setShowUnlockModal(folder); setUnlockPassword(''); setRecoveryWordInput(''); setUnlockError(''); setIsRecoveryMode(null); setShowUnlockPassword(false); setShowRecoveryNewPassword(false); }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                      <Lock className="w-4 h-4 text-red-400" />
                    </button></Tooltip>
                    <Tooltip content="Delete Folder"><button onClick={(e) => { e.stopPropagation(); setShowDeleteModal({sessionId: folder.id}); }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-orange-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button></Tooltip>
                  </>
                ) : (
                  <>
                    {folder.password && (
                      <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Lock Folder Now" : "No tabs to lock"}><button 
                        disabled={!folder.tabs || folder.tabs.length === 0}
                        onClick={(e) => { e.stopPropagation(); lockFolder(folder.id); }} 
                        className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-green-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Unlock className="w-4 h-4 text-green-400" />
                      </button></Tooltip>
                    )}
                    <Tooltip content={!folder.tabs || folder.tabs.length === 0 ? "No tabs to lock" : folder.password ? "Change Password" : "Setup Password"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0}
                      onClick={(e) => { e.stopPropagation(); setShowLockSettingsModal(folder); setLockPassword(''); setLockRecoveryWord(''); setAutoLock(folder.autoLockEnabled || false); setShowLockPassword(false); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Key className="w-4 h-4" /> 
                    </button></Tooltip>

                    <Tooltip content="Rename Folder"><button onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Share Workspace" : "No tabs to share"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openShareModal(folder); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Share2 className="w-4 h-4" />
                    </button></Tooltip>
                    
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Open All Tabs" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'current'); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-green-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "New Window" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'new'); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <AppWindow className="w-4 h-4" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Incognito" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'incognito'); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-purple-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Ghost className="w-4 h-4" />
                    </button></Tooltip>

                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Close All Tabs" : "No tabs to close"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0}
                      onClick={(e) => { e.stopPropagation(); closeFolderTabs(folder); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-orange-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <XSquare className="w-4 h-4" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Schedule Folder" : "No tabs to schedule"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0}
                      onClick={(e) => { e.stopPropagation(); openTimer(folder); }} 
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-accent-purple disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4" />
                    </button></Tooltip>
                    <Tooltip content="Delete Folder"><button onClick={(e) => { e.stopPropagation(); setShowDeleteModal({sessionId: folder.id}); }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-orange-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button></Tooltip>
                  </>
                )}
              </div>
            )}
            {!isSelectMode && (
              <div className="pl-1 text-white/50 shrink-0">
                {expandedFolder === folder.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            )}
          </div>
          
          <AnimatePresence>
            {expandedFolder === folder.id && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-white/[0.05] space-y-4">
                  {/* Local Tab Search Bar */}
                  {folder.tabs && folder.tabs.length > 5 && (
                    <div className="relative flex items-center">
                      <Search className="absolute left-3.5 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder={`Search in ${folder.tabs.length} tabs...`}
                        value={tabSearchQuery}
                        onChange={(e) => setTabSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-full pl-10 pr-12 py-2 text-xs text-white outline-none focus:border-accent-purple/50 focus:bg-white/5 transition-all"
                      />
                      {tabSearchQuery && (
                        <button 
                          onClick={() => setTabSearchQuery('')}
                          className="absolute right-3.5 text-[10px] text-white/40 hover:text-white transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scrollable List of visible tabs */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 pb-12 select-none">
                    {visibleTabs.map((tab: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] group">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <button onClick={(e) => { e.stopPropagation(); toggleStarTab(folder.id, tab.url); }} className={`p-1.5 shrink-0 rounded-lg transition-colors ${tab.isStarred ? 'text-yellow-400' : 'text-white/20 hover:text-white/60 hover:bg-white/5'}`} title={tab.isStarred ? "Unstar Tab" : "Star Tab"}>
                            <Star className={`w-3.5 h-3.5 ${tab.isStarred ? 'fill-current' : ''}`} />
                          </button>
                          {tab.favIconUrl ? <img src={tab.favIconUrl} className="w-4 h-4 flex-shrink-0" /> : <div className="w-4 h-4 bg-white/10 rounded-sm flex-shrink-0" />}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium text-white/70 truncate max-w-sm" title={tab.url}>{tab.title}</span>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5 select-none">
                              <span className="text-[10px] text-white/30 truncate max-w-[180px]">{tab.url.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                              {tab.scheduledOpenTimes && tab.scheduledOpenTimes.length > 0 && (
                                <span className="text-[9px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                  <Clock className="w-2 h-2 animate-[spin_4s_linear_infinite]" />
                                  Opens {tab.scheduledOpenTimes.length > 1 ? `on ${tab.scheduledOpenTimes.length} dates` : new Date(tab.scheduledOpenTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              )}
                              {tab.scheduledCloseTimes && tab.scheduledCloseTimes.length > 0 && (
                                <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                  <Clock className="w-2 h-2 animate-[spin_4s_linear_infinite]" />
                                  Closes {tab.scheduledCloseTimes.length > 1 ? `on ${tab.scheduledCloseTimes.length} dates` : new Date(tab.scheduledCloseTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip content="Open Tab"><button onClick={() => openTab(tab.url, 'current')} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-green-400 transition-all">
                            <Play className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="New Window"><button onClick={() => openTab(tab.url, 'new')} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-blue-400 transition-all">
                            <AppWindow className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Incognito"><button onClick={() => openTab(tab.url, 'incognito')} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-purple-400 transition-all">
                            <Ghost className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Close Tab"><button onClick={() => closeTab(tab.url)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-red-400 transition-all">
                            <XSquare className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Set Tab Timer"><button onClick={(e) => { e.stopPropagation(); openTimer(folder, tab.url); }} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-accent-purple transition-all">
                            <Clock className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Edit Tab" align="right"><button onClick={() => setShowEditTabModal({ sessionId: folder.id, oldUrl: tab.url, url: tab.url, title: tab.title })} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-all">
                            <Pencil className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Remove Tab" align="right"><button onClick={() => setShowDeleteModal({ sessionId: folder.id, url: tab.url })} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-orange-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button></Tooltip>
                        </div>
                      </div>
                    ))}

                    {!folder.tabs || folder.tabs.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">This folder is empty.</p>
                    ) : matchingTabs.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">No matching tabs found.</p>
                    ) : null}
                  </div>
                  
                  {sortedTabs.length > tabLimit && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => setTabLimit(prev => prev + 50)}
                        className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-white/60 hover:text-white transition-all font-medium"
                      >
                        Show More ({sortedTabs.length - tabLimit} remaining)
                      </button>
                    </div>
                  )}

                  <div className="pt-2 mt-2">
                    <button onClick={() => setShowAddTabModal(folder.id)} className="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs font-medium text-white/40 hover:text-white/80 hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2">
                      <span>+ Add Tab to Folder</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  return (
    <div className="max-w-5xl relative pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">Folders</h2>
          <p className="text-white/50 text-lg font-light">Organize your workspace and set powerful schedules.</p>
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <button 
                onClick={() => {
                  const allIds = new Set(filteredFolders.map(f => f.id));
                  setSelectedFolderIds(allIds);
                }} 
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium"
              >
                Select All
              </button>
              <button 
                onClick={() => setSelectedFolderIds(new Set())} 
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium"
              >
                Deselect All
              </button>
              <button 
                disabled={selectedFolderIds.size === 0}
                onClick={() => setShowBulkDeleteModal(true)} 
                className="flex items-center gap-2 bg-red-600/90 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600/90 text-white transition-all shadow-lg shadow-red-500/20 px-4 py-2.5 rounded-xl text-sm font-medium disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected ({selectedFolderIds.size})
              </button>
              <button 
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedFolderIds(new Set());
                }} 
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium">
                <Download className="w-4 h-4" /> Import
              </button>
              <button onClick={() => {
                setSelectedExportFolders(new Set());
                setSelectedExportTabs(new Set());
                setExpandedExportFolders(new Set());
                setShowExportModal(true);
              }} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium">
                <Upload className="w-4 h-4" /> Export
              </button>
              {folders.length > 0 && (
                <button 
                  onClick={() => setIsSelectMode(true)} 
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-4 py-2.5 rounded-xl text-sm font-medium"
                >
                  <CheckSquare className="w-4 h-4" /> Select Mode
                </button>
              )}
              <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 px-6 py-2.5 rounded-xl text-sm font-medium">
                + New Folder
              </button>
            </>
          )}
        </div>
      </div>



      <div className="mb-8 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-white/30" />
        </div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setFolderPage(1);
          }}
          placeholder="Search folders..." 
          className="os-input w-full pl-11 h-12 bg-white/[0.02] text-white"
        />
      </div>

      {/* Simplified Sort Button */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setSortDesc(!sortDesc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white transition-all"
          title={sortDesc ? "Sorting Z to A" : "Sorting A to Z"}
        >
          Sort Name: {sortDesc ? 'Z to A' : 'A to Z'}
          <span className="text-[10px]">{sortDesc ? '↓' : '↑'}</span>
        </button>
      </div>


      <div className="space-y-8">
        {folders.length === 0 ? (
          <div className="border border-white/[0.05] bg-white/[0.01] rounded-3xl p-16 text-center text-white/30 font-light">
            You don't have any manual folders yet.<br/>Click "New Folder" to create one.
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="border border-white/[0.05] bg-white/[0.01] rounded-3xl p-16 text-center text-white/30 font-light">
            No folders found matching "{searchQuery}".
          </div>
        ) : (
          <>
            {pinnedFolders.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-4 flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5" /> Pinned Folders
                </h3>
                {renderFolderList(pinnedFolders)}
              </div>
            )}
            
            {unpinnedFolders.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-4 flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5" /> {pinnedFolders.length > 0 ? "Other Folders" : "All Folders"}
                </h3>
                {renderFolderList(paginatedUnpinnedFolders)}

                {/* Pagination Controls */}
                {unpinnedFolders.length > 5 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-white/50">Show</span>
                      <div className="relative flex items-center">
                        <select
                          value={foldersPerPage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFoldersPerPage(val);
                            localStorage.setItem('tabflow_folders_per_page', String(val));
                            setFolderPage(1);
                          }}
                          className="appearance-none bg-[#110e20] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white outline-none focus:border-accent-purple/50 transition-all cursor-pointer"
                        >
                          <option value={5} className="bg-[#110e20] text-white">5 folders</option>
                          <option value={10} className="bg-[#110e20] text-white">10 folders</option>
                          <option value={20} className="bg-[#110e20] text-white">20 folders</option>
                          <option value={50} className="bg-[#110e20] text-white">50 folders</option>
                          <option value={100} className="bg-[#110e20] text-white">100 folders</option>
                          <option value={9999} className="bg-[#110e20] text-white">All folders</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 pointer-events-none w-3.5 h-3.5 text-white/40" />
                      </div>
                      <span className="text-xs text-white/30">
                        Showing {unpinnedFolders.length > 0 ? (activePage - 1) * foldersPerPage + 1 : 0}–{Math.min(activePage * foldersPerPage, unpinnedFolders.length)} of {unpinnedFolders.length} folders
                      </span>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setFolderPage(p => Math.max(1, p - 1))}
                          disabled={activePage === 1}
                          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition-colors disabled:cursor-not-allowed"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {(() => {
                          const pages: (number | string)[] = [];
                          for (let i = 1; i <= totalPages; i++) {
                            if (i === 1 || i === totalPages || Math.abs(i - activePage) <= 1) {
                              pages.push(i);
                            } else if (pages[pages.length - 1] !== '...') {
                              pages.push('...');
                            }
                          }
                          return pages.map((p, idx) => {
                            if (p === '...') {
                              return <span key={`dots-${idx}`} className="px-2 text-xs text-white/30">...</span>;
                            }
                            return (
                              <button
                                key={p}
                                onClick={() => setFolderPage(p as number)}
                                className={`min-w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                  activePage === p
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          });
                        })()}

                        <button
                          onClick={() => setFolderPage(p => Math.min(totalPages, p + 1))}
                          disabled={activePage === totalPages}
                          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition-colors disabled:cursor-not-allowed"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Portaled Modals & Floating Action Bar */}
      {createPortal(
        <>
          {/* Bulk Delete Confirmation Modal */}
          <AnimatePresence>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowBulkDeleteModal(false)} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0a12]/95 backdrop-blur-xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 animate-bounce">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{selectedFolderIds.size === 1 ? 'Delete Folder' : 'Delete Multiple Folders'}</h3>
                <p className="text-sm text-white/50 mb-6">
                  Are you sure you want to delete the {selectedFolderIds.size === 1 ? 'selected folder' : <><span className="text-white font-medium">{selectedFolderIds.size}</span> selected folders</>}? This action is permanent and cannot be undone.
                </p>
                <div className="flex w-full gap-3">
                  <button 
                    onClick={() => setShowBulkDeleteModal(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium border border-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      setShowBulkDeleteModal(false);
                      const ids = Array.from(selectedFolderIds);
                      setIsSelectMode(false);
                      setSelectedFolderIds(new Set());
                      await handleBulkDelete(ids);
                    }}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-red-600/20 transition-colors"
                  >
                    {selectedFolderIds.size === 1 ? 'Delete' : 'Delete All'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Folders Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowExportModal(false)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-xl font-semibold text-white">Export Folders</h3>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const allFolders = new Set(folders.map(f => f.id));
                    const allTabs = new Set(folders.flatMap(f => f.tabs.map((t: any) => `${f.id}_${t.url}`)));
                    setSelectedExportFolders(allFolders);
                    setSelectedExportTabs(allTabs);
                  }} className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Select All</button>
                  <button onClick={() => {
                    setSelectedExportFolders(new Set());
                    setSelectedExportTabs(new Set());
                  }} className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Deselect All</button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {folders.map(folder => {
                  const isFolderSelected = selectedExportFolders.has(folder.id);
                  const isExpanded = expandedExportFolders.has(folder.id);
                  const folderTabs = folder.tabs || [];
                  const selectedTabsCount = folderTabs.filter((t: any) => selectedExportTabs.has(`${folder.id}_${t.url}`)).length;
                  const isIndeterminate = selectedTabsCount > 0 && selectedTabsCount < folderTabs.length;

                  return (
                    <div key={folder.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                      <div className="flex items-center p-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => {
                        const newExpanded = new Set(expandedExportFolders);
                        if (isExpanded) newExpanded.delete(folder.id);
                        else newExpanded.add(folder.id);
                        setExpandedExportFolders(newExpanded);
                      }}>
                        <div className="mr-3 flex-shrink-0" onClick={(e) => {
                          e.stopPropagation();
                          const newFolders = new Set(selectedExportFolders);
                          const newTabs = new Set(selectedExportTabs);
                          if (isFolderSelected || isIndeterminate) {
                            newFolders.delete(folder.id);
                            folderTabs.forEach((t: any) => newTabs.delete(`${folder.id}_${t.url}`));
                          } else {
                            newFolders.add(folder.id);
                            folderTabs.forEach((t: any) => newTabs.add(`${folder.id}_${t.url}`));
                          }
                          setSelectedExportFolders(newFolders);
                          setSelectedExportTabs(newTabs);
                        }}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isFolderSelected ? 'bg-blue-500 border-blue-500' : isIndeterminate ? 'bg-blue-500/50 border-blue-500/50' : 'border-white/20 bg-black/20'}`}>
                            {isFolderSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            {isIndeterminate && <div className="w-2.5 h-0.5 bg-white rounded-full" />}
                          </div>
                        </div>
                        <Folder className="w-5 h-5 text-accent-blue mr-3 flex-shrink-0" />
                        <span className="text-sm font-medium text-white flex-1 truncate">{folder.name}</span>
                        <span className="text-xs text-white/40 mr-4">{folderTabs.length} tabs</span>
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-3 pt-0 border-t border-white/5 bg-black/20 space-y-1">
                              {folderTabs.map((tab: any, idx: number) => {
                                const tabId = `${folder.id}_${tab.url}`;
                                const isTabSelected = selectedExportTabs.has(tabId);
                                return (
                                  <div key={idx} className="flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors" onClick={() => {
                                    const newTabs = new Set(selectedExportTabs);
                                    if (isTabSelected) newTabs.delete(tabId);
                                    else newTabs.add(tabId);
                                    setSelectedExportTabs(newTabs);

                                    const newSelectedCount = folderTabs.filter((t: any) => newTabs.has(`${folder.id}_${t.url}`)).length;
                                    const newFolders = new Set(selectedExportFolders);
                                    if (newSelectedCount === folderTabs.length && folderTabs.length > 0) newFolders.add(folder.id);
                                    else newFolders.delete(folder.id);
                                    setSelectedExportFolders(newFolders);
                                  }}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors shrink-0 ${isTabSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 bg-black/20'}`}>
                                      {isTabSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    {tab.favIconUrl ? <img src={tab.favIconUrl} className="w-3.5 h-3.5 mr-2 flex-shrink-0" /> : <div className="w-3.5 h-3.5 bg-white/10 rounded-sm mr-2 flex-shrink-0" />}
                                    <span className="text-xs text-white/70 truncate" title={tab.url}>{tab.title}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
                {folders.length === 0 && <div className="text-center text-white/40 py-8 text-sm">No folders to export.</div>}
              </div>

              <div className="flex w-full gap-3 shrink-0">
                <button onClick={() => setShowExportModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Cancel</button>
                <button onClick={handleExport} disabled={selectedExportFolders.size === 0 && selectedExportTabs.size === 0} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">Export Selected</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80">
              <h3 className="text-xl font-semibold text-white mb-6">Create New Folder</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40 mb-2 block">Folder Name</label>
                  <input type="text" className="os-input w-full bg-[#07050f]" placeholder="e.g. Project Apollo" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="flex w-full gap-3 mt-8">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Cancel</button>
                <button onClick={submitCreateFolder} disabled={!newFolderName.trim()} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">Create Folder</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Tab Modal */}
      <AnimatePresence>
        {showAddTabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTabModal(null)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80">
              <h3 className="text-xl font-semibold text-white mb-6">Add Tab</h3>
              
              <button onClick={submitScanTabs} className="w-full py-4 mb-6 bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 rounded-xl flex items-center justify-center gap-3 text-accent-blue transition-all">
                <span className="font-medium">Scan & Save All Open Tabs</span>
              </button>
              
              <div className="relative flex items-center py-2 mb-6">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-medium uppercase tracking-widest">OR Add Manually</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40 mb-2 block">Tab Title (Optional)</label>
                  <input type="text" className="os-input w-full bg-[#07050f]" placeholder="e.g. My Document" value={newTabName} onChange={e => setNewTabName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40 mb-2 block">URL</label>
                  <input type="text" className="os-input w-full bg-[#07050f]" placeholder="e.g. google.com" value={newTabUrl} onChange={e => setNewTabUrl(e.target.value)} />
                </div>
              </div>
              <div className="flex w-full gap-3 mt-8">
                <button onClick={() => setShowAddTabModal(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Cancel</button>
                <button onClick={submitAddTabManually} disabled={!newTabUrl.trim()} className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50">Add Tab</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tab Modal */}
      <AnimatePresence>
        {showEditTabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditTabModal(null)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80">
              <h3 className="text-xl font-semibold text-white mb-6">Edit Tab</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40 mb-2 block">Tab Title</label>
                  <input type="text" className="os-input w-full bg-[#07050f]" value={showEditTabModal.title} onChange={e => setShowEditTabModal({...showEditTabModal, title: e.target.value})} autoFocus />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40 mb-2 block">URL</label>
                  <input type="text" className="os-input w-full bg-[#07050f]" value={showEditTabModal.url} onChange={e => setShowEditTabModal({...showEditTabModal, url: e.target.value})} />
                </div>
              </div>
              <div className="flex w-full gap-3 mt-8">
                <button onClick={() => setShowEditTabModal(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Cancel</button>
                <button onClick={submitEditTab} disabled={!showEditTabModal.url.trim()} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Workspace Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(null)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80 flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">Share "{showShareModal.folderName}"</h3>
                <button onClick={() => setShowShareModal(null)} className="text-white/40 hover:text-white transition-colors">Close</button>
              </div>
              
              <div className="flex-1 overflow-hidden flex flex-col bg-[#07050f] rounded-2xl border border-white/[0.04]">
                {isGeneratingShare ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20">
                    <Sparkles className="w-8 h-8 text-blue-500 animate-pulse mb-4" />
                    <p className="text-white/50 text-sm font-medium tracking-wide">AI is summarizing your workspace...</p>
                  </div>
                ) : shareLink ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-2">
                      <Share2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-semibold text-white">Share Link Generated</h4>
                    <p className="text-sm text-white/50 max-w-md">
                      This folder is shared publicly. Anyone with this link can view the tabs in this workspace.
                    </p>
                    <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <span className="text-sm text-blue-400 font-mono truncate select-all">{shareLink}</span>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors"
                      >
                        {shareCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : !shareMarkdown ? (
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    <p className="text-sm text-white/50 mb-2 px-2">Select the tabs you want to include in the public summary:</p>
                    {showShareModal.tabs.map((tab: any, index: number) => (
                      <label key={index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                        <input 
                          type="checkbox" 
                          checked={selectedShareTabs.has(tab.url)}
                          onChange={(e) => {
                            const newSet = new Set(selectedShareTabs);
                            if (e.target.checked) newSet.add(tab.url);
                            else newSet.delete(tab.url);
                            setSelectedShareTabs(newSet);
                          }}
                          className="w-4 h-4 shrink-0 rounded-md border-white/20 bg-black/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-white/90 font-medium truncate">{tab.title}</span>
                          <span className="text-xs text-white/40 truncate">{tab.url}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex border-b border-white/5 bg-white/[0.02] px-4 py-2 gap-2 shrink-0">
                      <button
                        onClick={() => setShareViewMode('preview')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          shareViewMode === 'preview'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => setShareViewMode('edit')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          shareViewMode === 'edit'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        Edit Raw
                      </button>
                    </div>
                    {shareViewMode === 'preview' ? (
                      <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                        <MarkdownPreview content={shareMarkdown} />
                      </div>
                    ) : (
                      <textarea
                        className="flex-1 w-full h-full min-h-[300px] bg-transparent text-sm text-white/80 p-6 outline-none resize-none font-mono"
                        value={shareMarkdown}
                        onChange={e => setShareMarkdown(e.target.value)}
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
                      />
                    )}
                  </>
                )}
              </div>
              
              <div className="flex w-full gap-3 mt-6">
                {!shareLink && (
                  <div className="relative">
                    <select 
                      value={linkExpiry} 
                      onChange={e => setLinkExpiry(Number(e.target.value))}
                      className="appearance-none h-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl pl-4 pr-10 py-3 text-sm outline-none transition-colors cursor-pointer"
                    >
                      <option value={1}>Expires in 1 Day</option>
                      <option value={7}>Expires in 7 Days</option>
                      <option value={30}>Expires in 30 Days</option>
                      <option value={365}>Expires in 1 Year</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                )}
                <button onClick={() => setShowShareModal(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Done</button>
                {shareLink ? (
                  <>
                    <button 
                      onClick={() => {
                        setShareLink('');
                        setShareMarkdown('');
                        setShareViewMode('preview');
                        if (showShareModal) {
                          chrome.runtime.sendMessage({
                            type: 'UPDATE_FOLDER_SHARE_LINK',
                            sessionId: showShareModal.folderId,
                            shareLink: ''
                          }, () => {
                            loadFolders();
                          });
                        }
                      }} 
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors"
                    >
                      Regenerate
                    </button>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} 
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2 bg-green-500/20 text-green-400 border border-green-500/30"
                    >
                      {shareCopied ? <><Check className="w-4 h-4" /> Link Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
                    </button>
                  </>
                ) : !shareMarkdown ? (
                  <button 
                    onClick={generateShareableWorkspace} 
                    disabled={selectedShareTabs.size === 0 || isGeneratingShare} 
                    className={`flex-[2] px-4 py-3 rounded-full text-sm font-medium text-white transition-all flex items-center justify-center gap-2 ${selectedShareTabs.size === 0 ? 'opacity-50 bg-white/10' : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:opacity-90 shadow-md shadow-blue-500/20'}`}
                  >
                    <Sparkles className="w-4 h-4" /> Generate Summary
                  </button>
                ) : (
                  <button 
                    onClick={generatePublicLink} 
                    disabled={isGeneratingLink} 
                    className={`flex-[2] px-4 py-3 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2 ${isGeneratingLink ? 'opacity-50 bg-white/10' : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 shadow-md shadow-blue-500/20 disabled:opacity-50'}`}
                  >
                    {isGeneratingLink ? "Generating Public Link..." : <><Share2 className="w-4 h-4" /> Get Shareable Link</>}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Timer Modal */}
      <AnimatePresence>
        {showTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTimerModal(null)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/80">
              <h3 className="text-lg font-medium text-white mb-6">Schedule {showTimerModal.type === 'folder' ? 'Folder' : 'Tab'}</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block font-medium">Action</label>
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setOpenActionMenu(openActionMenu === 'timer_action' ? null : 'timer_action'); }}
                      className="w-full flex items-center justify-between bg-[#131313] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none hover:border-white/20 transition-all text-left font-medium"
                    >
                      <span className="capitalize">{timerAction}</span>
                      <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openActionMenu === 'timer_action' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {openActionMenu === 'timer_action' && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenActionMenu(null); }} />
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-[calc(100%+6px)] left-0 w-full bg-[#161616] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 py-1"
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTimerAction('close'); setOpenActionMenu(null); }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${timerAction === 'close' ? 'text-accent-blue bg-white/[0.02] font-medium' : 'text-white/70'}`}
                            >
                              <span>Close</span>
                              {timerAction === 'close' && <Check className="w-4 h-4 text-accent-blue" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTimerAction('open'); setOpenActionMenu(null); }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${timerAction === 'open' ? 'text-accent-blue bg-white/[0.02] font-medium' : 'text-white/70'}`}
                            >
                              <span>Open</span>
                              {timerAction === 'open' && <Check className="w-4 h-4 text-accent-blue" />}
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 flex items-center justify-between font-medium">
                    <span>Date & Time</span>
                    <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">{timerAction === 'open' ? openTimerDates.length : closeTimerDates.length} scheduled</span>
                  </label>
                  <CustomDateTimePicker 
                    value={timerAction === 'open' ? openTimerDates : closeTimerDates} 
                    onChange={timerAction === 'open' ? setOpenTimerDates : setCloseTimerDates} 
                  />
                </div>
              </div>
              <div className="flex items-center w-full gap-2 mt-8">
                {(openTimerDates.length > 0 || closeTimerDates.length > 0) && (
                  <button onClick={() => submitTimer(true)} className="px-4 py-2.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl text-sm font-medium text-red-400 transition-colors">
                    Clear All
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => setShowTimerModal(null)} className="px-5 py-2.5 hover:bg-white/5 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                <button onClick={() => submitTimer(false)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteModal(null)} className="fixed inset-0 bg-black/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl shadow-black/80 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Delete {showDeleteModal.url ? 'Tab' : 'Folder'}?</h3>
              <p className="text-sm text-white/50 mb-8">This action cannot be undone. {showDeleteModal.url ? 'The tab will be removed from this folder.' : 'All tabs and scheduled timers inside this folder will be lost.'}</p>
              
              <div className="flex w-full gap-3">
                <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white transition-colors">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lock Settings Modal */}
      <AnimatePresence>
        {showLockSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLockSettingsModal(null)} className="fixed inset-0 bg-black/40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/98 p-8 shadow-2xl shadow-black/80">
              <h3 className="text-xl font-semibold text-white mb-2">Lock Settings</h3>
              <p className="text-sm text-white/50 mb-6">Secure this folder with a password.</p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-xs font-medium text-white/50 mb-1.5 block">Password</label>
                  <div className="relative flex items-center">
                    <input type={showLockPassword ? "text" : "password"} placeholder={showLockSettingsModal.password ? "•••••••• (Leave blank to keep existing)" : "Enter a password"} value={lockPassword} onChange={e => setLockPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-11 py-2.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm" />
                    <button 
                      type="button"
                      onClick={() => setShowLockPassword(!showLockPassword)}
                      className="absolute right-3 text-white/40 hover:text-white transition-colors"
                    >
                      {showLockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 mb-1.5 block">Recovery Word (Required to reset if forgotten)</label>
                  <input type="text" placeholder={showLockSettingsModal.password ? "•••••••• (Leave blank to keep existing)" : "Enter a secret recovery word"} value={lockRecoveryWord} onChange={e => setLockRecoveryWord(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm" />
                  <p className="text-xs text-amber-400 mt-2 leading-relaxed">
                    ⚠️ <strong>Important:</strong> Save your recovery word in a safe place. It is required to reset your password if you ever forget it.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                  <input type="checkbox" id="autoLock" checked={autoLock} onChange={e => setAutoLock(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-offset-0 focus:ring-0" />
                  <label htmlFor="autoLock" className="text-sm text-white/80 cursor-pointer select-none">Auto-lock when Dashboard reloads</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
                <button onClick={() => setShowLockSettingsModal(null)} className="px-5 py-2.5 hover:bg-white/5 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                {showLockSettingsModal.password && (
                  <button onClick={() => {
                    chrome.runtime.sendMessage({ type: 'UPDATE_FOLDER_LOCK', sessionId: showLockSettingsModal.id, password: '', recoveryWord: '', autoLockEnabled: false }, () => {
                      loadFolders();
                      setShowLockSettingsModal(null);
                      showToast('Security Removed', 'Folder password protection has been disabled.', 'info');
                    });
                  }} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all">
                    Remove Lock
                  </button>
                )}
                <button onClick={async () => {
                   let finalPwd = showLockSettingsModal.password || '';
                   let finalRecovery = showLockSettingsModal.recoveryWord || '';
                   
                   if (showLockSettingsModal.password) {
                     if (lockPassword) {
                       if (!lockRecoveryWord.trim() && !showLockSettingsModal.recoveryWord) {
                         showToast('Recovery Word Required', 'Set a Recovery Word so you can recover your folder if you forget the password.', 'error');
                         return;
                       }
                       finalPwd = await sha256(showLockSettingsModal.id + lockPassword);
                       if (lockRecoveryWord.trim()) {
                         finalRecovery = await sha256(showLockSettingsModal.id + lockRecoveryWord.trim().toLowerCase());
                       }
                     } else if (lockRecoveryWord.trim()) {
                       finalRecovery = await sha256(showLockSettingsModal.id + lockRecoveryWord.trim().toLowerCase());
                     }
                   } else {
                     if (lockPassword) {
                       if (!lockRecoveryWord.trim()) {
                         showToast('Recovery Word Required', 'Set a Recovery Word so you can recover your folder if you forget the password.', 'error');
                         return;
                       }
                       finalPwd = await sha256(showLockSettingsModal.id + lockPassword);
                       finalRecovery = await sha256(showLockSettingsModal.id + lockRecoveryWord.trim().toLowerCase());
                     } else {
                       finalPwd = '';
                       finalRecovery = '';
                     }
                   }

                   chrome.runtime.sendMessage({ type: 'UPDATE_FOLDER_LOCK', sessionId: showLockSettingsModal.id, password: finalPwd, recoveryWord: finalRecovery, autoLockEnabled: autoLock }, () => {
                     loadFolders();
                     setShowLockSettingsModal(null);
                     showToast('Security Saved', 'Folder lock settings updated successfully.', 'success');
                   });
                }} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">Save Lock</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dpaste Warning Modal */}
      <AnimatePresence>
        {showDpasteWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDpasteWarning(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-orange-500/30 bg-[#1a1412]/98 p-8 shadow-2xl shadow-black/80">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Network className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">External Service Warning</h3>
                  <p className="text-sm text-orange-400/80 mt-1">Data will be sent to dpaste.com</p>
                </div>
              </div>
              <div className="space-y-4 text-sm text-white/70 mb-8 p-4 bg-orange-500/5 rounded-xl border border-orange-500/10">
                <p>
                  You are about to generate a public link using an external service (<strong className="text-white">dpaste.com</strong>).
                </p>
                <p>
                  The summarized markdown for this folder will be uploaded and stored publicly. Anyone with the link will be able to read it.
                </p>
                <p className="text-orange-300">
                  <strong>Warning:</strong> Ensure there is no sensitive, private, or confidential information in this summary before proceeding.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDpasteWarning(false)} className="flex-1 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors">Cancel</button>
                <button onClick={generatePublicLink} disabled={isGeneratingLink} className="flex-1 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50 flex justify-center items-center">
                  {isGeneratingLink ? <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'I Understand, Proceed'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unlock Modal */}
      <AnimatePresence>
        {showUnlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => {setShowUnlockModal(null); setIsRecoveryMode(null);}} className="fixed inset-0 bg-black/40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/98 p-8 shadow-2xl shadow-black/80 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {isRecoveryMode === 'verify_word' ? 'Verify Recovery' : isRecoveryMode === 'new_password' ? 'Reset Password' : 'Folder Locked'}
              </h3>
              <p className="text-sm text-white/50 mb-6">
                {isRecoveryMode === 'verify_word' ? 'Enter the secret recovery word to reset your password.' : isRecoveryMode === 'new_password' ? 'Enter a new password to reset the lock.' : 'Enter the password to unlock this folder.'}
              </p>
              
              <div className="space-y-4 mb-6 text-left">
                {isRecoveryMode === 'verify_word' ? (
                  showUnlockModal.recoveryWord ? (
                    <input 
                      type="text" 
                      placeholder="Recovery Word" 
                      value={recoveryWordInput} 
                      onChange={e => setRecoveryWordInput(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUnlockSubmit();
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center" 
                      autoFocus
                    />
                  ) : (
                    <p className="text-xs text-red-400/80 text-center bg-red-400/10 border border-red-400/20 p-3 rounded-xl leading-relaxed">
                      No recovery word was set up for this locked folder. Recovery is not possible. Please recall your password or delete and recreate the folder.
                    </p>
                  )
                ) : isRecoveryMode === 'new_password' ? (
                  <div className="relative flex items-center">
                    <input 
                      type={showRecoveryNewPassword ? "text" : "password"} 
                      placeholder="New Password" 
                      value={recoveryNewPassword} 
                      onChange={e => setRecoveryNewPassword(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUnlockSubmit();
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-11 py-2.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 transition-all" 
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => setShowRecoveryNewPassword(!showRecoveryNewPassword)}
                      className="absolute right-3 text-white/40 hover:text-white transition-colors"
                    >
                      {showRecoveryNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center">
                    <input 
                      type={showUnlockPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={unlockPassword} 
                      onChange={e => setUnlockPassword(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUnlockSubmit();
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-11 py-2.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 transition-all" 
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                      className="absolute right-3 text-white/40 hover:text-white transition-colors"
                    >
                      {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}
                {unlockError && <p className="text-xs text-red-400 text-center">{unlockError}</p>}
              </div>

              <div className="flex flex-col gap-3">
                {(!isRecoveryMode || isRecoveryMode !== 'verify_word' || showUnlockModal.recoveryWord) && (
                  <button 
                    onClick={handleUnlockSubmit} 
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                  >
                    {isRecoveryMode === 'verify_word' ? 'Verify Word' : isRecoveryMode === 'new_password' ? 'Reset Lock' : 'Unlock'}
                  </button>
                )}
                {!isRecoveryMode ? (
                  showUnlockModal.password && (
                    <button onClick={() => { setIsRecoveryMode('verify_word'); setUnlockPassword(''); setRecoveryWordInput(''); setRecoveryNewPassword(''); setUnlockError(''); }} className="text-xs text-white/40 hover:text-white transition-colors">Forgot Password?</button>
                  )
                ) : (
                  <button onClick={() => { setIsRecoveryMode(null); setUnlockError(''); }} className="text-xs text-indigo-400/80 hover:text-indigo-400 transition-colors">Back to Unlock</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Floating Scroll to Top / Bottom Buttons */}
      {folders.length > 2 && (
        <div className="fixed bottom-8 right-8 z-40 flex flex-col gap-2">
          <Tooltip content="Scroll to Top" position="top">
            <button 
              onClick={handleScrollToTop} 
              className="p-3 bg-[#110e20]/90 hover:bg-[#1c1735]/90 border border-white/10 text-white/60 hover:text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all active:scale-95 hover:scale-105"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Scroll to Bottom" position="top">
            <button 
              onClick={handleScrollToBottom} 
              className="p-3 bg-[#110e20]/90 hover:bg-[#1c1735]/90 border border-white/10 text-white/60 hover:text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all active:scale-95 hover:scale-105"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      )}
      </>, document.body)}

    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-[13px] font-medium tracking-wide
        ${active 
          ? 'bg-white/[0.06] text-white font-semibold' 
          : 'text-white/40 hover:bg-white/[0.03] hover:text-white/80'
        }
      `}
    >
      <div className={`w-4 h-4 flex items-center justify-center transition-colors ${active ? 'text-white' : 'text-white/40'}`}>
        {icon}
      </div>
      {label}
    </button>
  );
}

function Tooltip({ children, content, position = 'bottom', align = 'center' }: { children: React.ReactNode, content: string, position?: 'bottom' | 'top', align?: 'left' | 'center' | 'right' }) {
  let alignClass = 'left-1/2 -translate-x-1/2';
  if (align === 'left') alignClass = 'left-0';
  if (align === 'right') alignClass = 'right-0';

  return (
    <div className="relative group/tooltip flex items-center justify-center">
      {children}
      <div className={`absolute ${alignClass} px-2.5 py-1.5 bg-[#0f0b1e]/95 backdrop-blur-md border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-white/90 text-[10px] font-medium rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 whitespace-nowrap z-[100] pointer-events-none ${position === 'bottom' ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'}`}>
        {content}
      </div>
    </div>
  );
}

function CustomDateTimePicker({ value, onChange }: { value: Date[], onChange: (dates: Date[]) => void }) {
  const [currentMonth, setCurrentMonth] = useState(value.length > 0 ? value[0] : new Date());

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleDayClick = (day: number) => {
    const existingIdx = value.findIndex(v => v.getDate() === day && v.getMonth() === currentMonth.getMonth() && v.getFullYear() === currentMonth.getFullYear());
    
    if (existingIdx >= 0) {
      const newDates = [...value];
      newDates.splice(existingIdx, 1);
      onChange(newDates);
    } else {
      const defaultTime = value.length > 0 ? value[value.length - 1] : new Date(new Date().getTime() + 60000);
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, defaultTime.getHours(), defaultTime.getMinutes(), defaultTime.getSeconds());
      onChange([...value, newDate].sort((a,b) => a.getTime() - b.getTime()));
    }
  };

  const handleIndividualTimeChange = (idx: number, type: 'h'|'m'|'s', val: string) => {
    const num = parseInt(val) || 0;
    const newDates = [...value];
    const newDate = new Date(newDates[idx]);
    if (type === 'h') newDate.setHours(num);
    if (type === 'm') newDate.setMinutes(num);
    if (type === 's') newDate.setSeconds(num);
    newDates[idx] = newDate;
    onChange(newDates);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 w-full select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 text-white">
        <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white">&lt;</button>
        <span className="text-sm font-semibold tracking-wide">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white">&gt;</button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-white/30 mb-2 font-medium">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {blanks.map(b => <div key={`b-${b}`} className="p-2" />)}
        {days.map(d => {
          const isSelected = value.some(v => v.getDate() === d && v.getMonth() === currentMonth.getMonth() && v.getFullYear() === currentMonth.getFullYear());
          const isToday = !isSelected && d === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();
          
          return (
            <button 
              key={d} 
              onClick={() => handleDayClick(d)}
              className={`p-2 rounded-lg transition-all ${isSelected ? 'bg-white text-black font-semibold shadow-sm' : isToday ? 'bg-white/5 text-white font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Selected Dates Time Pickers */}
      {value.length > 0 && (
        <div className="mt-5 pt-5 border-t border-white/[0.04] flex flex-col gap-3 max-h-48 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <div className="text-xs text-white/30 uppercase tracking-widest font-medium mb-1">Selected Dates & Times</div>
          {value.map((date, idx) => (
            <div key={idx} className="flex justify-between items-center gap-2 bg-[#222222] p-2.5 rounded-xl border border-white/5">
              <span className="text-xs font-medium text-white/80">{monthNames[date.getMonth()]} {date.getDate()}, {date.getFullYear()}</span>
              <div className="flex items-center gap-0.5 bg-[#111111] p-1 rounded-lg border border-white/5 focus-within:border-white/20 transition-colors">
                <input type="number" min="0" max="23" value={date.getHours().toString().padStart(2, '0')} onChange={e => handleIndividualTimeChange(idx, 'h', e.target.value)} className="w-8 bg-transparent text-white text-center py-0.5 text-xs font-medium outline-none hover:bg-white/5 focus:bg-white/10 rounded transition-colors" />
                <span className="text-white/30 font-medium pb-0.5">:</span>
                <input type="number" min="0" max="59" value={date.getMinutes().toString().padStart(2, '0')} onChange={e => handleIndividualTimeChange(idx, 'm', e.target.value)} className="w-8 bg-transparent text-white text-center py-0.5 text-xs font-medium outline-none hover:bg-white/5 focus:bg-white/10 rounded transition-colors" />
                <span className="text-white/30 font-medium pb-0.5">:</span>
                <input type="number" min="0" max="59" value={date.getSeconds().toString().padStart(2, '0')} onChange={e => handleIndividualTimeChange(idx, 's', e.target.value)} className="w-8 bg-transparent text-white text-center py-0.5 text-xs font-medium outline-none hover:bg-white/5 focus:bg-white/10 rounded transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MarkdownPreview = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  const rendered: React.ReactNode[] = [];
  
  let currentTableHeaders: string[] = [];
  let currentTableRows: string[][] = [];
  let isInsideTable = false;

  let currentListItems: React.ReactNode[] = [];
  let isInsideList = false;

  const renderInline = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const closeBraceIdx = part.indexOf(']');
        if (closeBraceIdx !== -1) {
          const label = part.slice(1, closeBraceIdx);
          const url = part.slice(closeBraceIdx + 2, -1);
          const safeUrl = sanitizeUrl(url);
          return (
            <a 
              key={idx} 
              href={safeUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium break-all"
            >
              {label}
            </a>
          );
        }
      }
      return part;
    });
  };

  const flushTable = (key: number) => {
    if (currentTableHeaders.length > 0 || currentTableRows.length > 0) {
      rendered.push(
        <div key={`table-${key}`} className="overflow-x-auto my-4 rounded-xl border border-white/10 bg-white/[0.01]">
          <table className="w-full text-left border-collapse text-sm">
            {currentTableHeaders.length > 0 && (
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {currentTableHeaders.map((h, i) => (
                    <th key={i} className="p-3 font-semibold text-white whitespace-nowrap">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {currentTableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02] last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-3 text-white/80 max-w-[300px] break-words">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTableHeaders = [];
      currentTableRows = [];
    }
    isInsideTable = false;
  };

  const flushList = (key: number) => {
    if (currentListItems.length > 0) {
      rendered.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1.5 text-sm text-white/70">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
    isInsideList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|')) {
      if (isInsideList) {
        flushList(i);
      }
      
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      const isSeparator = cells.every(c => c.match(/^-+$/) || c === '');
      
      if (isSeparator) {
        isInsideTable = true;
        continue;
      }
      
      if (!isInsideTable) {
        currentTableHeaders = cells;
        isInsideTable = true;
      } else {
        currentTableRows.push(cells);
      }
    } else {
      if (isInsideTable) {
        flushTable(i);
      }
      
      if (line.startsWith('- ') || line.startsWith('* ')) {
        isInsideList = true;
        currentListItems.push(
          <li key={`li-${i}`}>
            {renderInline(line.slice(2))}
          </li>
        );
      } else {
        if (isInsideList) {
          flushList(i);
        }
        
        if (line === '') {
          rendered.push(<div key={i} className="h-2" />);
        } else if (line.startsWith('# ')) {
          rendered.push(
            <h1 key={i} className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">
              {renderInline(line.slice(2))}
            </h1>
          );
        } else if (line.startsWith('## ')) {
          rendered.push(
            <h2 key={i} className="text-lg font-semibold text-white mt-5 mb-2">
              {renderInline(line.slice(3))}
            </h2>
          );
        } else if (line.startsWith('### ')) {
          rendered.push(
            <h3 key={i} className="text-md font-semibold text-white mt-4 mb-2">
              {renderInline(line.slice(4))}
            </h3>
          );
        } else if (line === '---') {
          rendered.push(<hr key={i} className="my-4 border-white/10" />);
        } else {
          rendered.push(
            <p key={i} className="text-sm text-white/70 my-1 leading-relaxed">
              {renderInline(line)}
            </p>
          );
        }
      }
    }
  }
  
  if (isInsideTable) {
    flushTable(lines.length);
  }
  
  if (isInsideList) {
    flushList(lines.length);
  }

  return <div className="space-y-1">{rendered}</div>;
};

// ─── Smart Launcher ──────────────────────────────────────────────────────────

interface LauncherItem {
  id: string;
  group: 'navigate' | 'folder' | 'action';
  icon: React.ReactNode;
  label: string;
  description?: string;
  accent?: string;
  onSelect: () => void;
}

function SmartLauncher({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: 'chat' | 'folders' | 'map' | 'settings') => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [folders, setFolders] = useState<{ id: string; name: string; tabs: any[] }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load folders when launcher opens
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 60);
    chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (res) => {
      if (res && Array.isArray(res)) {
        setFolders(res);
      }
    });
  }, [open]);

  const staticItems: LauncherItem[] = [
    {
      id: 'nav-chat',
      group: 'navigate',
      icon: <MessageSquare className="w-4 h-4" />,
      label: 'Chat with Tabs',
      description: 'Open AI workspace chat',
      accent: 'text-blue-400',
      onSelect: () => onNavigate('chat'),
    },
    {
      id: 'nav-folders',
      group: 'navigate',
      icon: <Folder className="w-4 h-4" />,
      label: 'Folders',
      description: 'Manage your workspaces',
      accent: 'text-blue-400',
      onSelect: () => onNavigate('folders'),
    },
    {
      id: 'nav-map',
      group: 'navigate',
      icon: <Network className="w-4 h-4" />,
      label: 'Workspace Map',
      description: 'Visual tab graph',
      accent: 'text-cyan-400',
      onSelect: () => onNavigate('map'),
    },
    {
      id: 'nav-settings',
      group: 'navigate',
      icon: <Settings className="w-4 h-4" />,
      label: 'Preferences',
      description: 'AI provider & API keys',
      accent: 'text-white/50',
      onSelect: () => onNavigate('settings'),
    },
    {
      id: 'action-new-folder',
      group: 'action',
      icon: <Plus className="w-4 h-4" />,
      label: 'New Folder',
      description: 'Create a blank workspace folder',
      accent: 'text-green-400',
      onSelect: () => { onNavigate('folders'); },
    },
    {
      id: 'action-chat-summarize',
      group: 'action',
      icon: <Sparkles className="w-4 h-4" />,
      label: 'Summarize my open tabs',
      description: 'Ask AI to summarize your current workspace',
      accent: 'text-purple-400',
      onSelect: () => { onNavigate('chat'); },
    },
  ];

  const folderItems: LauncherItem[] = folders.map(f => ({
    id: `folder-${f.id}`,
    group: 'folder' as const,
    icon: <Folder className="w-4 h-4" />,
    label: f.name,
    description: `${f.tabs.length} tab${f.tabs.length !== 1 ? 's' : ''}`,
    accent: 'text-blue-400',
    onSelect: () => {
      chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_TABS', sessionId: f.id, target: 'current' });
      onClose();
    },
  }));

  const allItems = [...staticItems, ...folderItems];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      )
    : allItems;

  // Group filtered results
  const groups: { key: LauncherItem['group']; label: string; items: LauncherItem[] }[] = [
    { key: 'navigate' as const, label: 'Navigate', items: filtered.filter(i => i.group === 'navigate') },
    { key: 'folder'   as const, label: 'Open Folder', items: filtered.filter(i => i.group === 'folder') },
    { key: 'action'   as const, label: 'Quick Actions', items: filtered.filter(i => i.group === 'action') },
  ].filter(g => g.items.length > 0);

  // Flat ordered list for keyboard nav
  const flatItems = groups.flatMap(g => g.items);
  const safeIdx = Math.min(selectedIdx, flatItems.length - 1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, flatItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && flatItems[safeIdx]) {
      flatItems[safeIdx].onSelect();
      onClose();
    }
  };

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0); }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl mx-4 bg-[#0d0b18]/98 border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-white/30 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search actions, folders, navigation…"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/25"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-white/30 hover:text-white transition-colors">
                  <XSquare className="w-4 h-4" />
                </button>
              )}
              <kbd className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/25 font-mono shrink-0">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[380px] overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
              {flatItems.length === 0 ? (
                <div className="py-12 text-center text-white/25 text-sm">
                  No results for "<span className="text-white/40">{query}</span>"
                </div>
              ) : (
                groups.map((group, groupIndex) => {
                  const previousItemsCount = groups.slice(0, groupIndex).reduce((sum, g) => sum + g.items.length, 0);
                  return (
                    <div key={group.key}>
                      <div className="px-5 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/25 font-semibold">
                        {group.label}
                      </div>
                      {group.items.map((item, itemIndex) => {
                        const idx = previousItemsCount + itemIndex;
                        const isSelected = idx === safeIdx;
                      return (
                        <button
                          key={item.id}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => { item.onSelect(); onClose(); }}
                          className={`w-full flex items-center gap-3.5 px-5 py-2.5 transition-all text-left ${
                            isSelected
                              ? 'bg-white/[0.06]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-500/20 border border-blue-500/30'
                              : 'bg-white/[0.04] border border-white/[0.06]'
                          } ${item.accent || 'text-white/50'}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white/90 truncate">{item.label}</div>
                            {item.description && (
                              <div className="text-xs text-white/35 truncate mt-0.5">{item.description}</div>
                            )}
                          </div>
                          {isSelected && (
                            <kbd className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/30 font-mono shrink-0">↵</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-white/[0.04] flex items-center gap-4 text-[10px] text-white/20">
              <span className="flex items-center gap-1.5"><kbd className="bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1.5"><kbd className="bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">↵</kbd> select</span>
              <span className="flex items-center gap-1.5"><kbd className="bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">esc</kbd> close</span>
              <span className="ml-auto flex items-center gap-1 opacity-60">
                <Command className="w-3 h-3" /> Smart Launcher
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface FolderSession {
  id: string;
  name: string;
  tabs: { title: string; url: string; favIconUrl?: string }[];
  isLocked?: boolean;
}

interface MapNode {
  id: string;
  x: number;
  y: number;
  type: 'folder' | 'tab';
  label: string;
  color: string;
  parentId?: string;
  url?: string;
  favIconUrl?: string;
  size?: number;
  isLocked?: boolean;
}

function WorkspaceMapView({ showToast }: { showToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void }) {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [similarityMode, setSimilarityMode] = useState(true);
  const [visibleFolderIds, setVisibleFolderIds] = useState<Set<string>>(new Set());
  const [foldersList, setFoldersList] = useState<FolderSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Sidebar Filter & Pagination states
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarPage, setSidebarPage] = useState(1);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Wheel-to-zoom handler
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // Cap the deltaY value to prevent extreme jumps from fast scrolling
    const cappedDeltaY = Math.max(-120, Math.min(120, e.deltaY));
    const factor = Math.exp(-cappedDeltaY * 0.0015);
    setZoom(z => Math.min(3, Math.max(0.3, z * factor)));
  };

  const [isLayoutFrozen, setIsLayoutFrozen] = useState(false);
  const [savedPositions, setSavedPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [expandedMapFolders, setExpandedMapFolders] = useState<Set<string>>(new Set());

  const isLayoutFrozenRef = useRef(isLayoutFrozen);
  const savedPositionsRef = useRef(savedPositions);
  const expandedMapFoldersRef = useRef(expandedMapFolders);

  useEffect(() => { isLayoutFrozenRef.current = isLayoutFrozen; }, [isLayoutFrozen]);
  useEffect(() => { savedPositionsRef.current = savedPositions; }, [savedPositions]);
  useEffect(() => { expandedMapFoldersRef.current = expandedMapFolders; }, [expandedMapFolders]);

  const saveCurrentPositions = async (currentNodes: MapNode[]) => {
    const positions: Record<string, {x: number, y: number}> = {};
    currentNodes.forEach(n => {
      positions[n.id] = { x: n.x, y: n.y };
    });
    setSavedPositions(positions);
    const db = await import('@/storage/db');
    await db.setSetting('map_positions', positions);
  };

  const toggleFreezeLayout = async () => {
    const nextFrozen = !isLayoutFrozen;
    setIsLayoutFrozen(nextFrozen);
    
    const db = await import('@/storage/db');
    await db.setSetting('map_frozen', nextFrozen);
    
    if (nextFrozen) {
      await saveCurrentPositions(nodes);
      showToast('Layout Locked', 'Workspace Map layout positions are now locked.', 'success');
    } else {
      setSavedPositions({});
      await db.setSetting('map_positions', {});
      initializeLayout(foldersList, Array.from(visibleFolderIds), false, {});
      showToast('Layout Unlocked', 'Workspace Map layout positions are now auto-arranged.', 'info');
    }
  };

  const handleFolderClick = (folderId: string) => {
    if (draggedRef.current) return;
    const folderNode = nodes.find(n => n.id === folderId);
    if (folderNode?.isLocked) return;

    const isExpanded = expandedMapFolders.has(folderId);
    if (isExpanded) {
      const nextSet = new Set(expandedMapFolders);
      nextSet.delete(folderId);
      setExpandedMapFolders(nextSet);
      setNodes(prev => prev.filter(n => !(n.type === 'tab' && n.parentId === folderId)));
    }
  };

  const handleFolderDoubleClick = (folderId: string) => {
    const folderNode = nodes.find(n => n.id === folderId);
    if (folderNode?.isLocked) {
      showToast('Folder Locked', 'This folder is locked. Please unlock it in the Folders tab first.', 'error');
      return;
    }

    const isExpanded = expandedMapFolders.has(folderId);
    if (isExpanded) return;

    const nextSet = new Set(expandedMapFolders);
    nextSet.add(folderId);
    setExpandedMapFolders(nextSet);

    // Get the folder node to see its current x, y
    if (!folderNode) return;

    // Expand: Create tab nodes around the folder's current x, y
    const folderData = foldersList.find(f => f.id === folderId);
    if (!folderData) return;

    const tabs = folderData.tabs || [];
    const tabCount = tabs.length;
    const newTabNodes: MapNode[] = [];

    tabs.forEach((tab, j) => {
      const tabId = `${folderId}-tab-${j}`;
      
      // Check if there is already a saved position (in case layout is frozen)
      const savedPos = savedPositionsRef.current[tabId];
      
      const tabRadius = 60;
      const tabAngle = tabCount > 1 ? (2 * Math.PI * j) / tabCount : 0;
      
      const tx = savedPos ? savedPos.x : folderNode.x + tabRadius * Math.cos(tabAngle);
      const ty = savedPos ? savedPos.y : folderNode.y + tabRadius * Math.sin(tabAngle);

      newTabNodes.push({
        id: tabId,
        x: tx,
        y: ty,
        type: 'tab',
        label: tab.title || tab.url,
        color: folderNode.color,
        parentId: folderId,
        url: tab.url,
        favIconUrl: tab.favIconUrl
      });
    });

    setNodes(prev => [...prev, ...newTabNodes]);
  };

  const initializeLayout = (
    folders: FolderSession[], 
    activeIds: string[],
    frozen: boolean = isLayoutFrozenRef.current,
    positions: Record<string, {x: number, y: number}> = savedPositionsRef.current,
    expanded: Set<string> = expandedMapFoldersRef.current
  ) => {
    const initialNodes: MapNode[] = [];
    const activeFolders = folders.filter(f => activeIds.includes(f.id));
    const folderCount = activeFolders.length;
    
    const centerX = 380;
    const centerY = 280;
    const radius = Math.max(170, 80 + folderCount * 9);
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

    activeFolders.forEach((folder, i) => {
      const color = colors[i % colors.length];
      const angle = folderCount > 1 ? (2 * Math.PI * i) / folderCount : 0;
      
      const defaultFx = folderCount > 1 ? centerX + radius * Math.cos(angle) : centerX;
      const defaultFy = folderCount > 1 ? centerY + radius * Math.sin(angle) : centerY;
      
      const fx = (frozen && positions[folder.id]) ? positions[folder.id].x : defaultFx;
      const fy = (frozen && positions[folder.id]) ? positions[folder.id].y : defaultFy;

      initialNodes.push({
        id: folder.id,
        x: fx,
        y: fy,
        type: 'folder',
        label: folder.name,
        color,
        size: 18 + Math.min(folder.tabs.length * 0.8, 12),
        isLocked: folder.isLocked
      });

      const tabs = folder.tabs || [];
      const tabCount = tabs.length;
      const isExpanded = expanded.has(folder.id) && !folder.isLocked;

      if (isExpanded) {
        tabs.forEach((tab: { title: string; url: string; favIconUrl?: string }, j: number) => {
          const tabId = `${folder.id}-tab-${j}`;
          const tabRadius = 60;
          const tabAngle = tabCount > 1 ? (2 * Math.PI * j) / tabCount : 0;
          
          const defaultTx = fx + tabRadius * Math.cos(tabAngle);
          const defaultTy = fy + tabRadius * Math.sin(tabAngle);
          
          const tx = (frozen && positions[tabId]) ? positions[tabId].x : defaultTx;
          const ty = (frozen && positions[tabId]) ? positions[tabId].y : defaultTy;

          initialNodes.push({
            id: tabId,
            x: tx,
            y: ty,
            type: 'tab',
            label: tab.title || tab.url,
            color,
            parentId: folder.id,
            url: tab.url,
            favIconUrl: tab.favIconUrl
          });
        });
      }
    });

    setNodes(initialNodes);
  };

  // Load folders on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, async (res) => {
      setLoading(false);
      if (res && Array.isArray(res)) {
        const typedRes = res as FolderSession[];
        setFoldersList(typedRes);
        const folderIds = typedRes.map((f) => f.id);
        setVisibleFolderIds(new Set(folderIds));
        
        try {
          const db = await import('@/storage/db');
          const isFrozenSetting = await db.getSetting<boolean>('map_frozen', false);
          const positionsSetting = await db.getSetting<Record<string, {x: number, y: number}>>('map_positions', {});
          
          setIsLayoutFrozen(isFrozenSetting);
          setSavedPositions(positionsSetting);
          
          initializeLayout(typedRes, folderIds, isFrozenSetting, positionsSetting, new Set());
        } catch (e) {
          console.error("Error loading map settings:", e);
          initializeLayout(typedRes, folderIds, false, {}, new Set());
        }
      }
    });
  }, []);

  // Update layout when visibility toggled
  const handleToggleFolder = (folderId: string) => {
    const nextSet = new Set(visibleFolderIds);
    if (nextSet.has(folderId)) {
      nextSet.delete(folderId);
    } else {
      nextSet.add(folderId);
    }
    setVisibleFolderIds(nextSet);
    initializeLayout(foldersList, Array.from(nextSet));
  };

  const handleShowAllFolders = () => {
    const allIds = foldersList.map(f => f.id);
    setVisibleFolderIds(new Set(allIds));
    initializeLayout(foldersList, allIds);
  };

  const handleHideAllFolders = () => {
    setVisibleFolderIds(new Set());
    initializeLayout(foldersList, []);
  };

  const draggedRef = useRef(false);

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only respond to left click for dragging
    
    const targetNode = nodes.find(n => n.id === nodeId);
    if (targetNode && targetNode.type === 'folder' && targetNode.isLocked) {
      return;
    }

    e.preventDefault();
    setDraggedNodeId(nodeId);
    draggedRef.current = false;
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only respond to left click for panning
    const target = e.target as SVGElement;
    if (target.tagName === 'svg' || target.tagName === 'line' || target.tagName === 'path') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      if (isLayoutFrozen) {
        setDraggedNodeId(null);
        showToast('Layout Locked', 'Unlock the layout at the top to rearrange nodes.', 'info');
        return;
      }
      draggedRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 800;
      const clickY = ((e.clientY - rect.top) / rect.height) * 600;
      
      const x = (clickX - pan.x) / zoom;
      const y = (clickY - pan.y) / zoom;
      
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          return { ...n, x, y };
        }
        return n;
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = async () => {
    if (draggedNodeId) {
      await saveCurrentPositions(nodes);
      const draggedNode = nodes.find(n => n.id === draggedNodeId);
      if (draggedNode && draggedNode.type === 'tab' && draggedNode.parentId) {
        // Check if dropped near any folder node (excluding its own parent)
        const targetFolder = nodes.find(n => 
          n.type === 'folder' && 
          n.id !== draggedNode.parentId &&
          Math.sqrt(Math.pow(n.x - draggedNode.x, 2) + Math.pow(n.y - draggedNode.y, 2)) < (n.size || 18) + 20
        );

        if (targetFolder) {
          if (targetFolder.isLocked) {
            showToast("Folder Locked", `Cannot move tab. "${targetFolder.label}" is locked.`, "error");
            setDraggedNodeId(null);
            setIsPanning(false);
            initializeLayout(foldersList, Array.from(visibleFolderIds));
            return;
          }

          const tabTitle = draggedNode.label;
          const tabUrl = draggedNode.url || '';
          const sourceFolderId = draggedNode.parentId;
          const destFolderId = targetFolder.id;
          const destFolderName = targetFolder.label;

          try {
            await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                type: 'MOVE_TAB',
                sourceSessionId: sourceFolderId,
                targetSessionId: destFolderId,
                url: tabUrl
              }, (res) => {
                if (res && res.error) reject(new Error(res.error));
                else resolve(res);
              });
            });

            showToast("Tab Moved", `Successfully moved "${tabTitle}" to folder "${destFolderName}".`, "success");

            // Reload folders list and initialize layout
            chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (res) => {
              if (res && Array.isArray(res)) {
                const typedRes = res as FolderSession[];
                setFoldersList(typedRes);
                const activeIds = Array.from(visibleFolderIds);
                initializeLayout(typedRes, activeIds);
              }
            });
          } catch (err) {
            console.error("Failed to move tab:", err);
            showToast("Error", "Could not move tab to folder.", "error");
          }
        }
      }
    }

    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleAutoLayout = async () => {
    const tempNodes = [...nodes];
    const iterations = 80;
    const width = 800;
    const height = 600;
    const center = { x: 400, y: 300 };

    for (let step = 0; step < iterations; step++) {
      // Repulsion between folders
      for (let i = 0; i < tempNodes.length; i++) {
        for (let j = i + 1; j < tempNodes.length; j++) {
          const nA = tempNodes[i];
          const nB = tempNodes[j];

          if (nA.type === 'folder' && nB.type === 'folder') {
            const dx = nA.x - nB.x;
            const dy = nA.y - nB.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            const force = 1200 / distSq;
            if (dist < 220) {
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              nA.x += fx;
              nA.y += fy;
              nB.x -= fx;
              nB.y -= fy;
            }
          }
        }
      }

      // Attraction between tabs and parent folders
      tempNodes.forEach(node => {
        if (node.type === 'tab' && node.parentId) {
          const parent = tempNodes.find(p => p.id === node.parentId);
          if (parent) {
            const dx = parent.x - node.x;
            const dy = parent.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetDist = 60;
            const force = (dist - targetDist) * 0.15;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            node.x += fx;
            node.y += fy;
          }
        }
      });

      // Gravity towards center
      tempNodes.forEach(node => {
        const dx = center.x - node.x;
        const dy = center.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        node.x += (dx / dist) * 0.5;
        node.y += (dy / dist) * 0.5;
        
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });
    }

    setNodes(tempNodes);
    await saveCurrentPositions(tempNodes);
  };

  const handleDoubleClick = (url?: string) => {
    if (url) {
      const safeUrl = sanitizeUrl(url);
      if (!isValidUrl(safeUrl)) {
        showToast('Invalid URL', 'This URL is not allowed for security reasons.', 'error');
        return;
      }
      chrome.tabs.create({ url: safeUrl, active: false }).catch(console.error);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const getHighlightState = (node: MapNode) => {
    if (hoveredNode) {
      if (hoveredNode.id === node.id) return 'highlight';
      
      if (hoveredNode.type === 'folder') {
        if (node.parentId === hoveredNode.id) return 'relevant';
        return 'fade';
      }
      
      if (hoveredNode.type === 'tab') {
        if (node.id === hoveredNode.parentId) return 'relevant';
        if (node.parentId === hoveredNode.parentId) return 'relevant';
        return 'fade';
      }
    }

    if (!query) return 'normal';
    
    const labelMatch = node.label.toLowerCase().includes(query);
    const urlMatch = node.url && node.url.toLowerCase().includes(query);
    
    if (labelMatch || urlMatch) return 'highlight';
    
    if (node.type === 'folder') {
      const childTabs = nodes.filter(n => n.parentId === node.id);
      const anyTabMatch = childTabs.some(t => t.label.toLowerCase().includes(query) || (t.url && t.url.toLowerCase().includes(query)));
      if (anyTabMatch) return 'relevant';
    }
    
    if (node.type === 'tab' && node.parentId) {
      const parent = nodes.find(p => p.id === node.parentId);
      if (parent && parent.label.toLowerCase().includes(query)) return 'relevant';
    }
    
    return 'fade';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/40 text-sm">Building workspace graph...</p>
      </div>
    );
  }

  if (foldersList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-white/5 bg-[#0a0a0a]/40 rounded-3xl text-center">
        <Network className="w-12 h-12 text-white/20 mb-4 animate-pulse" />
        <h3 className="text-lg font-medium text-white mb-2">No Workspaces Found</h3>
        <p className="text-white/40 text-sm max-w-sm mb-6">Create folder workspaces in the Folders tab to visualize them as an interactive graph.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-[260px] bg-[#0c0c0e]/90 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 shrink-0 backdrop-blur-xl shadow-xl shadow-black/40">
        <div>
          <h3 className="text-md font-semibold text-white mb-1.5 flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-400" /> Workspace Map
          </h3>
          <p className="text-xs text-white/40 leading-relaxed">
            Drag nodes to organize them. Double-click tabs to open, or hover for details.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search tabs or folders..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* Toggle Domain Similarity Links */}
        <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-white/90">Domain Similarity Links</span>
            <span className="text-[10px] text-white/40">Connect tabs on same domain</span>
          </div>
          <button
            onClick={() => setSimilarityMode(!similarityMode)}
            className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${similarityMode ? 'bg-cyan-500' : 'bg-white/10'}`}
          >
            <div 
              className="w-3.5 h-3.5 rounded-full bg-black absolute top-0.5 left-0.5 transition-transform duration-200" 
              style={{ transform: similarityMode ? 'translateX(18px)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {/* Folder Selectors */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Visible Workspaces</span>
            {foldersList.length > 1 && (
              <div className="flex items-center gap-1.5 select-none">
                <button 
                  onClick={handleShowAllFolders}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                >
                  All
                </button>
                <span className="text-[10px] text-white/20">/</span>
                <button 
                  onClick={handleHideAllFolders}
                  className="text-[10px] text-white/40 hover:text-white/60 font-medium transition-colors cursor-pointer"
                >
                  None
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Local Search */}
          {foldersList.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Filter list..."
                value={sidebarSearch}
                onChange={e => {
                  setSidebarSearch(e.target.value);
                  setSidebarPage(1);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          )}

          {/* Paginated & Filtered Folder List */}
          {(() => {
            const filtered = foldersList.filter(f => 
              f.name.toLowerCase().includes(sidebarSearch.trim().toLowerCase())
            );
            const itemsPerPage = 10;
            const totalSidebarPages = Math.ceil(filtered.length / itemsPerPage) || 1;
            const activeSidebarPage = Math.max(1, Math.min(sidebarPage, totalSidebarPages));
            const paginated = filtered.slice((activeSidebarPage - 1) * itemsPerPage, activeSidebarPage * itemsPerPage);

            return (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                  {paginated.length === 0 ? (
                    <div className="text-[10px] text-white/30 text-center py-4">No matching workspaces</div>
                  ) : (
                    paginated.map(folder => {
                      const isVisible = visibleFolderIds.has(folder.id);
                      return (
                        <label 
                          key={folder.id} 
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => handleToggleFolder(folder.id)}
                            className="w-3.5 h-3.5 rounded bg-black/40 border-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className="text-xs text-white/80 font-medium truncate select-none">{folder.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Sidebar Pagination Footer */}
                {totalSidebarPages > 1 && (
                  <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-1 select-none shrink-0">
                    <button
                      disabled={activeSidebarPage === 1}
                      onClick={() => setSidebarPage(activeSidebarPage - 1)}
                      className="p-1 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-white/40 font-medium">
                      Page {activeSidebarPage} of {totalSidebarPages}
                    </span>
                    <button
                      disabled={activeSidebarPage === totalSidebarPages}
                      onClick={() => setSidebarPage(activeSidebarPage + 1)}
                      className="p-1 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Interactive Map Visualizer */}
      <div className="flex-1 bg-[#07050f]/80 border border-white/5 rounded-3xl relative overflow-hidden shadow-inner backdrop-blur-md">
        {/* Style block for moving dash animations and custom scrollbar overrides */}
        <style>
          {`
            @keyframes dash {
              to {
                stroke-dashoffset: -20;
              }
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
              margin: 8px 0;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.15);
              border-radius: 9999px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.3);
            }
          `}
        </style>

        <svg
          ref={svgRef}
          viewBox="0 0 800 600"
          className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Connection Lines (Tabs to Folders) */}
            {nodes.filter(n => n.type === 'tab').map(tab => {
              const parent = nodes.find(p => p.id === tab.parentId);
              if (!parent) return null;
              
              const tabState = getHighlightState(tab);
              const parentState = getHighlightState(parent);
              
              let opacity = 0.25;
              if (hoveredNode || query) {
                if (tabState === 'fade' || parentState === 'fade') opacity = 0.05;
                else opacity = 0.45;
              }

              return (
                <line
                  key={`line-${tab.id}`}
                  x1={tab.x}
                  y1={tab.y}
                  x2={parent.x}
                  y2={parent.y}
                  stroke={parent.color}
                  strokeWidth="1.5"
                  strokeOpacity={opacity}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* AI Domain Similarity Lines (Curve paths) */}
            {similarityMode && (() => {
              const tabNodes = nodes.filter(n => n.type === 'tab' && n.url);
              const similarityLines: React.ReactNode[] = [];

              for (let i = 0; i < tabNodes.length; i++) {
                for (let j = i + 1; j < tabNodes.length; j++) {
                  const tabA = tabNodes[i];
                  const tabB = tabNodes[j];
                  
                  if (tabA.parentId !== tabB.parentId && tabA.url && tabB.url) {
                    try {
                      const domainA = new URL(tabA.url).hostname.replace('www.', '');
                      const domainB = new URL(tabB.url).hostname.replace('www.', '');
                      
                      if (domainA === domainB && domainA !== '') {
                        const tabAState = getHighlightState(tabA);
                        const tabBState = getHighlightState(tabB);
                        
                        let opacity = 0.65;
                        if (hoveredNode || query) {
                          if (tabAState === 'fade' || tabBState === 'fade') opacity = 0.05;
                          else opacity = 0.85;
                        }

                        similarityLines.push(
                          <path
                            key={`sim-${tabA.id}-${tabB.id}`}
                            d={`M ${tabA.x} ${tabA.y} Q ${(tabA.x + tabB.x)/2} ${(tabA.y + tabB.y)/2 - 35}, ${tabB.x} ${tabB.y}`}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="1.2"
                            strokeDasharray="4,4"
                            strokeOpacity={opacity}
                            style={{ animation: 'dash 4s linear infinite' }}
                            className="transition-all duration-300"
                          />
                        );
                      }
                    } catch {
                      // Ignore malformed URLs
                    }
                  }
                }
              }
              return similarityLines;
            })()}

            {/* Render Nodes */}
            {nodes.map(node => {
              const highlightState = getHighlightState(node);
              
              let opacity = 1;
              let scale = 1;
              let glow = 'none';

              if (highlightState === 'fade') {
                opacity = 0.2;
                scale = 0.9;
              } else if (highlightState === 'highlight') {
                scale = node.type === 'folder' ? 1.15 : 1.3;
                glow = `0 0 15px ${node.color}`;
              } else if (highlightState === 'relevant') {
                scale = 1.05;
              }

              if (node.type === 'folder') {
                const folderSize = node.size || 18;
                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x}, ${node.y})`}
                    className={node.isLocked ? "cursor-not-allowed transition-transform duration-300" : "cursor-grab active:cursor-grabbing transition-transform duration-300"}
                    style={{ opacity }}
                    onMouseDown={(e) => handleMouseDown(node.id, e)}
                    onClick={(e) => { e.stopPropagation(); handleFolderClick(node.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleFolderDoubleClick(node.id); }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle r={folderSize + 4} fill={node.color} opacity="0.12" style={{ filter: glow !== 'none' ? 'blur(4px)' : 'none' }} />
                    <circle
                      r={folderSize}
                      fill="#0f0e15"
                      stroke={node.color}
                      strokeWidth="2.5"
                      className="transition-all duration-300"
                      style={{ transform: `scale(${scale})` }}
                    />
                    <text
                      y="4"
                      textAnchor="middle"
                      fill="white"
                      fontSize="11"
                      fontWeight="bold"
                      className="pointer-events-none select-none font-sans"
                    >
                      {node.isLocked ? '🔒' : '📁'}
                    </text>
                    <text
                      y={folderSize + 18}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="500"
                      className="pointer-events-none select-none drop-shadow-md bg-black/60 font-sans"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              } else {
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer transition-transform duration-300"
                    style={{ opacity }}
                    onMouseDown={(e) => handleMouseDown(node.id, e)}
                    onDoubleClick={() => handleDoubleClick(node.url)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle r="13" fill={node.color} opacity="0.08" />
                    <circle
                      r="9.5"
                      fill="#15141e"
                      stroke={node.color}
                      strokeWidth="1.5"
                      style={{ transform: `scale(${scale})`, filter: glow !== 'none' ? 'blur(1px)' : 'none' }}
                      className="transition-all duration-300"
                    />
                    {node.favIconUrl && isValidUrl(node.favIconUrl) ? (
                      <image
                        href={node.favIconUrl}
                        x="-6.5"
                        y="-6.5"
                        width="13"
                        height="13"
                        className="rounded pointer-events-none"
                        onError={(event) => {
                          (event.currentTarget as SVGImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <text
                        y="3.5"
                        textAnchor="middle"
                        fill="white"
                        fontSize="9"
                        className="pointer-events-none select-none"
                      >
                        📄
                      </text>
                    )}
                  </g>
                );
              }
            })}
          </g>
        </svg>

        {/* Graph Control Overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0c0c0e]/80 border border-white/5 p-2 rounded-2xl backdrop-blur-xl shadow-lg z-10">
          <button 
            onClick={toggleFreezeLayout}
            className={`flex items-center gap-1.5 border transition-all px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              isLayoutFrozen 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
            title={isLayoutFrozen ? "Unlock Layout positions" : "Freeze current Layout positions"}
          >
            {isLayoutFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isLayoutFrozen ? 'Locked' : 'Lock Layout'}
          </button>

          <button 
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-xs text-white border border-white/10 transition-colors px-3 py-1.5 rounded-xl font-medium cursor-pointer"
            title="Auto-Organize Graph layout"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Organize
          </button>
          
          <div className="w-px h-5 bg-white/10 mx-1" />

          <button 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <span className="text-sm font-semibold select-none">-</span>
          </button>
          <span className="text-[10px] text-white/50 min-w-[36px] text-center select-none font-medium">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <span className="text-sm font-semibold select-none">+</span>
          </button>
          
          <button 
            onClick={() => { 
              setZoom(1); 
              setPan({ x: 0, y: 0 }); 
              initializeLayout(foldersList, Array.from(visibleFolderIds));
            }}
            className="text-[10px] text-white/40 hover:text-white/80 font-medium transition-colors px-2 py-1 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 ml-1 cursor-pointer"
            title="Reset Zoom, Pan & Layout"
          >
            Reset
          </button>
        </div>

        {hoveredNode && (
          <div 
            className="absolute bottom-6 left-6 right-6 bg-[#0b0a12]/90 border border-white/10 rounded-2xl p-4 flex gap-4 backdrop-blur-xl shadow-2xl pointer-events-none transition-all duration-200"
            style={{
              borderColor: hoveredNode.color + '40',
              boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${hoveredNode.color}10`
            }}
          >
            {hoveredNode.type === 'folder' ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <h4 className="text-sm font-semibold text-white">{hoveredNode.label}</h4>
                  <span className="text-[10px] uppercase tracking-wider text-white/40">Workspace Folder</span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  {hoveredNode.favIconUrl ? (
                    <img src={hoveredNode.favIconUrl} className="w-5 h-5 rounded" alt="" />
                  ) : (
                    <span className="text-md">📄</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-white truncate leading-snug">{hoveredNode.label}</h4>
                  <p className="text-[10px] text-white/40 truncate mt-0.5 select-all">{hoveredNode.url}</p>
                  <span 
                    className="inline-block text-[9px] font-semibold mt-2 px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: hoveredNode.color + '20', color: hoveredNode.color }}
                  >
                    Tab in Workspace
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
