import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Command, Sparkles, MessageSquare, Settings, 
  Trash2, Send, User, Bot, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Folder, Clock, Play, Pencil, Share2, Copy, Check, CheckSquare, XSquare, Pin, Star, Search, Download, Upload, Lock, Unlock, Key, AppWindow, Ghost, Info, Eye, EyeOff, Network, Plus, AlertCircle, X, ExternalLink
} from 'lucide-react';
import { sha256 } from '../utils/crypto';
import { sanitizeUrl, isValidUrl, isSameUrl, cleanTabTitle, getCleanDomain, sanitizeTabTitleForTable } from '../utils/url';
import { sanitizeStreamChunk } from '../utils/ai-chat-helper';
import type { WorkspaceSession } from '../storage/db';

const checkIncognitoAllowed = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.extension && typeof chrome.extension.isAllowedIncognitoAccess === 'function') {
        chrome.extension.isAllowedIncognitoAccess((allowed) => resolve(!!allowed));
      } else {
        resolve(true);
      }
    } catch {
      resolve(true);
    }
  });
};

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
          <div className="w-8 h-8 rounded-xl bg-[#EEF4FB] border border-[#425B9A]/30 shadow-[0_2px_10px_rgba(66,91,154,0.35)] flex items-center justify-center p-1 transition-transform hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
              <defs>
                <linearGradient id="dash_hb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2e4070"/><stop offset="100%" stopColor="#425B9A"/></linearGradient>
                <linearGradient id="dash_hm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#76C0EC"/><stop offset="100%" stopColor="#55aee0"/></linearGradient>
                <linearGradient id="dash_hf" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#425B9A"/><stop offset="100%" stopColor="#5470b8"/></linearGradient>
              </defs>
              <rect x="4" y="16" width="42" height="12" rx="4" fill="url(#dash_hb)"/>
              <rect x="7" y="26" width="42" height="12" rx="4" fill="url(#dash_hm)"/>
              <rect x="10" y="36" width="42" height="12" rx="4" fill="url(#dash_hf)"/>
              <circle cx="18" cy="42" r="2.2" fill="#FF5F57"/>
              <circle cx="24.5" cy="42" r="2.2" fill="#FEBC2E"/>
              <circle cx="31" cy="42" r="2.2" fill="#28C840"/>
            </svg>
          </div>
          <span className="font-semibold tracking-wide text-base text-white">Tabflow</span>
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
        <div id="main-scroll-container" className="flex-1 overflow-y-auto px-10 pt-8 pb-5">
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

      {/* Global Modern Professional Toast Notification (Strictly One Line) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] sm:max-w-[540px] flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#0c111c]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)]"
          >
            {toastMessage.type === 'error' && (
              <div className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
                {(toastMessage.title.toLowerCase().includes('delete') || 
                  toastMessage.title.toLowerCase().includes('remove')) ? (
                  <Trash2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
              </div>
            )}
            {toastMessage.type === 'success' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <Check className="w-3 h-3" />
              </div>
            )}
            {toastMessage.type === 'info' && (
              <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                <Info className="w-3 h-3" />
              </div>
            )}
            
            <div className="flex items-center gap-1.5 min-w-0 text-xs whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-white tracking-tight shrink-0">{toastMessage.title}</span>
              {toastMessage.description && (
                <>
                  <span className="text-white/25 shrink-0">•</span>
                  <span className="text-white/60 truncate max-w-[320px]">{toastMessage.description}</span>
                </>
              )}
            </div>

            <button 
              onClick={() => setToastMessage(null)} 
              className="w-5 h-5 rounded-full text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ml-0.5"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
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
          const cleanChunk = sanitizeStreamChunk(msg.text || '');
          if (cleanChunk) {
            receivedText += cleanChunk;
            setMessages(prev => {
              const copy = [...prev];
              if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                copy[copy.length - 1] = { role: 'assistant', content: receivedText };
              }
              return copy;
            });
          }
        } else if (msg.type === 'DONE') {
          const finalClean = sanitizeStreamChunk(msg.fullText || receivedText);
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: finalClean };
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
    <div className="h-[calc(100vh-6rem)] flex flex-col pb-1">
      {/* Top Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1.5">Workspace Chat</h2>
          <p className="text-white/60 font-medium text-sm">Converse with your currently open tabs and trigger actions.</p>
        </div>
        {messages.length > 0 && (
          <button 
            onClick={handleClear}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-medium text-red-600 transition-all flex items-center gap-2 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Main Chat Area - Seamless without outer box */}
      <div className="flex-1 flex flex-col min-h-0 relative group">
        {/* Floating Scroll Arrows */}
        {messages.length > 0 && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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

        <div ref={containerRef} className="flex-1 overflow-y-auto mb-3 pl-1 pr-8 space-y-6 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center w-full max-w-2xl mx-auto py-12">
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-400 animate-pulse">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">Ask your Workspace Assistant</h3>
              <p className="text-center text-white/40 text-sm font-normal leading-relaxed mb-8">
                I can help you navigate, search the web, analyze your tabs, or manage your workspace.
              </p>
              
              <div className="w-full max-w-lg space-y-3">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAsk(s.text)}
                    className="w-full text-left p-4 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-blue-500/40 rounded-2xl transition-all duration-200 group flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{s.text}</div>
                      <div className="text-xs text-white/50 font-normal mt-0.5">{s.desc}</div>
                    </div>
                    <Send className="w-4 h-4 text-white/30 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto w-full">
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
        <div className="relative flex items-center gap-3 shrink-0 pt-3 pb-3">
          <div className="relative flex-1 max-w-3xl mx-auto w-full">
            <input 
              type="text" 
              className="os-input w-full pr-14 pl-5 bg-[#0a0f1d]/90 border border-white/12 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all rounded-2xl h-14 text-sm text-white placeholder:text-white/35 backdrop-blur-xl shadow-2xl" 
              placeholder="Ask a question or request an action (e.g. 'open youtube and play a song')..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
            />
            <button 
              className="absolute right-2.5 top-2.5 p-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-white rounded-xl disabled:opacity-40 disabled:scale-100 cursor-pointer"
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
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            {/* Modal Content - Streamlined One-Line Layout */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="relative w-auto max-w-2xl sm:max-w-3xl overflow-hidden rounded-2xl border border-red-500/25 bg-[#0e121a]/95 backdrop-blur-xl px-4.5 py-3 shadow-2xl shadow-black/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0 text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-white whitespace-nowrap">Clear Chat History?</span>
                  <span className="text-xs text-white/50 whitespace-nowrap">Permanently deletes your entire conversation history.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button 
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setShowConfirm(false);
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] rounded-lg text-xs font-semibold text-white shadow-md shadow-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
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
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setPendingCommands([])}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/90 flex flex-col"
            >
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 border border-blue-500/25">
                    <Command className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight leading-tight">Confirm Action{pendingCommands.length > 1 ? 's' : ''}</h3>
                    <p className="text-[11px] text-white/50 leading-tight mt-0.5">Assistant requested permission to run</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPendingCommands([])}
                  className="w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 scrollbar-hide max-h-[48vh] pr-0.5">
                {pendingCommands.map((cmd, idx) => {
                  const label = cmd.type === 'OPEN_TAB' ? 'Open Tab'
                    : cmd.type === 'CLOSE_TAB' || cmd.type === 'DELETE_TAB' ? 'Close Tab'
                    : cmd.type === 'MOVE_TAB' ? 'Move Tab'
                    : cmd.type === 'COPY_TAB' ? 'Duplicate Tab'
                    : cmd.type === 'ADD_TAB' ? 'Save Tab'
                    : cmd.type === 'DELETE_FOLDER' ? 'Delete Workspace'
                    : cmd.type === 'RENAME_FOLDER' ? 'Rename Workspace'
                    : cmd.type === 'RESTORE_FOLDER' ? 'Open Workspace'
                    : cmd.type === 'LOCK_FOLDER' ? 'Lock Workspace'
                    : cmd.type === 'SCHEDULE_FOLDER' ? 'Schedule Workspace'
                    : cmd.type === 'EDIT_TAB' || cmd.type === 'RENAME_TAB' ? 'Edit Tab'
                    : cmd.type.replace(/_/g, ' ');

                  return (
                    <div key={idx} className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/25 uppercase">
                          {label}
                        </span>
                        <span className="text-[10px] text-white/30 font-mono">#{idx + 1}</span>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(cmd.args).map(([k, v]) => (
                          <div key={k} className="flex items-start gap-2 bg-black/30 rounded-lg px-2.5 py-1.5 border border-white/[0.04]">
                            <span className="text-white/40 text-[10px] uppercase font-semibold shrink-0 pt-0.5">{k}:</span>
                            <span className="text-xs text-white/90 font-mono break-all selection:bg-blue-500/30">{v as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-end gap-2 shrink-0 pt-2 border-t border-white/[0.08]">
                <button 
                  onClick={() => setPendingCommands([])} 
                  className="px-3.5 py-1.5 hover:bg-white/5 text-white/70 hover:text-white rounded-lg text-xs font-medium transition-all"
                >
                  Reject
                </button>
                <button 
                  onClick={() => {
                    const count = pendingCommands.length;
                    chrome.runtime.sendMessage({ type: 'EXECUTE_CONFIRMED_COMMANDS', commands: pendingCommands }, () => {
                      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' });
                    });
                    setPendingCommands([]);
                    setMessages(prev => [
                      ...prev,
                      {
                        role: 'assistant',
                        content: `✅ Successfully executed **${count}** workspace action${count > 1 ? 's' : ''}! Workspace folders have been updated.`
                      }
                    ]);
                  }} 
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve & Execute</span>
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
    showToast('Preferences Saved', 'AI configuration and local settings have been updated.', 'success');
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
            Leave blank to use defaults (gemini-2.0-flash, gpt-4o-mini).
          </p>
          <input 
            type="text" 
            className="os-input bg-[#0a0a0a]" 
            placeholder="e.g. gemini-2.0-flash, anthropic/claude-3.5-sonnet" 
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

  const [folderTabSearches, setFolderTabSearches] = useState<Record<string, string>>({});
  const [tabsPerPage, setTabsPerPage] = useState(() => {
    const saved = localStorage.getItem('tabflow_tabs_per_page');
    return saved ? Number(saved) : 10;
  });
  const [folderTabPages, setFolderTabPages] = useState<Record<string, number>>({});

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showAddTabModal, setShowAddTabModal] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [openTabsForModal, setOpenTabsForModal] = useState<Array<{ id?: number; title?: string; url?: string; favIconUrl?: string }>>([]);

  useEffect(() => {
    if (showAddTabModal) {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          const valid = tabs.filter(t => t.url && isValidUrl(t.url) && !t.url.startsWith('chrome'));
          setOpenTabsForModal(valid);
        }).catch(() => {
          setOpenTabsForModal([]);
        });
      } else {
        setOpenTabsForModal([]);
      }
    } else {
      setOpenTabsForModal([]);
    }
  }, [showAddTabModal]);

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
          showToast('Recovery Verified', 'Security verification successful. Please set your new password.', 'success');
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
            showToast('Password Reset', 'Folder password updated and unlocked successfully.', 'success');
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
          setExpandedFolder(showUnlockModal.id);
          setShowUnlockModal(null);
          showToast('Folder Unlocked', `Successfully unlocked "${showUnlockModal.name}".`, 'success');
        }
      });
    }
  };

  const hasAutoLocked = useRef(false);
  const initialFolderCheckedRef = useRef(false);

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

        if (!initialFolderCheckedRef.current) {
          initialFolderCheckedRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const targetFolderId = params.get('folder');
          if (targetFolderId) {
            const target = sessions.find(s => s.id === targetFolderId);
            if (target) {
              if (target.isLocked) {
                setShowUnlockModal(target);
                setUnlockPassword('');
                setRecoveryWordInput('');
                setUnlockError('');
                setIsRecoveryMode(null);
                setShowUnlockPassword(false);
                setShowRecoveryNewPassword(false);
              } else {
                setExpandedFolder(target.id);
              }
            }
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('folder');
            window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));
          }
        }
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

    const handleFocus = () => loadFolders();
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadFolders();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => loadFolders(), 20000);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
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
    const url = sanitizeUrl(newTabUrl.trim());
    if (!isValidUrl(url)) {
      showToast('Invalid URL', 'Please enter a valid website address.', 'error');
      return;
    }
    const title = cleanTabTitle(newTabName.trim() || url);
    chrome.runtime.sendMessage({
      type: 'ADD_TAB_TO_FOLDER',
      sessionId: showAddTabModal,
      tab: { title, url }
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

  const handleAddSpecificOpenTab = (tab: { title?: string; url?: string; favIconUrl?: string }) => {
    if (!showAddTabModal || !tab.url) return;
    const url = sanitizeUrl(tab.url);
    if (!isValidUrl(url)) {
      showToast('Invalid URL', 'This tab URL is not valid.', 'error');
      return;
    }
    const title = cleanTabTitle(tab.title || url);
    chrome.runtime.sendMessage({
      type: 'ADD_TAB_TO_FOLDER',
      sessionId: showAddTabModal,
      tab: { title, url, favIconUrl: tab.favIconUrl }
    }, (response) => {
      loadFolders();
      if (response && response.added === false) {
        showToast('Tab Already Exists', 'This tab is already in the folder.', 'info');
      } else {
        showToast('Tab Added', `Added "${title}" to folder.`, 'success');
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
    const finalUrl = sanitizeUrl(url.trim());
    if (!isValidUrl(finalUrl)) {
      showToast('Invalid URL', 'Please enter a valid website address.', 'error');
      return;
    }
    chrome.runtime.sendMessage({
      type: 'EDIT_TAB_IN_FOLDER',
      sessionId,
      url: oldUrl,
      newTitle: cleanTabTitle(title.trim()),
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

  const generateLocalWorkspaceSummary = (folderName: string, tabs: any[]): string => {
    const getCategory = (url: string, title: string): string => {
      const lower = (url + ' ' + title).toLowerCase();
      if (lower.includes('chatgpt') || lower.includes('gemini') || lower.includes('claude') || lower.includes('openrouter') || lower.includes('perplexity') || lower.includes('ai')) return 'AI Assistant';
      if (lower.includes('youtube') || lower.includes('spotify') || lower.includes('music') || lower.includes('video') || lower.includes('netflix') || lower.includes('twitch')) return 'Video & Media';
      if (lower.includes('github') || lower.includes('gitlab') || lower.includes('vercel') || lower.includes('stackoverflow') || lower.includes('apify') || lower.includes('console.')) return 'Developer Tools';
      if (lower.includes('linkedin') || lower.includes('twitter') || lower.includes('x.com') || lower.includes('reddit') || lower.includes('facebook') || lower.includes('instagram')) return 'Social & Networking';
      if (lower.includes('keep') || lower.includes('notion') || lower.includes('docs.google') || lower.includes('sheets.google') || lower.includes('apollo') || lower.includes('drive.google')) return 'Productivity';
      if (lower.includes('colorhunt') || lower.includes('figma') || lower.includes('dribbble') || lower.includes('behance')) return 'Design & Creative';
      return 'Web Resource';
    };

    const rows = tabs.map(t => {
      const cleanTitle = sanitizeTabTitleForTable(t.title);
      const cat = getCategory(t.url, cleanTitle);
      const domain = getCleanDomain(t.url);
      const desc = `Access and manage ${domain || cleanTitle} resources for ${folderName.toLowerCase()} activities.`;
      return `| [${cleanTitle}](${t.url}) | ${cat} | ${desc} |`;
    }).join('\n');

    return `### ${folderName} Workspace Summary

This curated workspace brings together ${tabs.length} essential tools and resources organized for streamlined workflow execution and productive browsing.

| Resource | Category | Purpose & Overview |
|---|---|---|
${rows}`;
  };

  const generateShareableWorkspace = async () => {
    if (!showShareModal) return;
    setIsGeneratingShare(true);
    setShareCopied(false);
    setShareLink('');

    try {
      const selectedTabs = showShareModal.tabs.filter(t => selectedShareTabs.has(t.url));
      if (selectedTabs.length === 0) throw new Error("No tabs selected to share.");
      
      const tabsList = selectedTabs.map((t: any, i: number) => {
        const cleanTitle = sanitizeTabTitleForTable(t.title);
        const domain = getCleanDomain(t.url);
        return `${i + 1}. Title: "${cleanTitle}", Domain: ${domain}, URL: ${t.url}`;
      }).join('\n');

      const prompt = `You are an expert executive research assistant. Create a polished, professional Markdown workspace summary for the folder named '${showShareModal.folderName}' containing these tabs:

${tabsList}

Generate a clear, high-quality document with:
1. A concise overview paragraph (2-3 sentences) summarizing what this workspace is for and how these resources fit together.
2. An elegant Markdown table with EXACTLY these 3 columns:
| Resource | Category | Purpose & Overview |
|---|---|---|

Strict Table Formatting Requirements:
- "Resource" column: Clean name of the service/page formatted as a markdown link: [Clean Name](URL). Never put raw unlinked URLs here. Do not include notification badges or pipe characters in the name.
- "Category" column: A concise 1-3 word category (e.g., "AI Assistant", "Social & Networking", "Video & Media", "Productivity", "Developer Tools", "Design").
- "Purpose & Overview" column: An articulate, informative 1-2 sentence description explaining what the resource does and why it is useful in this workspace. Make the description insightful, professional, and clear.
- Do NOT output a separate "Domain" or "URL" column with long raw URLs.
- NEVER use pipe symbols '|' inside any cell content. If needed, use a hyphen '-' or colon ':'.
- Exactly 3 columns per row. Do not add extra columns or trailing pipes.
- Output ONLY the clean Markdown text without wrapping codeblocks (no \`\`\`markdown).`;

      let markdown = '';
      try {
        markdown = await import('../ai/llm').then(m => m.callLLM(prompt));
        if (markdown.startsWith('```markdown')) {
          markdown = markdown.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '').trim();
        } else if (markdown.startsWith('```md')) {
          markdown = markdown.replace(/^```md\s*/i, '').replace(/```\s*$/, '').trim();
        } else if (markdown.startsWith('```') && markdown.endsWith('```')) {
          markdown = markdown.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
        }
      } catch (err: any) {
        console.warn("LLM summary generation failed, using structured local summary:", err);
        markdown = generateLocalWorkspaceSummary(showShareModal.folderName, selectedTabs);
      }

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
        showToast('Action Failed', response.error, 'error');
      } else if (response && response.validCount === 0) {
        showToast('No Active Tabs', 'No open tabs were found in this browser window.', 'info');
      } else if (response && response.addedCount === 0) {
        showToast('Tabs Already Saved', 'All open tabs already exist in this workspace folder.', 'info');
      } else if (response) {
        const count = typeof response.addedCount === 'number' ? response.addedCount : 1;
        showToast(`${count} Tab${count === 1 ? '' : 's'} Saved`, `Successfully saved ${count} tab${count === 1 ? '' : 's'} to this workspace.`, 'success');
      }
    });
  };

  const openTimer = (folder: any, tabUrl?: string) => {
    const target = tabUrl ? folder.tabs?.find((t: any) => t.url === tabUrl) : folder;
    const now = Date.now();
    setOpenTimerDates(target?.scheduledOpenTimes ? target.scheduledOpenTimes.filter((t: number) => t > now).map((t: number) => new Date(t)) : []);
    setCloseTimerDates(target?.scheduledCloseTimes ? target.scheduledCloseTimes.filter((t: number) => t > now).map((t: number) => new Date(t)) : []);
    setTimerAction('close');
    setShowTimerModal({ sessionId: folder.id, type: tabUrl ? 'tab' : 'folder', url: tabUrl });
  };

  const submitTimer = (remove = false) => {
    if (!showTimerModal) return;
    
    let openTimes: number[] = [];
    let closeTimes: number[] = [];

    if (!remove) {
      const now = Date.now();
      openTimes = openTimerDates.map(d => d.getTime()).filter(t => t > now);
      closeTimes = closeTimerDates.map(d => d.getTime()).filter(t => t > now);
      
      const hadPastOpen = openTimerDates.some(d => d.getTime() <= now);
      const hadPastClose = closeTimerDates.some(d => d.getTime() <= now);
      if (hadPastOpen || hadPastClose) {
        showToast('Past Times Excluded', 'Times that already passed were excluded. Only future times are scheduled.', 'info');
      }

      if (openTimes.length === 0 && closeTimes.length === 0 && (openTimerDates.length > 0 || closeTimerDates.length > 0)) {
        showToast('Invalid Time', 'All selected times are in the past. Please select a future date and time.', 'error');
        return;
      }
    }

    const payload = {
      sessionId: showTimerModal.sessionId,
      ...(showTimerModal.url ? { url: showTimerModal.url } : {}),
    };
    const messageType = showTimerModal.type === 'folder' ? 'SET_FOLDER_TIMER' : 'SET_TAB_TIMER';

    chrome.runtime.sendMessage({
      type: messageType,
      ...payload,
      action: 'open',
      times: openTimes
    }, () => {
      chrome.runtime.sendMessage({
        type: messageType,
        ...payload,
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
          showToast('Schedule Saved', `Successfully saved schedule (${openTimes.length} open, ${closeTimes.length} close).`, 'success');
        }
      });
    });
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
        showToast('Tab Removed', 'The tab has been removed from this workspace folder.', 'error');
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', sessionId: showDeleteModal.sessionId }, (response) => {
        if (response?.error) {
          showToast('Error', response.error, 'error');
          return;
        }
        loadFolders();
        setShowDeleteModal(null);
        showToast('Folder Deleted', 'The workspace folder and its contents have been permanently deleted.', 'error');
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
        `${ids.length} workspace folder${ids.length > 1 ? 's have' : ' has'} been permanently deleted.`,
        'error'
      );
    }
    setSelectedFolderIds(new Set());
    setIsSelectMode(false);
  };


  const openFolderTabs = async (folder: any, target: 'current' | 'new' | 'incognito' = 'current') => {
    if (folder.isLocked) {
      showToast('Folder Locked', `"${folder.name || 'Folder'}" is locked. Unlock to use it.`, 'info');
      return;
    }
    
    if (target === 'incognito') {
      const allowed = await checkIncognitoAllowed();
      if (!allowed) {
        showToast('Incognito Access Required', 'Please enable "Allow in Incognito" in chrome://extensions for Tabflow to open private tabs.', 'error');
        return;
      }
    }
    
    chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_TABS', sessionId: folder.id, target }, (response) => {
      if (response && response.success) {
        if (response.openedCount > 0) {
          showToast(
            target === 'incognito' ? 'Incognito Tabs Opened' : target === 'new' ? 'New Window Created' : 'Tabs Opened',
            `Opened ${response.openedCount} tab${response.openedCount > 1 ? 's' : ''} in ${target === 'incognito' ? 'incognito' : target === 'new' ? 'a new window' : 'your browser'}.`,
            'success'
          );
        } else {
          showToast('Tabs Already Active', 'All tabs in this folder are already active in your browser window.', 'info');
        }
      } else {
        showToast('Action Failed', response?.error || 'Failed to open workspace tabs. Please try again.', 'error');
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
      showToast('Folder Locked', `"${folder.name || 'Folder'}" is locked. Unlock to use it.`, 'info');
      return;
    }
    chrome.runtime.sendMessage({ type: 'CLOSE_FOLDER_TABS', sessionId: folder.id }, (response) => {
      if (response && response.success) {
        if (response.closedCount === 0) {
          showToast('No Active Tabs', `None of the tabs from "${folder.name}" are currently open in your browser.`, 'info');
        } else if (response.allowedIncognito === false) {
          showToast('Tabs Closed', `Closed ${response.closedCount} open tab${response.closedCount > 1 ? 's' : ''}. Enable "Allow in Incognito" to close private tabs.`, 'info');
        } else {
          showToast('Tabs Closed', `Closed ${response.closedCount} open tab${response.closedCount > 1 ? 's' : ''} from "${folder.name}".`, 'info');
        }
      } else {
        showToast('Action Failed', response?.error || 'Could not close workspace tabs.', 'error');
      }
    });
  };

  const openTab = async (
    url: string, 
    mode: 'current' | 'new_tab' | 'new_window' | 'new' | 'incognito' = 'new_tab', 
    tabTitle?: string
  ) => {
    url = sanitizeUrl(url);
    if (!isValidUrl(url)) {
      showToast('Restricted URL', 'This system URL cannot be opened for browser security reasons.', 'error');
      return;
    }

    if (mode === 'incognito') {
      const isAllowed = await checkIncognitoAllowed();
      if (!isAllowed) {
        showToast('Incognito Access Required', 'Please enable "Allow in Incognito" in chrome://extensions for Tabflow.', 'error');
        try {
          if (typeof chrome !== 'undefined' && chrome.windows?.create) {
            await chrome.windows.create({ url, incognito: true, focused: true });
            showToast('Incognito Window Opened', 'Opened tab in private incognito window.', 'success');
            return;
          }
        } catch {}
        window.open(url, '_blank');
        return;
      }
      try {
        if (typeof chrome !== 'undefined' && chrome.windows?.create) {
          await chrome.windows.create({ url, incognito: true, focused: true });
          showToast('Incognito Window Opened', 'Opened tab in private incognito window.', 'success');
        } else {
          window.open(url, '_blank');
          showToast('Opened', 'Opened URL in private mode.', 'success');
        }
      } catch (err: any) {
        console.warn('Failed to open incognito window:', err);
        try {
          window.open(url, '_blank');
          showToast('Tab Opened', 'Could not open private window; opened standard window instead.', 'info');
        } catch {
          showToast('Action Failed', 'Could not open tab.', 'error');
        }
      }
      return;
    }

    if (mode === 'new' || mode === 'new_window') {
      try {
        if (typeof chrome !== 'undefined' && chrome.windows?.create) {
          await chrome.windows.create({ url, focused: true });
        } else {
          window.open(url, '_blank');
        }
        showToast('Window Created', 'Opened tab in a new browser window.', 'success');
      } catch {
        window.open(url, '_blank');
        showToast('Window Created', 'Opened tab in a new window.', 'success');
      }
      return;
    }

    if (mode === 'new_tab') {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          await chrome.tabs.create({ url, active: true, ...(tabTitle ? { title: tabTitle } : {}) } as any);
        } else {
          window.open(url, '_blank');
        }
        showToast('Tab Opened', 'Opened in a new browser tab.', 'success');
      } catch {
        window.open(url, '_blank');
        showToast('Tab Opened', 'Opened in a new browser tab.', 'success');
      }
      return;
    }

    // Default / 'current': switch to existing tab if already open, else create new tab
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const openTabs = await chrome.tabs.query({});
        const existingTab = openTabs.find(t => t.url && isSameUrl(t.url, url));
        if (existingTab && existingTab.id) {
          if (existingTab.windowId && chrome.windows?.update) {
            await chrome.windows.update(existingTab.windowId, { focused: true });
          }
          await chrome.tabs.update(existingTab.id, { active: true });
          showToast('Tab Focused', 'Switched focus to already open tab.', 'info');
          return;
        }
      }
    } catch {}

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        await chrome.tabs.create({ url, active: true, ...(tabTitle ? { title: tabTitle } : {}) } as any);
      } else {
        window.open(url, '_blank');
      }
      showToast('Tab Opened', 'Opened tab in your browser.', 'success');
    } catch {
      window.open(url, '_blank');
      showToast('Tab Opened', 'Opened tab in your browser.', 'success');
    }
  };

  const closeTab = (url: string) => {
    chrome.tabs.query({}, (openTabs) => {
      const matchingTabs = openTabs.filter(t => t.url && isSameUrl(t.url, url));
      if (matchingTabs.length > 0) {
        const ids = matchingTabs.map(t => t.id!).filter(Boolean);
        chrome.tabs.remove(ids, () => {
          showToast('Tab Closed', `Closed ${ids.length} active tab${ids.length > 1 ? 's' : ''}.`, 'info');
        });
      } else {
        showToast('Tab Inactive', 'This tab is not currently open in any browser window.', 'info');
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
        if (selectedExportFolders.has(f.id) && (!f.tabs || f.tabs.length === 0 || f.tabs.every((t: any) => selectedExportTabs.has(`${f.id}_${t.url}`)))) {
          exportedFolder.tabs = f.tabs || [];
        } else {
          exportedFolder.tabs = (f.tabs || []).filter((t: any) => selectedExportTabs.has(`${f.id}_${t.url}`));
        }
        delete exportedFolder.scheduledOpenTimes;
        delete exportedFolder.scheduledCloseTimes;
        delete exportedFolder.password;
        delete exportedFolder.recoveryWord;
        exportedFolder.tabs = (exportedFolder.tabs || []).map((t: any) => {
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
    showToast('Folders Exported', `Successfully downloaded ${exportData.length} folder${exportData.length !== 1 ? 's' : ''} as a JSON file.`, 'success');
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
        let count = 0;
        for (const folder of json) {
          if (!folder.name) continue;
          const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ws-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
          const newFolder: WorkspaceSession = {
            id: newId,
            name: folder.name,
            timestamp: Date.now() + count,
            isPinned: false,
            isLocked: false,
            contextSummary: folder.contextSummary || 'Imported folder',
            tabs: (folder.tabs || []).map((t: any) => ({
              url: sanitizeUrl(t.url),
              title: cleanTabTitle(t.title || t.url),
              favIconUrl: t.favIconUrl || (t.url ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(t.url)}&sz=32` : undefined),
              isStarred: !!t.isStarred
            }))
          };
          delete newFolder.password;
          delete newFolder.recoveryWord;
          delete newFolder.scheduledOpenTimes;
          delete newFolder.scheduledCloseTimes;
          await db.saveSession(newFolder);
          count++;
        }
        loadFolders();
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
        showToast('Import Successful', `Successfully imported ${count} folder${count !== 1 ? 's' : ''} into your workspace.`, 'success');
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

  const hasAnyPinned = folders.some(f => f.isPinned);
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filteredFolders = folders
    .filter(f => {
      if (!trimmedSearch) return true;
      const matchName = f.name.toLowerCase().includes(trimmedSearch);
      const matchTabs = (f.tabs || []).some((tab: any) =>
        (tab.title || '').toLowerCase().includes(trimmedSearch) ||
        (tab.url || '').toLowerCase().includes(trimmedSearch)
      );
      return matchName || matchTabs;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const result = a.name.localeCompare(b.name);
      return sortDesc ? -result : result;
    });

  const totalFolders = filteredFolders.length;
  const totalPages = Math.ceil(totalFolders / foldersPerPage);
  const activePage = Math.max(1, Math.min(folderPage, totalPages || 1));
  const paginatedFolders = filteredFolders.slice((activePage - 1) * foldersPerPage, activePage * foldersPerPage);

  const pinnedOnPage = paginatedFolders.filter(f => f.isPinned);
  const unpinnedOnPage = paginatedFolders.filter(f => !f.isPinned);

  const renderFolderList = (list: any[]) => {
    if (list.length === 0) return null;
    return list.map(folder => {
      // Filter tabs in folder based on local tab search query or global tab search
      const localQuery = (folderTabSearches[folder.id] || '').trim().toLowerCase();
      const activeTabFilter = localQuery || (trimmedSearch && !folder.name.toLowerCase().includes(trimmedSearch) ? trimmedSearch : '');
      const matchingTabs = [...(folder.tabs || [])].filter((tab: any) => {
        if (!activeTabFilter) return true;
        return (tab.title || '').toLowerCase().includes(activeTabFilter) || (tab.url || '').toLowerCase().includes(activeTabFilter);
      });

      // Sort matching tabs (starred first)
      const sortedTabs = matchingTabs.sort((a: any, b: any) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return 0;
      });

      // Paginate tabs inside folder
      const currentTabPage = folderTabPages[folder.id] || 1;
      const totalTabPages = Math.ceil(matchingTabs.length / tabsPerPage);
      const activeTabPage = Math.max(1, Math.min(currentTabPage, totalTabPages || 1));
      const visibleTabs = sortedTabs.slice((activeTabPage - 1) * tabsPerPage, activeTabPage * tabsPerPage);

      return (
        <div key={folder.id} className="border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] rounded-xl px-4 py-2.5 hover:border-white/[0.15] transition-all mb-2.5 shadow-sm">
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
              } else {
                setShowUnlockModal(folder);
                setUnlockPassword('');
                setRecoveryWordInput('');
                setUnlockError('');
                setIsRecoveryMode(null);
                setShowUnlockPassword(false);
                setShowRecoveryNewPassword(false);
              }
            }}
          >
            <div className="flex flex-col gap-1 flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2.5">
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
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedFolderIds.has(folder.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20 bg-black/20'}`}>
                      {selectedFolderIds.has(folder.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                )}
                <Folder className="w-4 h-4 text-accent-blue shrink-0" />
                {editingFolder?.id === folder.id ? (
                  <input
                    autoFocus
                    className="bg-transparent border-b border-accent-purple font-medium text-white outline-none text-sm"
                    value={editingFolder?.name || ''}
                    onChange={(e) => editingFolder && setEditingFolder({ ...editingFolder, name: e.target.value })}
                    onBlur={submitRenameFolder}
                    onKeyDown={(e) => e.key === 'Enter' && submitRenameFolder()}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="font-medium text-white truncate min-w-0 text-sm">{folder.name}</span>
                )}
                <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">{folder.tabs?.length} tabs</span>
                {trimmedSearch && !folder.name.toLowerCase().includes(trimmedSearch) && (
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                    Matches tab
                  </span>
                )}
              </div>
              
              {((folder.scheduledOpenTimes && folder.scheduledOpenTimes.length > 0) || (folder.scheduledCloseTimes && folder.scheduledCloseTimes.length > 0)) && (
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {folder.scheduledOpenTimes && folder.scheduledOpenTimes.length > 0 && (
                    <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5 animate-[spin_4s_linear_infinite]" />
                      Opens {folder.scheduledOpenTimes.length > 1 ? `on ${folder.scheduledOpenTimes.length} dates` : `${new Date(folder.scheduledOpenTimes[0]).toLocaleDateString()} ${new Date(folder.scheduledOpenTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                    </span>
                  )}
                  {folder.scheduledCloseTimes && folder.scheduledCloseTimes.length > 0 && (
                    <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5 animate-[spin_4s_linear_infinite]" />
                      Closes {folder.scheduledCloseTimes.length > 1 ? `on ${folder.scheduledCloseTimes.length} dates` : `${new Date(folder.scheduledCloseTimes[0]).toLocaleDateString()} ${new Date(folder.scheduledCloseTimes[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {!isSelectMode && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Tooltip content={folder.isPinned ? "Unpin Folder" : "Pin Folder"}><button onClick={(e) => { e.stopPropagation(); togglePinFolder(folder.id); }} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${folder.isPinned ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}>
                  <Pin className={`w-3.5 h-3.5 ${folder.isPinned ? 'fill-current' : ''}`} />
                </button></Tooltip>
                
                {folder.isLocked ? (
                  <>
                    <Tooltip content="Unlock Folder"><button onClick={(e) => { e.stopPropagation(); setShowUnlockModal(folder); setUnlockPassword(''); setRecoveryWordInput(''); setUnlockError(''); setIsRecoveryMode(null); setShowUnlockPassword(false); setShowRecoveryNewPassword(false); }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                      <Lock className="w-3.5 h-3.5 text-red-400" />
                    </button></Tooltip>
                    <Tooltip content="Delete Folder"><button onClick={(e) => { e.stopPropagation(); setShowDeleteModal({sessionId: folder.id}); }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button></Tooltip>
                  </>
                ) : (
                  <>
                    {folder.password && (
                      <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Lock Folder Now" : "No tabs to lock"}><button 
                        disabled={!folder.tabs || folder.tabs.length === 0}
                        onClick={(e) => { e.stopPropagation(); lockFolder(folder.id); }} 
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-green-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Unlock className="w-3.5 h-3.5 text-green-400" />
                      </button></Tooltip>
                    )}
                    <Tooltip content={!folder.tabs || folder.tabs.length === 0 ? "No tabs to lock" : folder.password ? "Change Password" : "Setup Password"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); setShowLockSettingsModal(folder); setLockPassword(''); setLockRecoveryWord(''); setAutoLock(folder.autoLockEnabled || false); setShowLockPassword(false); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Key className="w-3.5 h-3.5" /> 
                    </button></Tooltip>

                    <Tooltip content="Rename Folder"><button onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Share Workspace" : "No tabs to share"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openShareModal(folder); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Open All Tabs" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'current'); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-green-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "New Window" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'new'); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <AppWindow className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Incognito" : "No tabs to open"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openFolderTabs(folder, 'incognito'); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-purple-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Ghost className="w-3.5 h-3.5" />
                    </button></Tooltip>

                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Close All Tabs" : "No tabs to close"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); closeFolderTabs(folder); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-orange-400 disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <XSquare className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    <Tooltip content={folder.tabs && folder.tabs.length > 0 ? "Schedule Folder" : "No tabs to schedule"}><button 
                      disabled={!folder.tabs || folder.tabs.length === 0} 
                      onClick={(e) => { e.stopPropagation(); openTimer(folder); }} 
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-accent-purple disabled:hover:text-white/40 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button></Tooltip>
                    <Tooltip content="Delete Folder"><button onClick={(e) => { e.stopPropagation(); setShowDeleteModal({sessionId: folder.id}); }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button></Tooltip>
                  </>
                )}
              </div>
            )}
            {!isSelectMode && (
              <div className="pl-1 text-white/50 shrink-0">
                {expandedFolder === folder.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                  {folder.tabs && folder.tabs.length > 0 && (
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder={`Search ${folder.tabs.length} tabs in this folder...`}
                        value={folderTabSearches[folder.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFolderTabSearches(prev => ({ ...prev, [folder.id]: val }));
                          setFolderTabPages(prev => ({ ...prev, [folder.id]: 1 }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
                      />
                      {(folderTabSearches[folder.id] || '') && (
                        <button 
                          onClick={() => {
                            setFolderTabSearches(prev => ({ ...prev, [folder.id]: '' }));
                            setFolderTabPages(prev => ({ ...prev, [folder.id]: 1 }));
                          }}
                          className="absolute right-2.5 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scrollable List of visible tabs */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 pb-2 select-none">
                    {visibleTabs.map((tab: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] group">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <button onClick={(e) => { e.stopPropagation(); toggleStarTab(folder.id, tab.url); }} className={`p-1.5 shrink-0 rounded-lg transition-colors ${tab.isStarred ? 'text-yellow-400' : 'text-white/20 hover:text-white/60 hover:bg-white/5'}`} title={tab.isStarred ? "Unstar Tab" : "Star Tab"}>
                            <Star className={`w-3.5 h-3.5 ${tab.isStarred ? 'fill-current' : ''}`} />
                          </button>
                          {tab.favIconUrl ? <img src={tab.favIconUrl} className="w-4 h-4 flex-shrink-0" /> : <div className="w-4 h-4 bg-white/10 rounded-sm flex-shrink-0" />}
                          <div 
                            className="flex flex-col min-w-0 flex-1 cursor-pointer"
                            onClick={() => openTab(tab.url, 'new_tab', tab.title)}
                          >
                            <span className="text-sm font-medium text-white/70 hover:text-white truncate max-w-sm transition-colors" title={tab.url}>{tab.title}</span>
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
                          <Tooltip content="Open in New Tab"><button onClick={() => openTab(tab.url, 'new_tab', tab.title)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-green-400 transition-all">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Open in New Window"><button onClick={() => openTab(tab.url, 'new_window', tab.title)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-blue-400 transition-all">
                            <AppWindow className="w-3.5 h-3.5" />
                          </button></Tooltip>
                          <Tooltip content="Open in Incognito"><button onClick={() => openTab(tab.url, 'incognito', tab.title)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-purple-400 transition-all">
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
                          <Tooltip content="Remove Tab" align="right"><button onClick={() => setShowDeleteModal({ sessionId: folder.id, url: tab.url })} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md text-white/40 hover:text-red-400 transition-all">
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
                  
                  {/* Inside-Folder Tabs Pagination Controls */}
                  {matchingTabs.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-3 border-t border-white/[0.06] text-xs select-none">
                      <div className="text-white/40 text-[11px]">
                        Showing <span className="font-semibold text-white/80">{(activeTabPage - 1) * tabsPerPage + 1}–{Math.min(activeTabPage * tabsPerPage, matchingTabs.length)}</span> of <span className="font-semibold text-white/80">{matchingTabs.length}</span> tabs
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Per Page Selector for Tabs */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">Per page:</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={tabsPerPage}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTabsPerPage(val);
                                localStorage.setItem('tabflow_tabs_per_page', String(val));
                                setFolderTabPages(prev => ({ ...prev, [folder.id]: 1 }));
                              }}
                              className="appearance-none bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-md pl-2 pr-6 py-0.5 text-[11px] font-medium text-white/80 outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                            >
                              <option value={5} className="bg-[#0f0e17] text-white">5</option>
                              <option value={10} className="bg-[#0f0e17] text-white">10</option>
                              <option value={20} className="bg-[#0f0e17] text-white">20</option>
                              <option value={50} className="bg-[#0f0e17] text-white">50</option>
                              <option value={9999} className="bg-[#0f0e17] text-white">All</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 pointer-events-none w-3 h-3 text-white/40" />
                          </div>
                        </div>

                        {/* Page Navigation */}
                        <div className="flex items-center gap-1">
                          <button
                            disabled={activeTabPage === 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderTabPages(prev => ({ ...prev, [folder.id]: Math.max(1, activeTabPage - 1) }));
                            }}
                            className="p-1 rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            title="Previous Page"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-[11px] text-white/70 font-medium px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                            {activeTabPage} / {totalTabPages || 1}
                          </span>

                          <button
                            disabled={activeTabPage === (totalTabPages || 1)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderTabPages(prev => ({ ...prev, [folder.id]: Math.min(totalTabPages, activeTabPage + 1) }));
                            }}
                            className="p-1 rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            title="Next Page"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2.5 mt-2 flex items-center justify-center">
                    <button 
                      onClick={() => setShowAddTabModal(folder.id)} 
                      className="px-3.5 py-1.5 border border-dashed border-white/15 hover:border-white/30 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Tab</span>
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
        <div className="flex items-center gap-1.5 flex-wrap">
          {isSelectMode ? (
            <>
              <button 
                onClick={() => {
                  const allIds = new Set(filteredFolders.map(f => f.id));
                  setSelectedFolderIds(allIds);
                }} 
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium"
              >
                Select All
              </button>
              <button 
                onClick={() => setSelectedFolderIds(new Set())} 
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium"
              >
                Deselect All
              </button>
              <button 
                disabled={selectedFolderIds.size === 0}
                onClick={() => {
                  const selectedFoldersList = folders.filter(f => selectedFolderIds.has(f.id));
                  const allTabs = new Set(selectedFoldersList.flatMap(f => (f.tabs || []).map((t: any) => `${f.id}_${t.url}`)));
                  setSelectedExportFolders(new Set(selectedFolderIds));
                  setSelectedExportTabs(allTabs);
                  setExpandedExportFolders(new Set());
                  setShowExportModal(true);
                }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white transition-all border border-white/10 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" /> Export Selected ({selectedFolderIds.size})
              </button>
              <button 
                disabled={selectedFolderIds.size === 0}
                onClick={() => setShowBulkDeleteModal(true)} 
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white transition-all shadow-md shadow-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedFolderIds.size})
              </button>
              <button 
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedFolderIds(new Set());
                }} 
                className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium">
                <Download className="w-3.5 h-3.5" /> Import
              </button>
              <button onClick={() => {
                setSelectedExportFolders(new Set());
                setSelectedExportTabs(new Set());
                setExpandedExportFolders(new Set());
                setShowExportModal(true);
              }} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium">
                <Upload className="w-3.5 h-3.5" /> Export
              </button>
              {folders.length > 0 && (
                <button 
                  onClick={() => setIsSelectMode(true)} 
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all px-2.5 py-1.5 rounded-lg text-xs font-medium"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select Mode
                </button>
              )}
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/25 px-3 py-1.5 rounded-lg text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> New Folder
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
          placeholder="Search folders or tabs..." 
          className="os-input w-full pl-11 pr-11 h-12 bg-white/[0.02] text-white"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFolderPage(1);
            }}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
            {pinnedOnPage.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-3 flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5" /> Pinned Folders
                </h3>
                {renderFolderList(pinnedOnPage)}
              </div>
            )}
            
            {unpinnedOnPage.length > 0 && (
              <div className={pinnedOnPage.length > 0 ? "mt-5" : ""}>
                {hasAnyPinned && (
                  <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-3 flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5" /> Other Folders
                  </h3>
                )}
                {renderFolderList(unpinnedOnPage)}
              </div>
            )}

            {/* Pagination Controls */}
            {totalFolders > 0 && (
              <div className="mt-8 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.07] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 select-none shadow-sm shadow-black/20">
                {/* Left: Summary Counter */}
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    <span>Showing</span>
                    <span className="font-semibold text-white/90">
                      {(activePage - 1) * foldersPerPage + 1}–{Math.min(activePage * foldersPerPage, totalFolders)}
                    </span>
                    <span>of</span>
                    <span className="font-semibold text-white/90">{totalFolders}</span>
                    <span>{totalFolders === 1 ? 'folder' : 'folders'}</span>
                  </span>
                </div>

                {/* Right: Controls Cluster (Per Page + Navigation) */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Per Page Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 font-medium">Per page:</span>
                    <div className="relative inline-flex items-center">
                      <select
                        value={foldersPerPage}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFoldersPerPage(val);
                          localStorage.setItem('tabflow_folders_per_page', String(val));
                          setFolderPage(1);
                        }}
                        className="appearance-none bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-lg pl-2.5 pr-7 py-1 text-xs font-medium text-white/80 hover:text-white outline-none focus:border-blue-500/50 transition-all cursor-pointer shadow-inner"
                      >
                        <option value={5} className="bg-[#0f0e17] text-white">5</option>
                        <option value={10} className="bg-[#0f0e17] text-white">10</option>
                        <option value={20} className="bg-[#0f0e17] text-white">20</option>
                        <option value={50} className="bg-[#0f0e17] text-white">50</option>
                        <option value={9999} className="bg-[#0f0e17] text-white">All</option>
                      </select>
                      <ChevronDown className="absolute right-2 pointer-events-none w-3.5 h-3.5 text-white/40" />
                    </div>
                  </div>

                  <div className="h-4 w-px bg-white/10 hidden sm:block" />

                  {/* Page Navigation Buttons */}
                  <div className="flex items-center gap-1">
                    {/* First Page button (only if > 2 pages) */}
                    {totalPages > 2 && (
                      <button
                        onClick={() => setFolderPage(1)}
                        disabled={activePage === 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.08] text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title="First Page"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Previous Button */}
                    <button
                      onClick={() => setFolderPage(p => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      className="h-8 px-2.5 rounded-lg flex items-center gap-1 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.08] text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs font-medium"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Prev</span>
                    </button>

                    {/* Numbered Page Buttons */}
                    {totalPages <= 1 ? (
                      <span className="min-w-8 h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/15 text-white flex items-center justify-center border border-white/20 select-none">
                        1
                      </span>
                    ) : (
                      (() => {
                        const pages: (number | string)[] = [];
                        if (totalPages <= 5) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (activePage > 3) pages.push('...');
                          const start = Math.max(2, activePage - 1);
                          const end = Math.min(totalPages - 1, activePage + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (activePage < totalPages - 2) pages.push('...');
                          pages.push(totalPages);
                        }

                        return pages.map((p, idx) => {
                          if (p === '...') {
                            return <span key={`dots-${idx}`} className="w-5 text-center text-xs text-white/30 select-none">...</span>;
                          }
                          const isCurrent = activePage === p;
                          return (
                            <button
                              key={p}
                              onClick={() => setFolderPage(p as number)}
                              className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-white/15 text-white border border-white/20'
                                  : 'bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/15'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        });
                      })()
                    )}

                    {/* Next Button */}
                    <button
                      onClick={() => setFolderPage(p => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      className="h-8 px-2.5 rounded-lg flex items-center gap-1 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.08] text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs font-medium"
                      title="Next Page"
                    >
                      <span className="hidden md:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last Page button (only if > 2 pages) */}
                    {totalPages > 2 && (
                      <button
                        onClick={() => setFolderPage(totalPages)}
                        disabled={activePage === totalPages}
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.08] text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title="Last Page"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
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
                  className="fixed inset-0 bg-black/75 backdrop-blur-md" 
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 12 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: 12 }} 
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/90 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-3 text-red-400">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white tracking-tight mb-1">
                    {selectedFolderIds.size === 1 ? 'Delete Workspace Folder?' : 'Delete Selected Folders?'}
                  </h3>
                  <p className="text-xs text-white/50 mb-3.5 leading-normal">
                    Permanently deletes selected folders, tabs, and timers.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowBulkDeleteModal(false)}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={async () => {
                        setShowBulkDeleteModal(false);
                        const ids = Array.from(selectedFolderIds);
                        setIsSelectMode(false);
                        setSelectedFolderIds(new Set());
                        await handleBulkDelete(ids);
                      }}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] rounded-lg text-xs font-semibold text-white shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{selectedFolderIds.size === 1 ? 'Delete Folder' : 'Delete All'}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

      {/* Export Folders Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowExportModal(false)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Export Folders</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => {
                    const allFolders = new Set(folders.map(f => f.id));
                    const allTabs = new Set(folders.flatMap(f => (f.tabs || []).map((t: any) => `${f.id}_${t.url}`)));
                    setSelectedExportFolders(allFolders);
                    setSelectedExportTabs(allTabs);
                  }} className="px-2 py-0.5 text-[10px] font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">Select All</button>
                  <button onClick={() => {
                    setSelectedExportFolders(new Set());
                    setSelectedExportTabs(new Set());
                  }} className="px-2 py-0.5 text-[10px] font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">Deselect</button>
                  <button onClick={() => setShowExportModal(false)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors ml-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 scrollbar-hide max-h-56">
                {folders.map(folder => {
                  const isFolderSelected = selectedExportFolders.has(folder.id);
                  const isExpanded = expandedExportFolders.has(folder.id);
                  const folderTabs = folder.tabs || [];
                  const selectedTabsCount = folderTabs.filter((t: any) => selectedExportTabs.has(`${folder.id}_${t.url}`)).length;
                  const isIndeterminate = selectedTabsCount > 0 && selectedTabsCount < folderTabs.length;

                  return (
                    <div key={folder.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                      <div className="flex items-center p-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => {
                        const newExpanded = new Set(expandedExportFolders);
                        if (isExpanded) newExpanded.delete(folder.id);
                        else newExpanded.add(folder.id);
                        setExpandedExportFolders(newExpanded);
                      }}>
                        <div className="mr-2.5 flex-shrink-0" onClick={(e) => {
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
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isFolderSelected ? 'bg-blue-600 border-blue-600' : isIndeterminate ? 'bg-blue-600/50 border-blue-600/50' : 'border-white/20 bg-black/40'}`}>
                            {isFolderSelected && <Check className="w-3 h-3 text-white" />}
                            {isIndeterminate && <div className="w-2 h-0.5 bg-white rounded-full" />}
                          </div>
                        </div>
                        <Folder className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-xs font-medium text-white flex-1 truncate">{folder.name}</span>
                        <span className="text-[10px] text-white/40 mr-2">{folderTabs.length} tabs</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-2 pt-0 border-t border-white/5 bg-black/30 space-y-0.5">
                              {folderTabs.map((tab: any, idx: number) => {
                                const tabId = `${folder.id}_${tab.url}`;
                                const isTabSelected = selectedExportTabs.has(tabId);
                                return (
                                  <div key={idx} className="flex items-center p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors" onClick={() => {
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
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center mr-2.5 transition-colors shrink-0 ${isTabSelected ? 'bg-blue-600 border-blue-600' : 'border-white/20 bg-black/40'}`}>
                                      {isTabSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    {tab.favIconUrl ? <img src={tab.favIconUrl} className="w-3 h-3 mr-1.5 flex-shrink-0" /> : <div className="w-3 h-3 bg-white/10 rounded-sm mr-1.5 flex-shrink-0" />}
                                    <span className="text-[11px] text-white/70 truncate" title={tab.url}>{tab.title}</span>
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
                {folders.length === 0 && <div className="text-center text-white/40 py-6 text-xs">No folders to export.</div>}
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.08] shrink-0">
                <span className="text-[11px] text-white/40">
                  {selectedExportFolders.size} folder{selectedExportFolders.size !== 1 ? 's' : ''} • {selectedExportTabs.size} tab{selectedExportTabs.size !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowExportModal(false)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleExport} disabled={selectedExportFolders.size === 0 && selectedExportTabs.size === 0} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 disabled:opacity-40">Export</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Create Folder</h3>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5 block">Folder Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors" 
                    placeholder="e.g. Project Apollo" 
                    value={newFolderName} 
                    onChange={e => setNewFolderName(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) submitCreateFolder(); }}
                    autoFocus 
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/[0.08]">
                <button onClick={() => setShowCreateModal(false)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                <button onClick={submitCreateFolder} disabled={!newFolderName.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 disabled:opacity-40">Create</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Tab Modal */}
      <AnimatePresence>
        {showAddTabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTabModal(null)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[380px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Add Tab to Folder</h3>
                </div>
                <button onClick={() => setShowAddTabModal(null)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 pr-0.5 flex-1 select-none">
                <button onClick={submitScanTabs} className="w-full py-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-lg flex items-center justify-center gap-2 text-blue-400 text-xs font-medium transition-all">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scan & Save All Open Tabs</span>
                </button>

                {openTabsForModal.length > 0 && (() => {
                  const targetFolder = folders.find(f => f.id === showAddTabModal);
                  return (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5 flex items-center justify-between">
                        <span>Current Browser Tabs</span>
                        <span className="text-[9px] text-white/30">{openTabsForModal.length} detected</span>
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 rounded-lg border border-white/5 bg-black/20 p-1">
                        {openTabsForModal.map((ot, oIdx) => {
                          const isAlreadyInFolder = targetFolder?.tabs?.some(t => isSameUrl(t.url, ot.url));
                          return (
                            <div key={oIdx} className="flex items-center justify-between p-1.5 rounded-md hover:bg-white/5 group transition-colors">
                              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                {ot.favIconUrl ? (
                                  <img src={ot.favIconUrl} className="w-3.5 h-3.5 shrink-0 rounded-sm" />
                                ) : (
                                  <div className="w-3.5 h-3.5 shrink-0 bg-white/10 rounded-sm" />
                                )}
                                <span className="text-xs text-white/80 truncate font-medium" title={ot.url}>
                                  {ot.title || ot.url}
                                </span>
                              </div>
                              {isAlreadyInFolder ? (
                                <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded font-medium shrink-0 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Added
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddSpecificOpenTab(ot)}
                                  className="text-[10px] text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold shrink-0 transition-colors flex items-center gap-1"
                                >
                                  <Plus className="w-2.5 h-2.5" /> Add
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="relative flex items-center my-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-2 text-white/30 text-[10px] font-semibold uppercase tracking-wider">or add by url</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">Title (Optional)</label>
                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50" placeholder="e.g. Documentation" value={newTabName} onChange={e => setNewTabName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">URL</label>
                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50" placeholder="e.g. google.com" value={newTabUrl} onChange={e => setNewTabUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTabUrl.trim()) submitAddTabManually(); }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-white/[0.08] shrink-0">
                <button onClick={() => setShowAddTabModal(null)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Close</button>
                <button onClick={submitAddTabManually} disabled={!newTabUrl.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 disabled:opacity-40">Add by URL</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tab Modal */}
      <AnimatePresence>
        {showEditTabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditTabModal(null)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Edit Tab</h3>
                </div>
                <button onClick={() => setShowEditTabModal(null)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">Title</label>
                  <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50" value={showEditTabModal.title} onChange={e => setShowEditTabModal({...showEditTabModal, title: e.target.value})} autoFocus />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">URL</label>
                  <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50" value={showEditTabModal.url} onChange={e => setShowEditTabModal({...showEditTabModal, url: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && showEditTabModal.url.trim()) submitEditTab(); }} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3.5 pt-2.5 border-t border-white/[0.08]">
                <button onClick={() => setShowEditTabModal(null)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                <button onClick={submitEditTab} disabled={!showEditTabModal.url.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 disabled:opacity-40">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Workspace Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(null)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight truncate max-w-[360px]">Share "{showShareModal.folderName}"</h3>
                </div>
                <button onClick={() => setShowShareModal(null)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden flex flex-col bg-[#07050f]/80 rounded-xl border border-white/[0.04]">
                {/* Public Link Banner if generated */}
                {shareLink && (
                  <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        <span>Public Link Active</span>
                      </div>
                      <a 
                        href={shareLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline font-medium"
                      >
                        View Public Page <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-1.5">
                      <span className="text-xs text-blue-300 font-mono truncate select-all flex-1 px-1">{shareLink}</span>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} 
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-semibold shrink-0 transition-colors flex items-center gap-1"
                      >
                        {shareCopied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                )}

                {isGeneratingShare ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <Sparkles className="w-6 h-6 text-blue-400 animate-pulse mb-2.5" />
                    <p className="text-white/50 text-xs font-medium tracking-wide">AI is summarizing workspace...</p>
                  </div>
                ) : !shareMarkdown ? (
                  <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1 max-h-64 scrollbar-hide">
                    <p className="text-[11px] text-white/50 mb-1 px-1">Select tabs to include:</p>
                    {showShareModal.tabs.map((tab: any, index: number) => (
                      <label key={index} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                        <input 
                          type="checkbox" 
                          checked={selectedShareTabs.has(tab.url)}
                          onChange={(e) => {
                            const newSet = new Set(selectedShareTabs);
                            if (e.target.checked) newSet.add(tab.url);
                            else newSet.delete(tab.url);
                            setSelectedShareTabs(newSet);
                          }}
                          className="w-3.5 h-3.5 shrink-0 rounded border-white/20 bg-black/40 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-white/90 font-medium truncate">{tab.title}</span>
                          <span className="text-[10px] text-white/40 truncate">{tab.url}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShareViewMode('preview')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            shareViewMode === 'preview'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'text-white/40 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => setShareViewMode('edit')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            shareViewMode === 'edit'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'text-white/40 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          Edit Raw
                        </button>
                      </div>
                      <span className="text-[10px] text-white/40 font-medium">Workspace Summary</span>
                    </div>
                    {shareViewMode === 'preview' ? (
                      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide max-h-[460px]">
                        <MarkdownPreview content={shareMarkdown} />
                      </div>
                    ) : (
                      <textarea
                        className="flex-1 w-full h-full min-h-[220px] bg-transparent text-xs text-white/80 p-3 outline-none resize-none font-mono scrollbar-hide"
                        value={shareMarkdown}
                        onChange={e => setShareMarkdown(e.target.value)}
                      />
                    )}
                  </>
                )}
              </div>
              
              <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/[0.08] shrink-0">
                {!shareLink && (
                  <div className="relative">
                    <select 
                      value={linkExpiry} 
                      onChange={e => setLinkExpiry(Number(e.target.value))}
                      className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg pl-2.5 pr-7 py-1.5 text-xs outline-none transition-colors cursor-pointer"
                    >
                      <option value={1}>1 Day</option>
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={365}>1 Year</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
                  </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setShowShareModal(null)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Done</button>
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
                          generateShareableWorkspace();
                        }} 
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span>Regenerate</span>
                      </button>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} 
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer"
                      >
                        {shareCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                      </button>
                    </>
                  ) : !shareMarkdown ? (
                    <button 
                      onClick={generateShareableWorkspace} 
                      disabled={selectedShareTabs.size === 0 || isGeneratingShare} 
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer ${selectedShareTabs.size === 0 ? 'opacity-50 bg-white/10' : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25'}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generate Summary
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => generateShareableWorkspace()} 
                        disabled={isGeneratingShare} 
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span>Regenerate</span>
                      </button>
                      <button 
                        onClick={generatePublicLink} 
                        disabled={isGeneratingLink || isGeneratingShare} 
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer ${isGeneratingLink ? 'opacity-50 bg-white/10' : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 disabled:opacity-50'}`}
                      >
                        {isGeneratingLink ? "Generating..." : <><Share2 className="w-3.5 h-3.5" /> Get Public Link</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Timer Modal */}
      <AnimatePresence>
        {showTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTimerModal(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 12 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 12 }} 
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90"
            >
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Schedule {showTimerModal.type === 'folder' ? 'Folder' : 'Tab'}</h3>
                </div>
                <button onClick={() => setShowTimerModal(null)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Segmented Action Pill */}
                <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimerAction('close')}
                    className={`py-1 rounded-md text-xs font-medium transition-all ${timerAction === 'close' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                  >
                    Close {showTimerModal.type === 'folder' ? 'Folder' : 'Tab'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerAction('open')}
                    className={`py-1 rounded-md text-xs font-medium transition-all ${timerAction === 'open' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                  >
                    Open {showTimerModal.type === 'folder' ? 'Folder' : 'Tab'}
                  </button>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 flex items-center justify-between font-semibold">
                    <span>Date & Time</span>
                    <span className="text-[10px] text-blue-300 bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.2 rounded-full">
                      {timerAction === 'open' ? openTimerDates.length : closeTimerDates.length} scheduled
                    </span>
                  </div>
                  <CustomDateTimePicker 
                    value={timerAction === 'open' ? openTimerDates : closeTimerDates} 
                    onChange={timerAction === 'open' ? setOpenTimerDates : setCloseTimerDates} 
                  />
                </div>
              </div>

              <div className="flex items-center w-full gap-2 mt-3.5 pt-2.5 border-t border-white/5">
                {(openTimerDates.length > 0 || closeTimerDates.length > 0) && (
                  <button onClick={() => submitTimer(true)} className="px-2 py-1 hover:bg-red-500/10 rounded-lg text-xs font-medium text-red-400 transition-colors">
                    Clear
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => setShowTimerModal(null)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                <button onClick={() => submitTimer(false)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowDeleteModal(null)} 
              className="fixed inset-0 bg-black/75 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 12 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 12 }} 
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/90 text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-3 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white tracking-tight mb-1">
                Delete {showDeleteModal.url ? 'Tab' : 'Workspace Folder'}?
              </h3>
              <p className="text-xs text-white/50 mb-3.5 leading-normal">
                {showDeleteModal.url 
                  ? 'Permanently removes this tab from the folder.' 
                  : 'Permanently deletes this folder and all saved tabs.'}
              </p>
              
              <div className="flex items-center justify-center gap-2">
                <button 
                  type="button"
                  onClick={() => setShowDeleteModal(null)} 
                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={confirmDelete} 
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] rounded-lg text-xs font-semibold text-white shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{showDeleteModal.url ? 'Remove Tab' : 'Delete Folder'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lock Settings Modal */}
      <AnimatePresence>
        {showLockSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLockSettingsModal(null)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[350px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">Lock Settings</h3>
                </div>
                <button onClick={() => setShowLockSettingsModal(null)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-white/50 mb-3">Secure this folder with a password.</p>
              
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">Password</label>
                  <div className="relative flex items-center">
                    <input type={showLockPassword ? "text" : "password"} placeholder={showLockSettingsModal.password ? "•••••••• (Keep existing)" : "Enter password"} value={lockPassword} onChange={e => setLockPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors" />
                    <button 
                      type="button"
                      onClick={() => setShowLockPassword(!showLockPassword)}
                      className="absolute right-2.5 text-white/40 hover:text-white transition-colors"
                    >
                      {showLockPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1 block">Recovery Word</label>
                  <input type="text" placeholder={showLockSettingsModal.password ? "•••••••• (Keep existing)" : "Secret recovery word"} value={lockRecoveryWord} onChange={e => setLockRecoveryWord(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors" />
                  <p className="text-[10px] text-amber-400/90 mt-1 leading-normal">
                    Save your recovery word in a safe place to reset if forgotten.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <input type="checkbox" id="autoLock" checked={autoLock} onChange={e => setAutoLock(e.target.checked)} className="w-3.5 h-3.5 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-0 cursor-pointer" />
                  <label htmlFor="autoLock" className="text-xs text-white/80 cursor-pointer select-none">Auto-lock on reload</label>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-white/[0.08]">
                <button onClick={() => setShowLockSettingsModal(null)} className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                {showLockSettingsModal.password && (
                  <button onClick={() => {
                    chrome.runtime.sendMessage({ type: 'UPDATE_FOLDER_LOCK', sessionId: showLockSettingsModal.id, password: '', recoveryWord: '', autoLockEnabled: false }, () => {
                      loadFolders();
                      setShowLockSettingsModal(null);
                      showToast('Security Removed', 'Folder password protection has been disabled.', 'info');
                    });
                  }} className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors">
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
                }} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dpaste Warning Modal */}
      <AnimatePresence>
        {showDpasteWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDpasteWarning(false)} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[350px] overflow-hidden rounded-2xl border border-orange-500/30 bg-[#16121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">External Service Warning</h3>
                </div>
                <button onClick={() => setShowDpasteWarning(false)} className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="space-y-2 text-xs text-white/70 mb-4 p-3 bg-orange-500/5 rounded-xl border border-orange-500/10 leading-normal">
                <p>
                  You are about to upload this folder summary publicly via <strong className="text-white">dpaste.com</strong>.
                </p>
                <p className="text-orange-300 text-[11px]">
                  Ensure no sensitive or confidential information is included.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/[0.08]">
                <button onClick={() => setShowDpasteWarning(false)} className="px-3.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors">Cancel</button>
                <button onClick={generatePublicLink} disabled={isGeneratingLink} className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-orange-500/25 disabled:opacity-50 flex items-center gap-1.5">
                  {isGeneratingLink ? <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Proceed'}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => {setShowUnlockModal(null); setIsRecoveryMode(null);}} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90 text-center">
              <button onClick={() => {setShowUnlockModal(null); setIsRecoveryMode(null);}} className="absolute top-3.5 right-3.5 w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
              
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-2 text-indigo-400">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-white mb-0.5">
                {isRecoveryMode === 'verify_word' ? 'Verify Recovery' : isRecoveryMode === 'new_password' ? 'Reset Password' : 'Folder Locked'}
              </h3>
              <p className="text-[11px] text-white/50 mb-3 leading-normal">
                {isRecoveryMode === 'verify_word' ? 'Enter secret recovery word to reset password.' : isRecoveryMode === 'new_password' ? 'Enter a new password.' : 'Enter password to unlock this folder.'}
              </p>
              
              <div className="space-y-3 mb-3.5 text-left">
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
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all text-center" 
                      autoFocus
                    />
                  ) : (
                    <p className="text-[10px] text-red-400/80 text-center bg-red-400/10 border border-red-400/20 p-2 rounded-lg leading-normal">
                      No recovery word set up. Recovery not possible.
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
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all" 
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => setShowRecoveryNewPassword(!showRecoveryNewPassword)}
                      className="absolute right-2.5 text-white/40 hover:text-white transition-colors"
                    >
                      {showRecoveryNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all" 
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                      className="absolute right-2.5 text-white/40 hover:text-white transition-colors"
                    >
                      {showUnlockPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {unlockError && <p className="text-[11px] text-red-400 text-center">{unlockError}</p>}
              </div>

              <div className="flex flex-col gap-2">
                {(!isRecoveryMode || isRecoveryMode !== 'verify_word' || showUnlockModal.recoveryWord) && (
                  <button 
                    onClick={handleUnlockSubmit} 
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25"
                  >
                    {isRecoveryMode === 'verify_word' ? 'Verify Word' : isRecoveryMode === 'new_password' ? 'Reset Lock' : 'Unlock'}
                  </button>
                )}
                {!isRecoveryMode ? (
                  showUnlockModal.password && (
                    <button onClick={() => { setIsRecoveryMode('verify_word'); setUnlockPassword(''); setRecoveryWordInput(''); setRecoveryNewPassword(''); setUnlockError(''); }} className="text-[11px] text-white/40 hover:text-white transition-colors">Forgot Password?</button>
                  )
                ) : (
                  <button onClick={() => { setIsRecoveryMode(null); setUnlockError(''); }} className="text-[11px] text-indigo-400/80 hover:text-indigo-400 transition-colors">Back to Unlock</button>
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

function TimeSegment({ 
  value, 
  max, 
  onChange, 
  title 
}: { 
  value: number; 
  max: number; 
  onChange: (val: number) => void; 
  title: string; 
}) {
  const [text, setText] = useState(value.toString().padStart(2, '0'));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setText(value.toString().padStart(2, '0'));
    }
  }, [value]);

  const commit = (str: string) => {
    const num = Math.min(max, Math.max(0, parseInt(str, 10) || 0));
    onChange(num);
    setText(num.toString().padStart(2, '0'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = value + 1 > max ? 0 : value + 1;
      onChange(next);
      setText(next.toString().padStart(2, '0'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = value - 1 < 0 ? max : value - 1;
      onChange(prev);
      setText(prev.toString().padStart(2, '0'));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={(e) => {
        isFocused.current = true;
        e.target.select();
      }}
      onBlur={(e) => {
        isFocused.current = false;
        commit(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (raw.length <= 2) {
          setText(raw);
          if (raw.length > 0) {
            const num = Math.min(max, Math.max(0, parseInt(raw, 10) || 0));
            onChange(num);
          }
        }
      }}
      className="w-8 bg-transparent text-white text-center text-xs font-mono font-semibold outline-none tabular-nums p-0 hover:bg-white/10 focus:bg-white/15 rounded transition-colors"
      title={title}
    />
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
      const futureBase = new Date(Date.now() + 5 * 60 * 1000);
      const defaultTime = value.length > 0 ? value[value.length - 1] : futureBase;
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, defaultTime.getHours(), defaultTime.getMinutes(), 0);
      if (newDate.getTime() <= Date.now() && day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()) {
        newDate.setHours(futureBase.getHours(), futureBase.getMinutes(), 0);
      }
      onChange([...value, newDate].sort((a,b) => a.getTime() - b.getTime()));
    }
  };

  const handleIndividualTimeChange = (idx: number, type: 'h'|'m'|'s', num: number) => {
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
    <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 w-full select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 text-white">
        <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white text-xs">&lt;</button>
        <span className="text-xs font-semibold tracking-tight">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white text-xs">&gt;</button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] uppercase tracking-wider text-white/30 mb-1 font-semibold">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {blanks.map(b => <div key={`b-${b}`} className="py-1" />)}
        {days.map(d => {
          const isSelected = value.some(v => v.getDate() === d && v.getMonth() === currentMonth.getMonth() && v.getFullYear() === currentMonth.getFullYear());
          const isToday = !isSelected && d === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();
          
          return (
            <button 
              key={d} 
              onClick={() => handleDayClick(d)}
              className={`py-1 rounded-md transition-all text-[11px] ${isSelected ? 'bg-blue-600 text-white font-semibold shadow-sm' : isToday ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Selected Dates Time Pickers */}
      {value.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.04] flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-hide">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Times</div>
          {value.map((date, idx) => (
            <div key={idx} className="flex justify-between items-center gap-2 bg-white/[0.03] px-2.5 py-1.5 rounded-lg border border-white/5">
              <span className="text-xs font-medium text-white/90 shrink-0">{monthNames[date.getMonth()]} {date.getDate()}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-black/60 px-1.5 py-0.5 rounded-md border border-white/10 focus-within:border-blue-500/50">
                  <TimeSegment
                    value={date.getHours()}
                    max={23}
                    onChange={(h) => handleIndividualTimeChange(idx, 'h', h)}
                    title="Hour (0-23)"
                  />
                  <span className="text-white/40 text-xs font-mono select-none px-0.5">:</span>
                  <TimeSegment
                    value={date.getMinutes()}
                    max={59}
                    onChange={(m) => handleIndividualTimeChange(idx, 'm', m)}
                    title="Minute (0-59)"
                  />
                  <span className="text-white/40 text-xs font-mono select-none px-0.5">:</span>
                  <TimeSegment
                    value={date.getSeconds()}
                    max={59}
                    onChange={(s) => handleIndividualTimeChange(idx, 's', s)}
                    title="Second (0-59)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newDates = [...value];
                    newDates.splice(idx, 1);
                    onChange(newDates);
                  }}
                  className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Remove time"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


const MarkdownPreview = ({ content }: { content: string }) => {
  let cleaned = sanitizeStreamChunk(content || '').trim();
  // Strip code block fence if output was wrapped in ```markdown or ```
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```md')) {
    cleaned = cleaned.replace(/^```md\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  }

  const lines = cleaned.split('\n');
  const rendered: React.ReactNode[] = [];
  
  let currentTableHeaders: string[] = [];
  let currentTableRows: string[][] = [];
  let isInsideTable = false;

  let currentListItems: React.ReactNode[] = [];
  let isInsideList = false;

  // Bracket/Parentheses-aware line splitter that NEVER breaks inside [Title | Part 2](url) or `code | pipe`
  const splitTableLine = (rawLine: string): string[] => {
    let line = rawLine.trim();
    if (line.startsWith('|')) line = line.slice(1);
    if (line.endsWith('|')) line = line.slice(0, -1);

    const cells: string[] = [];
    let current = '';
    let inBracket = 0;      // inside [ ... ]
    let inParen = 0;        // inside ( ... )
    let inBacktick = false; // inside ` ... `

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prev = i > 0 ? line[i - 1] : '';

      if (char === '`' && prev !== '\\') {
        inBacktick = !inBacktick;
        current += char;
      } else if (!inBacktick && char === '[' && prev !== '\\') {
        inBracket++;
        current += char;
      } else if (!inBacktick && char === ']' && prev !== '\\') {
        if (inBracket > 0) inBracket--;
        current += char;
      } else if (!inBacktick && char === '(' && inBracket === 0 && prev !== '\\') {
        inParen++;
        current += char;
      } else if (!inBacktick && char === ')' && inBracket === 0 && prev !== '\\') {
        if (inParen > 0) inParen--;
        current += char;
      } else if (char === '|' && !inBacktick && inBracket === 0 && inParen === 0) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const renderInline = (text: string): React.ReactNode[] => {
    if (!text || !text.trim()) {
      return [<span key="empty" className="text-white/20 select-none">—</span>];
    }
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\)|(?:https?:\/\/[^\s<)]+))/g;
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const closeBraceIdx = part.indexOf(']');
        if (closeBraceIdx !== -1) {
          let label = part.slice(1, closeBraceIdx).trim();
          const url = part.slice(closeBraceIdx + 2, -1).trim();
          const safeUrl = sanitizeUrl(url);
          label = label.replace(/\|/g, '-');
          return (
            <a 
              key={idx} 
              href={safeUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium break-words [word-break:break-word]"
              title={safeUrl}
            >
              {label || safeUrl}
            </a>
          );
        }
      }
      if (part.startsWith('http://') || part.startsWith('https://')) {
        const safeUrl = sanitizeUrl(part);
        let displayUrl = safeUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        if (displayUrl.length > 38) {
          displayUrl = displayUrl.slice(0, 36) + '…';
        }
        return (
          <a 
            key={idx} 
            href={safeUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium break-all"
            title={safeUrl}
          >
            {displayUrl}
          </a>
        );
      }
      return part;
    });
  };

  const flushTable = (key: number) => {
    if (currentTableHeaders.length > 0 || currentTableRows.length > 0) {
      const colCount = currentTableHeaders.length || (currentTableRows[0]?.length ?? 3);
      rendered.push(
        <div key={`table-${key}`} className="overflow-x-auto my-3 rounded-xl border border-white/10 bg-[#0c1017]/70 shadow-sm max-w-full">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            {currentTableHeaders.length > 0 && (
              <thead className="sticky top-0 z-10 bg-[#121722] border-b border-white/10 shadow-sm backdrop-blur">
                <tr className="bg-white/[0.04]">
                  {currentTableHeaders.map((h, i) => {
                    let colWidth = '';
                    if (colCount === 3) {
                      if (i === 0) colWidth = 'w-[26%] min-w-[130px]';
                      else if (i === 1) colWidth = 'w-[22%] min-w-[110px]';
                      else colWidth = 'w-[52%] min-w-[220px]';
                    } else if (colCount === 2) {
                      colWidth = i === 0 ? 'w-[35%]' : 'w-[65%]';
                    } else {
                      colWidth = 'min-w-[120px]';
                    }
                    return (
                      <th key={i} className={`p-3 font-semibold text-white/90 uppercase tracking-wider text-[10.5px] ${colWidth}`}>
                        {renderInline(h)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-white/[0.05]">
              {currentTableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-white/[0.03] transition-colors">
                  {row.map((cell, ci) => {
                    const isCategoryCol = colCount === 3 && ci === 1;
                    return (
                      <td key={ci} className="p-3 text-white/80 align-top leading-relaxed text-xs break-words">
                        {isCategoryCol && cell && !cell.startsWith('http') && !cell.startsWith('[') ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-medium text-white/70">
                            {renderInline(cell)}
                          </span>
                        ) : (
                          renderInline(cell)
                        )}
                      </td>
                    );
                  })}
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
    
    if (line.includes('|')) {
      let cells = splitTableLine(line);
      while (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop();
      }

      const isSeparator = cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c) || c === '');

      if (isSeparator) {
        isInsideTable = true;
        continue;
      }

      if (cells.length > 0) {
        if (isInsideList) {
          flushList(i);
        }

        if (!isInsideTable) {
          currentTableHeaders = cells;
          isInsideTable = true;
        } else {
          if (currentTableHeaders.length > 0) {
            if (cells.length > currentTableHeaders.length) {
              // Merge any excess cells into the description column so nothing is discarded or misaligned
              const headCount = currentTableHeaders.length;
              const normalized = cells.slice(0, headCount - 1);
              normalized.push(cells.slice(headCount - 1).join(' - '));
              cells = normalized;
            } else {
              while (cells.length < currentTableHeaders.length) {
                cells.push('');
              }
            }
          }
          currentTableRows.push(cells);
        }
        continue;
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

type FolderSession = WorkspaceSession;

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

const MAP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

/**
 * Calculates tab orbital positions using dynamic concentric rings.
 * Scales effortlessly from 1 tab up to 50+ tabs without node crowding.
 */
function getTabOrbitPosition(fx: number, fy: number, index: number, totalTabs: number): { x: number; y: number } {
  if (totalTabs <= 1) {
    return { x: fx + 65, y: fy };
  }

  // 1 to 6 tabs: Single comfortable orbital ring
  // Rotates startAngle so that no tab lands on bottom center (Math.PI / 2) over the folder title
  if (totalTabs <= 6) {
    const radius = Math.max(58, 48 + totalTabs * 3);
    const startAngle = totalTabs % 2 === 0 ? -Math.PI / 2 + Math.PI / totalTabs : -Math.PI / 2;
    const angle = startAngle + (2 * Math.PI * index) / totalTabs;
    return {
      x: fx + radius * Math.cos(angle),
      y: fy + radius * Math.sin(angle)
    };
  }

  // 7 to 15 tabs: 2 concentric planetary rings
  if (totalTabs <= 15) {
    const innerCount = Math.min(5, Math.floor(totalTabs * 0.38));
    const outerCount = totalTabs - innerCount;

    if (index < innerCount) {
      const radius = 60;
      const startAngle = innerCount % 2 === 0 ? -Math.PI / 2 + Math.PI / innerCount : -Math.PI / 2;
      const angle = startAngle + (2 * Math.PI * index) / innerCount;
      return {
        x: fx + radius * Math.cos(angle),
        y: fy + radius * Math.sin(angle)
      };
    } else {
      const outerIndex = index - innerCount;
      const radius = 100;
      const startAngle = outerCount % 2 === 0 ? -Math.PI / 2 + Math.PI / outerCount : -Math.PI / 2;
      const angle = startAngle + (2 * Math.PI * outerIndex) / outerCount;
      return {
        x: fx + radius * Math.cos(angle),
        y: fy + radius * Math.sin(angle)
      };
    }
  }

  // 16+ tabs: 3 concentric planetary rings (handles 20-50+ tabs without crowding)
  const ring1Count = 5;
  const ring2Count = Math.min(10, Math.floor((totalTabs - ring1Count) * 0.45));
  const ring3Count = totalTabs - ring1Count - ring2Count;

  if (index < ring1Count) {
    const radius = 58;
    const startAngle = ring1Count % 2 === 0 ? -Math.PI / 2 + Math.PI / ring1Count : -Math.PI / 2;
    const angle = startAngle + (2 * Math.PI * index) / ring1Count;
    return { x: fx + radius * Math.cos(angle), y: fy + radius * Math.sin(angle) };
  } else if (index < ring1Count + ring2Count) {
    const idx2 = index - ring1Count;
    const radius = 98;
    const startAngle = ring2Count % 2 === 0 ? -Math.PI / 2 + Math.PI / ring2Count : -Math.PI / 2;
    const angle = startAngle + (2 * Math.PI * idx2) / ring2Count + (Math.PI / ring2Count);
    return { x: fx + radius * Math.cos(angle), y: fy + radius * Math.sin(angle) };
  } else {
    const idx3 = index - ring1Count - ring2Count;
    const radius = 138;
    const startAngle = ring3Count % 2 === 0 ? -Math.PI / 2 + Math.PI / ring3Count : -Math.PI / 2;
    const angle = startAngle + (2 * Math.PI * idx3) / ring3Count + (Math.PI / (2 * ring3Count));
    return { x: fx + radius * Math.cos(angle), y: fy + radius * Math.sin(angle) };
  }
}

function WorkspaceMapView({ showToast }: { showToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void }) {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [similarityMode, setSimilarityMode] = useState(true);
  const [visibleFolderIds, setVisibleFolderIds] = useState<Set<string>>(new Set());
  const [foldersList, setFoldersList] = useState<FolderSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Sidebar Filter & Pagination states
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

  // Unlock Modal states for Workspace Map
  const [unlockModalFolder, setUnlockModalFolder] = useState<FolderSession | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState<'verify_word' | 'new_password' | null>(null);
  const [recoveryWordInput, setRecoveryWordInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [showRecoveryNewPassword, setShowRecoveryNewPassword] = useState(false);

  const isLayoutFrozenRef = useRef(isLayoutFrozen);
  const savedPositionsRef = useRef(savedPositions);
  const expandedMapFoldersRef = useRef(expandedMapFolders);
  const visibleFolderIdsRef = useRef(visibleFolderIds);

  useEffect(() => { isLayoutFrozenRef.current = isLayoutFrozen; }, [isLayoutFrozen]);
  useEffect(() => { savedPositionsRef.current = savedPositions; }, [savedPositions]);
  useEffect(() => { expandedMapFoldersRef.current = expandedMapFolders; }, [expandedMapFolders]);
  useEffect(() => { visibleFolderIdsRef.current = visibleFolderIds; }, [visibleFolderIds]);

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

  const handleUnlockSubmit = async () => {
    if (!unlockModalFolder) return;
    if (isRecoveryMode === 'verify_word') {
      const enteredWord = recoveryWordInput.trim().toLowerCase();
      const enteredHash = await sha256(unlockModalFolder.id + enteredWord);
      chrome.runtime.sendMessage({
        type: 'VERIFY_RECOVERY_WORD',
        sessionId: unlockModalFolder.id,
        recoveryWordHash: enteredHash
      }, (isCorrect) => {
        if (isCorrect) {
          setIsRecoveryMode('new_password');
          setUnlockError('');
          showToast('Recovery Verified', 'Security verification successful. Please set your new password.', 'success');
        } else {
          setUnlockError('Incorrect recovery word.');
        }
      });
    } else if (isRecoveryMode === 'new_password') {
      const hashedNewPassword = await sha256(unlockModalFolder.id + recoveryNewPassword);
      chrome.runtime.sendMessage({ 
        type: 'UPDATE_FOLDER_LOCK', 
        sessionId: unlockModalFolder.id, 
        password: hashedNewPassword, 
        autoLockEnabled: unlockModalFolder.autoLockEnabled 
      }, () => {
        chrome.runtime.sendMessage({ 
          type: 'UNLOCK_FOLDER', 
          sessionId: unlockModalFolder.id, 
          passwordHash: hashedNewPassword 
        }, (res) => {
          if (res && res.error) {
            setUnlockError(res.error);
          } else {
            const unlockedId = unlockModalFolder.id;
            setUnlockModalFolder(null);
            setIsRecoveryMode(null);
            showToast('Password Reset', 'Folder password updated and unlocked successfully.', 'success');
            chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (response) => {
              if (response && Array.isArray(response)) {
                const typed = response as FolderSession[];
                setFoldersList(typed);
                const nextExpanded = new Set(expandedMapFoldersRef.current);
                nextExpanded.add(unlockedId);
                setExpandedMapFolders(nextExpanded);
                initializeLayout(typed, Array.from(visibleFolderIdsRef.current), isLayoutFrozenRef.current, savedPositionsRef.current, nextExpanded);
              }
            });
          }
        });
      });
    } else {
      const enteredHash = await sha256(unlockModalFolder.id + unlockPassword);
      chrome.runtime.sendMessage({ 
        type: 'UNLOCK_FOLDER', 
        sessionId: unlockModalFolder.id, 
        passwordHash: enteredHash 
      }, (res) => {
        if (res && res.error) {
          setUnlockError(res.error);
        } else {
          const unlockedId = unlockModalFolder.id;
          const unlockedName = unlockModalFolder.name;
          setUnlockModalFolder(null);
          showToast('Folder Unlocked', `Successfully unlocked "${unlockedName}".`, 'success');
          chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (response) => {
            if (response && Array.isArray(response)) {
              const typed = response as FolderSession[];
              setFoldersList(typed);
              const nextExpanded = new Set(expandedMapFoldersRef.current);
              nextExpanded.add(unlockedId);
              setExpandedMapFolders(nextExpanded);
              initializeLayout(typed, Array.from(visibleFolderIdsRef.current), isLayoutFrozenRef.current, savedPositionsRef.current, nextExpanded);
            }
          });
        }
      });
    }
  };

  const handleFolderClick = (folderId: string) => {
    if (draggedRef.current) return;
    const folderData = foldersList.find(f => f.id === folderId);
    if (folderData?.isLocked) {
      setUnlockModalFolder(folderData);
      setUnlockPassword('');
      setRecoveryWordInput('');
      setUnlockError('');
      setIsRecoveryMode(null);
      setShowUnlockPassword(false);
      setShowRecoveryNewPassword(false);
      return;
    }

    const isExpanded = expandedMapFolders.has(folderId);
    if (isExpanded) {
      const nextSet = new Set(expandedMapFolders);
      nextSet.delete(folderId);
      setExpandedMapFolders(nextSet);
      setNodes(prev => prev.filter(n => !(n.type === 'tab' && n.parentId === folderId)));
    }
  };

  const handleFolderDoubleClick = (folderId: string) => {
    const folderData = foldersList.find(f => f.id === folderId);
    if (folderData?.isLocked) {
      setUnlockModalFolder(folderData);
      setUnlockPassword('');
      setRecoveryWordInput('');
      setUnlockError('');
      setIsRecoveryMode(null);
      setShowUnlockPassword(false);
      setShowRecoveryNewPassword(false);
      return;
    }

    const isExpanded = expandedMapFolders.has(folderId);
    if (isExpanded) return;

    const folderNode = nodes.find(n => n.id === folderId);
    if (!folderNode || !folderData) return;

    const tabs = folderData.tabs || [];
    const tabCount = tabs.length;
    if (tabCount === 0) {
      showToast('Empty Folder', `"${folderData.name}" has no tabs yet. Drag tabs here to add.`, 'info');
      return;
    }

    const nextSet = new Set(expandedMapFolders);
    nextSet.add(folderId);
    setExpandedMapFolders(nextSet);

    const newTabNodes: MapNode[] = [];

    tabs.forEach((tab, j) => {
      const tabId = `${folderId}-tab-${j}`;
      
      // Check if there is already a saved position (in case layout is frozen)
      const savedPos = savedPositionsRef.current[tabId];
      const defaultPos = getTabOrbitPosition(folderNode.x, folderNode.y, j, tabCount);
      
      const tx = savedPos ? savedPos.x : defaultPos.x;
      const ty = savedPos ? savedPos.y : defaultPos.y;

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
    
    const colors = MAP_COLORS;

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
          const defaultPos = getTabOrbitPosition(fx, fy, j, tabCount);
          
          const tx = (frozen && positions[tabId]) ? positions[tabId].x : defaultPos.x;
          const ty = (frozen && positions[tabId]) ? positions[tabId].y : defaultPos.y;

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

  // Load folders on mount and listen for updates
  useEffect(() => {
    const loadMapData = () => {
      chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, async (res) => {
        setLoading(false);
        if (res && Array.isArray(res)) {
          const typedRes = res as FolderSession[];
          setFoldersList(typedRes);
          const allIds = typedRes.map((f) => f.id);
          
          setVisibleFolderIds(prev => {
            if (prev.size === 0) return new Set(allIds);
            // Retain active folders that still exist
            const updated = new Set<string>();
            prev.forEach(id => {
              if (allIds.includes(id)) updated.add(id);
            });
            return updated.size > 0 ? updated : new Set(allIds);
          });
          
          try {
            const db = await import('@/storage/db');
            const isFrozenSetting = await db.getSetting<boolean>('map_frozen', false);
            const positionsSetting = await db.getSetting<Record<string, {x: number, y: number}>>('map_positions', {});
            
            setIsLayoutFrozen(isFrozenSetting);
            setSavedPositions(positionsSetting);
            
            const activeIds = visibleFolderIdsRef.current.size > 0 ? Array.from(visibleFolderIdsRef.current) : allIds;
            initializeLayout(typedRes, activeIds, isFrozenSetting, positionsSetting, expandedMapFoldersRef.current);
          } catch (e) {
            console.error("Error loading map settings:", e);
            initializeLayout(typedRes, allIds, false, {}, expandedMapFoldersRef.current);
          }
        }
      });
    };

    loadMapData();
    const handleMsg = (msg: any) => {
      if (msg?.type === 'REFRESH_FOLDERS') {
        loadMapData();
      }
    };
    chrome.runtime.onMessage.addListener(handleMsg);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMsg);
    };
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
    if (!targetNode) return;

    const folderData = foldersList.find(f => f.id === nodeId);
    const isFolderLocked = !!(targetNode.isLocked || folderData?.isLocked);

    if (targetNode.type === 'folder' && isFolderLocked) {
      showToast('Folder Locked', `"${folderData?.name || targetNode.label}" is locked. Unlock to use it.`, 'info');
      setDraggedNodeId(null);
      draggedRef.current = false;
      return;
    }

    if (isLayoutFrozen) {
      showToast('Layout Locked', 'Workspace layout is locked. Unlock at top right to reposition folders or move tabs.', 'info');
      setDraggedNodeId(null);
      draggedRef.current = false;
      return;
    }

    if (targetNode.type === 'tab' && targetNode.parentId) {
      const parentFolderNode = nodes.find(n => n.id === targetNode.parentId);
      const parentFolderData = foldersList.find(f => f.id === targetNode.parentId);
      const isParentLocked = !!(parentFolderNode?.isLocked || parentFolderData?.isLocked);
      if (isParentLocked) {
        const folderTitle = parentFolderData?.name || parentFolderNode?.label || 'Folder';
        showToast('Folder Locked', `"${folderTitle}" is locked. Unlock to use it.`, 'info');
        setDraggedNodeId(null);
        draggedRef.current = false;
        return;
      }
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
        setDropTargetFolderId(null);
        showToast('Layout Locked', 'Workspace layout is locked. Unlock at top right to reposition folders or move tabs.', 'info');
        return;
      }
      draggedRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 800;
      const clickY = ((e.clientY - rect.top) / rect.height) * 600;
      
      const x = (clickX - pan.x) / zoom;
      const y = (clickY - pan.y) / zoom;
      
      const dNode = nodes.find(n => n.id === draggedNodeId);
      if (dNode && dNode.type === 'tab' && dNode.parentId) {
        const target = nodes.find(n => 
          n.type === 'folder' && 
          n.id !== dNode.parentId &&
          Math.sqrt(Math.pow(n.x - x, 2) + Math.pow(n.y - y, 2)) < Math.max(70, (n.size || 18) + 45)
        );
        setDropTargetFolderId(target ? target.id : null);
      } else {
        setDropTargetFolderId(null);
      }

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
    const currentTargetId = dropTargetFolderId;
    setDropTargetFolderId(null);

    if (draggedNodeId) {
      if (isLayoutFrozen) {
        setDraggedNodeId(null);
        setIsPanning(false);
        showToast('Layout Locked', 'Workspace layout is locked. Unlock at top right to reposition folders or move tabs.', 'info');
        initializeLayout(foldersList, Array.from(visibleFolderIds), true, savedPositionsRef.current, expandedMapFoldersRef.current);
        return;
      }

      const draggedNode = nodes.find(n => n.id === draggedNodeId);
      if (draggedNode && draggedNode.type === 'tab' && draggedNode.parentId) {
        const sourceFolder = foldersList.find(f => f.id === draggedNode.parentId);
        const sourceNode = nodes.find(n => n.id === draggedNode.parentId);
        const isSourceLocked = !!(sourceFolder?.isLocked || sourceNode?.isLocked);
        if (isSourceLocked) {
          showToast("Folder Locked", `"${sourceFolder?.name || sourceNode?.label || 'Folder'}" is locked. Unlock to use it.`, "info");
          setDraggedNodeId(null);
          setIsPanning(false);
          initializeLayout(foldersList, Array.from(visibleFolderIds), isLayoutFrozenRef.current, savedPositionsRef.current, expandedMapFoldersRef.current);
          return;
        }

        // Check if dropped near any folder node (excluding its own parent)
        const targetFolder = nodes.find(n => 
          n.type === 'folder' && 
          n.id !== draggedNode.parentId &&
          (n.id === currentTargetId || Math.sqrt(Math.pow(n.x - draggedNode.x, 2) + Math.pow(n.y - draggedNode.y, 2)) < Math.max(70, (n.size || 18) + 45))
        );

        if (targetFolder) {
          const targetFolderData = foldersList.find(f => f.id === targetFolder.id);
          const isTargetLocked = !!(targetFolder.isLocked || targetFolderData?.isLocked);

          if (isTargetLocked) {
            showToast("Folder Locked", `"${targetFolderData?.name || targetFolder.label}" is locked. Unlock to use it.`, "info");
            setDraggedNodeId(null);
            setIsPanning(false);
            initializeLayout(foldersList, Array.from(visibleFolderIds), isLayoutFrozenRef.current, savedPositionsRef.current, expandedMapFoldersRef.current);
            return;
          }

          const tabTitle = draggedNode.label;
          const tabUrl = draggedNode.url || '';
          const sourceFolderId = draggedNode.parentId;
          const destFolderId = targetFolder.id;
          const destFolderName = targetFolderData?.name || targetFolder.label;

          try {
            const res = await new Promise<any>((resolve, reject) => {
              chrome.runtime.sendMessage({
                type: 'MOVE_TAB',
                sourceSessionId: sourceFolderId,
                targetSessionId: destFolderId,
                url: tabUrl
              }, (response) => {
                if (response && response.error) reject(new Error(response.error));
                else resolve(response);
              });
            });

            if (res && res.error) {
              showToast("Action Failed", res.error, "error");
              initializeLayout(foldersList, Array.from(visibleFolderIds), isLayoutFrozenRef.current, savedPositionsRef.current, expandedMapFoldersRef.current);
            } else {
              showToast("Tab Moved", `Successfully moved "${tabTitle}" to "${destFolderName}".`, "success");

              // Clear stale tab positions for source & dest from savedPositions so they re-orbit cleanly
              const nextPositions = { ...savedPositionsRef.current };
              Object.keys(nextPositions).forEach(k => {
                if (k.startsWith(`${sourceFolderId}-tab-`) || k.startsWith(`${destFolderId}-tab-`)) {
                  delete nextPositions[k];
                }
              });
              setSavedPositions(nextPositions);
              savedPositionsRef.current = nextPositions;

              // Reload folders list and initialize layout with both source and destination folders expanded
              chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (response) => {
                if (response && Array.isArray(response)) {
                  const typedRes = response as FolderSession[];
                  setFoldersList(typedRes);
                  const activeIds = Array.from(visibleFolderIds);
                  const nextExpanded = new Set(expandedMapFoldersRef.current);
                  nextExpanded.add(sourceFolderId);
                  nextExpanded.add(destFolderId);
                  setExpandedMapFolders(nextExpanded);
                  initializeLayout(typedRes, activeIds, isLayoutFrozenRef.current, nextPositions, nextExpanded);
                }
              });
            }
          } catch (err: any) {
            console.error("Failed to move tab:", err);
            showToast("Action Failed", err?.message || "Could not move tab to the destination folder.", "error");
            initializeLayout(foldersList, Array.from(visibleFolderIds), isLayoutFrozenRef.current, savedPositionsRef.current, expandedMapFoldersRef.current);
          }

          setDraggedNodeId(null);
          setIsPanning(false);
          return;
        }

        // If tab was dropped in empty space (not onto any other folder), snap back to its parent folder's orbit
        initializeLayout(foldersList, Array.from(visibleFolderIds), isLayoutFrozenRef.current, savedPositionsRef.current, expandedMapFoldersRef.current);
        setDraggedNodeId(null);
        setIsPanning(false);
        return;
      }
      if (isLayoutFrozen) {
        initializeLayout(foldersList, Array.from(visibleFolderIds), true, savedPositionsRef.current, expandedMapFoldersRef.current);
      } else {
        await saveCurrentPositions(nodes);
      }
    }

    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleAutoLayout = async () => {
    if (isLayoutFrozen) {
      showToast('Layout Locked', 'Workspace layout is locked. Unlock at top right before auto-organizing.', 'info');
      return;
    }

    // Deep clone nodes to prevent direct state mutation during simulation
    const tempNodes: MapNode[] = nodes.map(n => ({ ...n }));
    const folderNodes = tempNodes.filter(n => n.type === 'folder');
    
    if (folderNodes.length === 0) return;

    const iterations = 100;
    const width = 800;
    const height = 600;
    const center = { x: 400, y: 300 };

    if (folderNodes.length === 1) {
      folderNodes[0].x = center.x;
      folderNodes[0].y = center.y;
    } else {
      for (let step = 0; step < iterations; step++) {
        // Folder-folder repulsion
        for (let i = 0; i < folderNodes.length; i++) {
          for (let j = i + 1; j < folderNodes.length; j++) {
            const fA = folderNodes[i];
            const fB = folderNodes[j];
            const dx = fA.x - fB.x;
            const dy = fA.y - fB.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            const minDesiredDist = 200;
            if (dist < minDesiredDist) {
              const force = (minDesiredDist - dist) * 0.08;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              fA.x += fx;
              fA.y += fy;
              fB.x -= fx;
              fB.y -= fy;
            }
          }
        }

        // Center gravity to keep folders nicely inside canvas
        folderNodes.forEach(f => {
          const dx = center.x - f.x;
          const dy = center.y - f.y;
          f.x += dx * 0.02;
          f.y += dy * 0.02;

          // Clamp to boundary with padding
          f.x = Math.max(120, Math.min(width - 120, f.x));
          f.y = Math.max(120, Math.min(height - 120, f.y));
        });
      }
    }

    // Organize child tabs into clean orbital rings around their settled parent folder
    folderNodes.forEach(folder => {
      const childTabs = tempNodes.filter(n => n.type === 'tab' && n.parentId === folder.id);
      const tabCount = childTabs.length;
      childTabs.forEach((tab, idx) => {
        const orbitPos = getTabOrbitPosition(folder.x, folder.y, idx, tabCount);
        tab.x = orbitPos.x;
        tab.y = orbitPos.y;
      });
    });

    setNodes(tempNodes);
    await saveCurrentPositions(tempNodes);
    showToast('Layout Organized', 'Workspace Map nodes have been auto-arranged and organized.', 'success');
  };

  const handleDoubleClick = (url?: string) => {
    if (url) {
      const safeUrl = sanitizeUrl(url);
      if (!isValidUrl(safeUrl)) {
        showToast('Restricted URL', 'This system URL cannot be opened for browser security reasons.', 'error');
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
    <div className="flex h-[calc(100vh-140px)] gap-8 overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-[280px] flex flex-col gap-5 shrink-0 pr-6 border-r border-white/[0.06]">
        <div>
          <h3 className="text-base font-semibold text-white mb-1.5 flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-400" /> Workspace Map
          </h3>
          <div className="text-[11.5px] text-white/40 leading-relaxed select-none">
            <p>Drag nodes to organize workspaces.</p>
            <p className="mt-0.5">Double&#8209;click to open, hover for details.</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search tabs or folders..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSidebarPage(1);
            }}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSidebarPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/40 hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toggle Domain Similarity Links */}
        <div className="flex items-center justify-between py-2 border-y border-white/[0.05]">
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
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Visible Workspaces</span>
              <span className="text-[10px] text-white/30 font-medium">({foldersList.length})</span>
            </div>
            {foldersList.length > 1 && (
              <div className="flex items-center gap-1.5 select-none text-[10px]">
                <button 
                  onClick={handleShowAllFolders}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                  title="Show all workspaces on map"
                >
                  All
                </button>
                <span className="text-white/20">/</span>
                <button 
                  onClick={() => {
                    const activeIds = foldersList.filter(f => (f.tabs && f.tabs.length > 0) || f.isLocked).map(f => f.id);
                    setVisibleFolderIds(new Set(activeIds));
                    initializeLayout(foldersList, activeIds);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                  title="Show only workspaces with tabs"
                >
                  Active
                </button>
                <span className="text-white/20">/</span>
                <button 
                  onClick={handleHideAllFolders}
                  className="text-white/40 hover:text-white/60 font-medium transition-colors cursor-pointer"
                  title="Hide all workspaces from map"
                >
                  None
                </button>
              </div>
            )}
          </div>

          {/* Paginated & Filtered Folder List */}
          {(() => {
            const queryClean = searchQuery.trim().toLowerCase();
            const filtered = foldersList.filter(f => 
              !queryClean || f.name.toLowerCase().includes(queryClean) || (f.tabs || []).some((t: any) => (t.title || '').toLowerCase().includes(queryClean) || (t.url || '').toLowerCase().includes(queryClean))
            );
            const itemsPerPage = 6;
            const totalSidebarPages = Math.ceil(filtered.length / itemsPerPage);
            const activeSidebarPage = Math.max(1, Math.min(sidebarPage, totalSidebarPages || 1));
            const paginated = filtered.slice((activeSidebarPage - 1) * itemsPerPage, activeSidebarPage * itemsPerPage);

            return (
              <div className="flex-1 flex flex-col gap-2 min-h-0 justify-between">
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                  {paginated.length === 0 ? (
                    <div className="text-[11px] text-white/30 text-center py-6">No matching workspaces</div>
                  ) : (
                    paginated.map(folder => {
                      const isVisible = visibleFolderIds.has(folder.id);
                      const folderColor = MAP_COLORS[foldersList.indexOf(folder) % MAP_COLORS.length] || '#3b82f6';
                      return (
                        <label 
                          key={folder.id} 
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-all ${
                            isVisible 
                              ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]' 
                              : 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => handleToggleFolder(folder.id)}
                              className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folderColor }} />
                            <span className="text-xs text-white/80 font-medium truncate select-none" title={folder.name}>
                              {folder.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded shrink-0 ml-1">
                            {folder.tabs?.length || 0} tabs
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Sidebar Pagination Footer - Only shown when workspaces span across multiple pages */}
                {totalSidebarPages > 1 && (
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5 mt-1 select-none shrink-0 text-xs">
                    <button
                      disabled={activeSidebarPage <= 1}
                      onClick={() => setSidebarPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-[11px] font-medium shrink-0"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalSidebarPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setSidebarPage(page)}
                          className={`w-6 h-6 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center cursor-pointer ${
                            activeSidebarPage === page
                              ? 'bg-white/15 text-white border border-white/20'
                              : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      disabled={activeSidebarPage >= totalSidebarPages}
                      onClick={() => setSidebarPage(p => Math.min(totalSidebarPages, p + 1))}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-[11px] font-medium shrink-0"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Interactive Map Visualizer */}
      <div className="flex-1 relative overflow-hidden">
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
                const folderData = foldersList.find(f => f.id === node.id);
                const isLocked = !!(node.isLocked || folderData?.isLocked);
                const tabCount = (folderData?.tabs || []).length;
                const isDropTarget = dropTargetFolderId === node.id;
                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x}, ${node.y})`}
                    className={isLocked || isLayoutFrozen ? "cursor-not-allowed transition-transform duration-300" : "cursor-grab active:cursor-grabbing transition-transform duration-300"}
                    style={{ opacity }}
                    onMouseDown={(e) => handleMouseDown(node.id, e)}
                    onClick={(e) => { e.stopPropagation(); handleFolderClick(node.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleFolderDoubleClick(node.id); }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {isDropTarget && !isLocked && (
                      <>
                        <circle 
                          r={folderSize + 22} 
                          fill="none" 
                          stroke="#10b981" 
                          strokeWidth="2.5" 
                          strokeDasharray="4,4" 
                          opacity="0.9"
                          style={{ animation: 'dash 3s linear infinite' }} 
                        />
                        <circle r={folderSize + 14} fill="#10b981" opacity="0.2" />
                        <text
                          y={-(folderSize + 12)}
                          textAnchor="middle"
                          fill="#34d399"
                          fontSize="9"
                          fontWeight="bold"
                          className="pointer-events-none select-none font-sans drop-shadow-md"
                        >
                          Drop to Move
                        </text>
                      </>
                    )}
                    {isDropTarget && isLocked && (
                      <>
                        <circle 
                          r={folderSize + 22} 
                          fill="none" 
                          stroke="#ef4444" 
                          strokeWidth="2.5" 
                          strokeDasharray="4,4" 
                          opacity="0.9"
                          style={{ animation: 'dash 3s linear infinite' }} 
                        />
                        <circle r={folderSize + 14} fill="#ef4444" opacity="0.2" />
                        <text
                          y={-(folderSize + 12)}
                          textAnchor="middle"
                          fill="#f87171"
                          fontSize="9"
                          fontWeight="bold"
                          className="pointer-events-none select-none font-sans drop-shadow-md"
                        >
                          Folder Locked 🔒
                        </text>
                      </>
                    )}
                    <circle r={folderSize + 4} fill={isDropTarget ? (isLocked ? '#ef4444' : '#10b981') : (isLocked ? '#ef4444' : node.color)} opacity={isDropTarget ? 0.35 : (isLocked ? 0.25 : 0.12)} style={{ filter: glow !== 'none' || isDropTarget ? 'blur(4px)' : 'none' }} />
                    <circle
                      r={folderSize}
                      fill="#0f0e15"
                      stroke={isDropTarget ? (isLocked ? '#ef4444' : '#10b981') : (isLocked ? '#ef4444' : node.color)}
                      strokeWidth={isDropTarget ? "3.5" : (isLocked ? "3" : "2.5")}
                      className="transition-all duration-300"
                      style={{ transform: `scale(${isDropTarget ? 1.2 : scale})` }}
                    />
                    <text
                      y="4"
                      textAnchor="middle"
                      fill="white"
                      fontSize="11"
                      fontWeight="bold"
                      className="pointer-events-none select-none font-sans"
                    >
                      {isLocked ? '🔒' : '📁'}
                    </text>
                    <text
                      y={folderSize + 18}
                      textAnchor="middle"
                      fill={isDropTarget ? (isLocked ? '#f87171' : '#34d399') : (isLocked ? '#fca5a5' : 'white')}
                      fontSize="10"
                      fontWeight={isDropTarget || isLocked ? "bold" : "500"}
                      className="pointer-events-none select-none drop-shadow-md bg-black/60 font-sans"
                    >
                      {node.label}{isLocked ? ' 🔒' : ''}
                    </text>
                    {tabCount === 0 && !isLocked && (
                      <text
                        y={folderSize + 29}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.4)"
                        fontSize="8.5"
                        fontWeight="normal"
                        className="pointer-events-none select-none font-sans"
                      >
                        (empty)
                      </text>
                    )}
                  </g>
                );
              } else {
                const isBeingDragged = draggedNodeId === node.id;
                const parentFolder = nodes.find(p => p.id === node.parentId) || foldersList.find(f => f.id === node.parentId);
                const isParentLocked = !!parentFolder?.isLocked;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={isParentLocked || isLayoutFrozen ? "cursor-not-allowed transition-transform duration-300 opacity-60" : "cursor-grab active:cursor-grabbing transition-transform duration-300"}
                    style={{ opacity: isParentLocked ? 0.5 : opacity }}
                    onMouseDown={(e) => handleMouseDown(node.id, e)}
                    onDoubleClick={() => handleDoubleClick(node.url)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle r={isBeingDragged ? "18" : "13"} fill={isBeingDragged ? "#10b981" : node.color} opacity={isBeingDragged ? "0.3" : "0.08"} />
                    <circle
                      r={isBeingDragged ? "12" : "9.5"}
                      fill="#15141e"
                      stroke={isBeingDragged ? "#10b981" : node.color}
                      strokeWidth={isBeingDragged ? "2.5" : "1.5"}
                      style={{ transform: `scale(${isBeingDragged ? 1.25 : scale})`, filter: isBeingDragged ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : glow !== 'none' ? 'blur(1px)' : 'none' }}
                      className="transition-all duration-200"
                    />
                    {node.favIconUrl && isValidUrl(node.favIconUrl) ? (
                      <image
                        href={node.favIconUrl}
                        x={isBeingDragged ? "-8" : "-6.5"}
                        y={isBeingDragged ? "-8" : "-6.5"}
                        width={isBeingDragged ? "16" : "13"}
                        height={isBeingDragged ? "16" : "13"}
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
            disabled={isLayoutFrozen}
            onClick={handleAutoLayout}
            className={`flex items-center gap-1.5 border transition-colors px-3 py-1.5 rounded-xl text-xs font-medium ${
              isLayoutFrozen 
                ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/5 text-white/50' 
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10 cursor-pointer'
            }`}
            title={isLayoutFrozen ? "Unlock layout to auto-organize" : "Auto-Organize Graph layout"}
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
            onClick={async () => { 
              setZoom(1); 
              setPan({ x: 0, y: 0 }); 
              setIsLayoutFrozen(false);
              setSavedPositions({});
              const db = await import('@/storage/db');
              await db.setSetting('map_frozen', false);
              await db.setSetting('map_positions', {});
              initializeLayout(foldersList, Array.from(visibleFolderIds), false, {});
              showToast('Layout Reset', 'Zoom, pan, and layout positions have been reset.', 'info');
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

        {/* Workspace Map Folder Unlock Modal */}
        <AnimatePresence>
          {unlockModalFolder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setUnlockModalFolder(null); setIsRecoveryMode(null); }} className="fixed inset-0 bg-black/75 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e121a]/95 backdrop-blur-xl p-4.5 shadow-2xl shadow-black/90 text-center">
                <button onClick={() => { setUnlockModalFolder(null); setIsRecoveryMode(null); }} className="absolute top-3.5 right-3.5 w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-2 text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-semibold text-white mb-0.5">
                  {isRecoveryMode === 'verify_word' ? 'Verify Recovery' : isRecoveryMode === 'new_password' ? 'Reset Password' : `Unlock "${unlockModalFolder.name}"`}
                </h3>
                <p className="text-[11px] text-white/50 mb-3 leading-normal">
                  {isRecoveryMode === 'verify_word' ? 'Enter secret recovery word to reset password.' : isRecoveryMode === 'new_password' ? 'Enter a new password.' : 'Enter password to unlock and manage this folder.'}
                </p>
                
                <div className="space-y-3 mb-3.5 text-left">
                  {isRecoveryMode === 'verify_word' ? (
                    unlockModalFolder.recoveryWord ? (
                      <input 
                        type="text" 
                        placeholder="Recovery Word" 
                        value={recoveryWordInput} 
                        onChange={e => setRecoveryWordInput(e.target.value)} 
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUnlockSubmit();
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all text-center" 
                        autoFocus
                      />
                    ) : (
                      <p className="text-[10px] text-red-400/80 text-center bg-red-400/10 border border-red-400/20 p-2 rounded-lg leading-normal">
                        No recovery word set up. Recovery not possible.
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
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all" 
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowRecoveryNewPassword(!showRecoveryNewPassword)}
                        className="absolute right-2.5 text-white/40 hover:text-white transition-colors"
                      >
                        {showRecoveryNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all" 
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                        className="absolute right-2.5 text-white/40 hover:text-white transition-colors"
                      >
                        {showUnlockPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                  {unlockError && <p className="text-[11px] text-red-400 text-center">{unlockError}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  {(!isRecoveryMode || isRecoveryMode !== 'verify_word' || unlockModalFolder.recoveryWord) && (
                    <button 
                      onClick={handleUnlockSubmit} 
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                    >
                      {isRecoveryMode === 'verify_word' ? 'Verify Word' : isRecoveryMode === 'new_password' ? 'Reset Lock' : 'Unlock'}
                    </button>
                  )}
                  {!isRecoveryMode ? (
                    unlockModalFolder.password && (
                      <button onClick={() => { setIsRecoveryMode('verify_word'); setUnlockPassword(''); setRecoveryWordInput(''); setRecoveryNewPassword(''); setUnlockError(''); }} className="text-[11px] text-white/40 hover:text-white transition-colors">Forgot Password?</button>
                    )
                  ) : (
                    <button onClick={() => { setIsRecoveryMode(null); setUnlockError(''); }} className="text-[11px] text-indigo-400/80 hover:text-indigo-400 transition-colors">Back to Unlock</button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
