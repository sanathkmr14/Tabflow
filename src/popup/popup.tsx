import '../utils/chrome-polyfill';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getSessions, WorkspaceSession } from '../storage/db';
import { Folder, LayoutDashboard, Plus, ExternalLink, Lock, Unlock, XSquare, AlertCircle, Eye, EyeOff, CheckCircle2, Info } from 'lucide-react';
import '../styles/globals.css';
import { sha256 } from '../utils/crypto';
import { isValidUrl } from '../utils/url';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Popup uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-[320px] bg-[#0a0a0a] text-white p-6 font-sans text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-2">Something went wrong</h3>
          <p className="text-[11px] text-white/50 mb-4">{this.state.error?.message || 'Unknown error'}</p>
          <button onClick={() => window.location.reload()} className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium rounded-full text-xs transition-colors">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
interface PromptModalProps {
  config: {
    title: string;
    description: string;
    isPassword?: boolean;
    onSubmit: (value: string) => string | null | Promise<string | null>;
    onCancel: () => void;
    onForgot?: () => void;
  };
}

const PromptModal: React.FC<PromptModalProps> = ({ config }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const errorMsg = await config.onSubmit(inputValue);
      if (errorMsg) {
        setError(errorMsg);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="relative bg-[#0d1322]/95 border border-white/12 rounded-3xl w-full max-w-[280px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3.5 overflow-hidden">
        {/* Top subtle highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
        
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-white tracking-tight mb-1">{config.title}</h3>
          <p className="text-[11px] text-slate-300/80 leading-relaxed">{config.description}</p>
        </div>
        
        <div className="relative flex items-center w-full">
          <input
            autoFocus
            type={config.isPassword && !showPassword ? 'password' : 'text'}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••"
            className={`w-full bg-white/5 border rounded-xl pl-4 pr-11 py-2.5 text-xs text-white focus:outline-none transition-all ${
              error 
                ? 'border-red-500/50 focus:border-red-500' 
                : 'border-white/10 focus:border-blue-500/50'
            }`}
            disabled={isLoading}
          />
          {config.isPassword && (
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-white/40 hover:text-white transition-colors"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {error && (
          <p className="text-[10px] text-red-400 text-center font-medium">
            {error}
          </p>
        )}
        {config.onForgot && (
          <button
            type="button"
            onClick={config.onForgot}
            className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline text-center cursor-pointer -mt-1 font-medium transition-colors"
          >
            Forgot password? Open in dashboard
          </button>
        )}
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={config.onCancel}
            className="flex-1 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.98] transition-all rounded-xl text-xs font-semibold text-white/80 border border-white/10"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-[0.98] transition-all rounded-xl text-xs font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
};



const Popup = () => {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    description: string;
    isPassword?: boolean;
    onSubmit: (value: string) => string | null | Promise<string | null>;
    onCancel: () => void;
    onForgot?: () => void;
  } | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'info' | 'success';
    onClose: () => void;
  } | null>(null);

  const loadSessions = async () => {
    try {
      const response = await new Promise<any[]>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (res) => {
          if (res && Array.isArray(res)) resolve(res);
          else resolve([]);
        });
      });
      if (response && response.length > 0) {
        const pinnedSessions = response.filter(s => s.isPinned);
        setSessions(pinnedSessions.slice(0, 5));
        return;
      }
    } catch {}

    const allSessions = await getSessions();
    const pinnedSessions = allSessions.filter(s => s.isPinned);
    const displaySessions = pinnedSessions.slice(0, 5);
    setSessions(displaySessions);
  };

  useEffect(() => {
    loadSessions();
    const handleMsg = (msg: any) => {
      if (msg?.type === 'REFRESH_FOLDERS') {
        loadSessions();
      }
    };
    chrome.runtime.onMessage.addListener(handleMsg);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMsg);
    };
  }, []);

  const openDashboard = (folderId?: string) => {
    let url = chrome.runtime.getURL('src/dashboard/index.html');
    if (folderId) {
      url += `?folder=${folderId}`;
    }
    chrome.tabs.create({ url });
    window.close();
  };

  const showModalAlert = (title: string, message: string, type: 'error' | 'info' | 'success' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setAlertConfig({
        title,
        message,
        type,
        onClose: () => {
          setAlertConfig(null);
          resolve();
        }
      });
    });
  };

  const showModalPrompt = (
    title: string,
    description: string,
    onSubmit: (value: string) => string | null | Promise<string | null>,
    onForgot?: () => void
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalConfig({
        title,
        description,
        isPassword: true,
        onSubmit: async (val) => {
          const err = await onSubmit(val);
          if (err === null) {
            resolve(true);
            setModalConfig(null);
          }
          return err;
        },
        onCancel: () => {
          resolve(false);
          setModalConfig(null);
        },
        onForgot
      });
    });
  };

  const verifyAndUnlockSession = async (session: WorkspaceSession): Promise<string | null> => {
    if (!session.isLocked) return ""; // Already unlocked, no password hash needed
    
    let correctHash: string | null = null;
    const verified = await showModalPrompt(
      "Unlock Workspace",
      `"${session.name}" is locked. Enter password:`,
      async (password: string) => {
        const enteredHash = await sha256(session.id + password);
        const isCorrect = await new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage({
            type: 'VERIFY_PASSWORD',
            sessionId: session.id,
            passwordHash: enteredHash
          }, resolve);
        });

        if (isCorrect) {
          correctHash = enteredHash;
          // Immediately unlock folder so it doesn't require unlocking twice
          await new Promise<void>((resolveUnlock) => {
            chrome.runtime.sendMessage({
              type: 'UNLOCK_FOLDER',
              sessionId: session.id,
              passwordHash: enteredHash
            }, () => resolveUnlock());
          });
          return null; // Success, closes modal
        } else {
          return "Incorrect password.";
        }
      },
      () => {
        setModalConfig(null);
        openDashboard(session.id);
      }
    );
    
    if (verified && correctHash) {
      // Optimistically update local UI state immediately
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isLocked: false } : s));
      loadSessions();
      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' });
      return correctHash;
    }
    
    return null;
  };

  const handleSaveTab = async (e: React.MouseEvent, session: WorkspaceSession) => {
    e.stopPropagation();
    
    const passwordHash = await verifyAndUnlockSession(session);
    if (passwordHash === null) return;

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs && tabs.length > 0) tab = tabs[0];
    }

    if (tab && tab.url) {
      if (!isValidUrl(tab.url)) {
        await showModalAlert("Cannot Save Tab", "Internal browser pages (like chrome:// or settings) cannot be saved.", "error");
        return;
      }
      chrome.runtime.sendMessage({
        type: 'ADD_TAB_TO_FOLDER',
        sessionId: session.id,
        tab: { url: tab.url, title: tab.title || '', favIconUrl: tab.favIconUrl },
        passwordHash
      }, async (res) => {
        if (res && res.error) {
          await showModalAlert("Error", res.error, "error");
        } else if (res && !res.added) {
          await showModalAlert("Tab Already Saved", "This tab is already in the folder.", "info");
        } else {
          chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' });
          await showModalAlert("Success", `Tab successfully added to "${session.name}"!`, "success");
          window.close();
        }
      });
    } else {
      await showModalAlert("No Tab Detected", "Could not find an active web tab to save.", "error");
    }
  };

  const handleOpenAll = async (e: React.MouseEvent, session: WorkspaceSession) => {
    e.stopPropagation();
    const passwordHash = await verifyAndUnlockSession(session);
    if (passwordHash === null) return;

    if (session.tabs && session.tabs.length > 0) {
      chrome.runtime.sendMessage({ 
        type: 'OPEN_FOLDER_TABS', 
        sessionId: session.id, 
        target: 'current',
        passwordHash 
      }, () => {
        window.close();
      });
    }
  };

  const handleCloseAll = async (e: React.MouseEvent, session: WorkspaceSession) => {
    e.stopPropagation();
    const passwordHash = await verifyAndUnlockSession(session);
    if (passwordHash === null) return;

    if (session.tabs && session.tabs.length > 0) {
      chrome.runtime.sendMessage({ 
        type: 'CLOSE_FOLDER_TABS', 
        sessionId: session.id,
        passwordHash 
      }, () => {
        window.close();
      });
    }
  };

  const handleToggleLock = async (e: React.MouseEvent, session: WorkspaceSession) => {
    e.stopPropagation();
    if (session.isLocked) {
      const passwordHash = await verifyAndUnlockSession(session);
      if (passwordHash !== null) {
        // verifyAndUnlockSession already verified, called UNLOCK_FOLDER, and updated state!
        await loadSessions();
      }
    } else {
      const isPasswordSet = !!session.password;
      if (!isPasswordSet) {
        await showModalAlert("Lock Workspace", "Please set a password in the workspace first to lock this folder.");
        openDashboard(session.id);
        return;
      }
      chrome.runtime.sendMessage({ type: 'LOCK_FOLDER', sessionId: session.id }, async () => {
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isLocked: true } : s));
        await loadSessions();
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' });
      });
    }
  };

  return (
    <div className="w-[320px] bg-[#0a0a0a] text-white p-4 font-sans">
      {modalConfig && <PromptModal config={modalConfig} />}
      {alertConfig && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative bg-[#0d1322]/95 border border-white/12 rounded-3xl w-full max-w-[280px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3.5 text-center overflow-hidden">
            {/* Top subtle highlight */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent ${
              alertConfig.type === 'error' ? 'via-red-500/60' : alertConfig.type === 'success' ? 'via-emerald-500/60' : 'via-blue-500/60'
            } to-transparent`} />

            {/* Glowing Icon Badge */}
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border ${
              alertConfig.type === 'error' 
                ? 'bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                : alertConfig.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-[#006199]/20 border-[#006199]/40 text-[#76C0EC] shadow-[0_0_20px_rgba(66,91,154,0.2)]'
            }`}>
              {alertConfig.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : alertConfig.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-white tracking-tight mb-1">{alertConfig.title}</h3>
              <p className="text-[11px] text-slate-300/80 leading-relaxed">{alertConfig.message}</p>
            </div>

            <button
              onClick={alertConfig.onClose}
              className="mt-1 py-2.5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-[0.98] transition-all rounded-xl text-xs font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-[#EEF4FB] border border-[#425B9A]/30 shadow-[0_2px_10px_rgba(66,91,154,0.35)] flex items-center justify-center p-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <defs>
              <linearGradient id="pop_hb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2e4070"/><stop offset="100%" stopColor="#425B9A"/></linearGradient>
              <linearGradient id="pop_hm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#76C0EC"/><stop offset="100%" stopColor="#55aee0"/></linearGradient>
              <linearGradient id="pop_hf" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#425B9A"/><stop offset="100%" stopColor="#5470b8"/></linearGradient>
            </defs>
            <rect x="4" y="16" width="42" height="12" rx="4" fill="url(#pop_hb)"/>
            <rect x="7" y="26" width="42" height="12" rx="4" fill="url(#pop_hm)"/>
            <rect x="10" y="36" width="42" height="12" rx="4" fill="url(#pop_hf)"/>
            <circle cx="18" cy="42" r="2.2" fill="#FF5F57"/>
            <circle cx="24.5" cy="42" r="2.2" fill="#FEBC2E"/>
            <circle cx="31" cy="42" r="2.2" fill="#28C840"/>
          </svg>
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-wide">Tabflow</h1>
          <p className="text-xs text-white/40">Browser Workspace</p>
        </div>
      </div>

      <div className="mb-2 px-1">
        <h2 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-2">Pinned Folders</h2>
      </div>

      <div className="space-y-1 mb-3">
        {sessions.length === 0 ? (
          <div className="py-6 px-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] text-center">
            <Folder className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/60 font-medium mb-1">No pinned folders</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => openDashboard(session.id)}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] hover:border-blue-500/30 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 truncate max-w-[150px]">
                <Folder className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors shrink-0" />
                <span className="text-sm font-medium text-white/80 group-hover:text-white truncate">
                  {session.name || 'Untitled Folder'}
                </span>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleSaveTab(e, session)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  title="Save current tab"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleOpenAll(e, session)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  title="Open all tabs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleCloseAll(e, session)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  title="Close all folder tabs"
                >
                  <XSquare className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleToggleLock(e, session)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  title={session.isLocked ? "Unlock folder" : "Lock folder"}
                >
                  {session.isLocked ? <Lock className="w-3.5 h-3.5 text-red-400" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-[10px] text-white/30 text-center mb-4 px-2 leading-relaxed">
        Only up to 5 folders will display here. Pin the folders you want to access quickly from the dashboard.
      </p>

      <button
        onClick={() => openDashboard()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all rounded-full font-medium text-sm shadow-[0_0_15px_rgba(59,130,246,0.2)]"
      >
        <LayoutDashboard className="w-4 h-4" />
        Open Dashboard
      </button>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  );
}
