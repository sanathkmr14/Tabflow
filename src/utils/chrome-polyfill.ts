import { getSessions, saveSession, deleteSession, WorkspaceSession } from '../storage/db';
import { isSameUrl, cleanTabTitle, sanitizeUrl, isValidUrl } from './url';

const isExtension = 
  typeof chrome !== 'undefined' && 
  !!chrome?.runtime && 
  typeof chrome.runtime?.onMessage?.addListener === 'function' &&
  chrome.runtime?.id !== undefined;

if (typeof window !== 'undefined') {
  const g = window as any;
  if (!g.chrome) {
    g.chrome = {};
  }

  const openedWindowRefs = new Map<string, Window>();

  const getInitialMockTabs = (): any[] => {
    try {
      const stored = localStorage.getItem('tabflow_mock_open_tabs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Purge any stale legacy dummy tabs if they exist in localStorage
          const filtered = parsed.filter(t => 
            t.url && 
            !t.url.includes('react.dev') && 
            !t.url.includes('vite.dev') && 
            !t.url.includes('tailwindcss.com')
          );
          if (filtered.length !== parsed.length) {
            localStorage.setItem('tabflow_mock_open_tabs', JSON.stringify(filtered));
          }
          return filtered;
        }
      }
    } catch {}
    return [];
  };

  const mockTabsState: any[] = getInitialMockTabs();
  const saveMockTabs = () => {
    try {
      localStorage.setItem('tabflow_mock_open_tabs', JSON.stringify(mockTabsState));
    } catch {}
  };

  if (!g.chrome.runtime || !g.chrome.runtime.onMessage) {
    const messageListeners: Array<(msg: any, sender: any, sendResponse: (res?: any) => void) => void> = [];

    // Seed demo workspace folders if IndexedDB is empty so developer preview has immediate interactive content
    const initDemoData = async () => {
      try {
        const sessions = await getSessions();
        if (!sessions || sessions.length === 0) {
          const now = Date.now();
          const demo1: WorkspaceSession = {
            id: 'ws-demo-dev',
            name: 'Developer Tools',
            timestamp: now - 3600000,
            isPinned: true,
            contextSummary: 'Tabflow source code and Chrome developer documentation.',
            tabs: [
              { url: 'https://github.com/sanathkmr14/Tabflow', title: 'GitHub - sanathkmr14/Tabflow: AI-Powered Browser Workspace', favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg', isStarred: true },
              { url: 'https://developer.chrome.com/docs/extensions/mv3/', title: 'Chrome Extensions - Welcome to Manifest V3', favIconUrl: 'https://developer.chrome.com/favicon.ico' },
            ]
          };
          const demo2: WorkspaceSession = {
            id: 'ws-demo-ai',
            name: 'AI & Research',
            timestamp: now - 7200000,
            contextSummary: 'LLM documentation and AI interfaces.',
            tabs: [
              { url: 'https://openrouter.ai', title: 'OpenRouter: Unified AI Interface', favIconUrl: 'https://openrouter.ai/favicon.ico', isStarred: true },
              { url: 'https://ai.google.dev', title: 'Google AI for Developers', favIconUrl: 'https://ai.google.dev/favicon.ico' },
            ]
          };
          await saveSession(demo1);
          await saveSession(demo2);
        }
      } catch (e) {
        console.warn('Could not initialize demo data:', e);
      }
    };
    initDemoData();

    g.chrome.runtime = {
      id: 'tabflow-preview-mode',
      getURL: (path: string) => (path.startsWith('/') ? path : '/' + path),
      onMessage: {
        addListener: (fn: any) => {
          if (typeof fn === 'function' && !messageListeners.includes(fn)) messageListeners.push(fn);
        },
        removeListener: (fn: any) => {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
        hasListener: (fn: any) => messageListeners.includes(fn),
      },
      sendMessage: async (msg: any, callback?: (response: any) => void) => {
        let response: any = { success: true };
        try {
          if (msg?.type === 'GET_SESSIONS') {
            const sessions = await getSessions();
            response = sessions.map(s => ({
              ...s,
              password: s.password ? '[SET]' : undefined,
              recoveryWord: s.recoveryWord ? '[SET]' : undefined,
            }));
          } else if (msg?.type === 'CREATE_FOLDER') {
            const newSession: WorkspaceSession = {
              id: 'ws-' + Date.now(),
              name: msg.name || 'New Workspace',
              tabs: msg.tabs || [],
              timestamp: Date.now(),
              contextSummary: 'Created in Tabflow Web Preview',
            };
            await saveSession(newSession);
            response = { success: true, session: newSession };
          } else if (msg?.type === 'DELETE_FOLDER') {
            await deleteSession(msg.sessionId);
            response = { success: true };
          } else if (msg?.type === 'TOGGLE_PIN_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.isPinned = !target.isPinned;
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'LOCK_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.isLocked = true;
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'TOGGLE_STAR_TAB') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              const tab = target.tabs.find(t => t.url === msg.url);
              if (tab) tab.isStarred = !tab.isStarred;
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'REMOVE_TAB_FROM_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.tabs = target.tabs.filter(t => t.url !== msg.url);
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'ADD_TAB_TO_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            let added = false;
            if (target && msg.tab?.url) {
              const url = sanitizeUrl(msg.tab.url);
              if (isValidUrl(url)) {
                if (!target.tabs.some(t => isSameUrl(t.url, url))) {
                  target.tabs.push({
                    url,
                    title: cleanTabTitle(msg.tab.title || url),
                    favIconUrl: msg.tab.favIconUrl
                  });
                  await saveSession(target);
                  added = true;
                }
              }
            }
            messageListeners.forEach(l => {
              try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
            });
            response = { success: true, added };
          } else if (msg?.type === 'MOVE_TAB') {
            const sessions = await getSessions();
            const source = sessions.find(s => s.id === msg.sourceSessionId);
            const target = sessions.find(s => s.id === msg.targetSessionId);
            if (!source || !target) {
              response = { success: false, error: 'Folder not found' };
            } else {
              const tabIndex = source.tabs.findIndex(t => t.url === msg.url || isSameUrl(t.url, msg.url));
              if (tabIndex === -1) {
                response = { success: false, error: 'Tab not found in source folder' };
              } else {
                const [tabToMove] = source.tabs.splice(tabIndex, 1);
                if (!target.tabs.find(t => t.url === tabToMove.url || isSameUrl(t.url, tabToMove.url))) {
                  target.tabs.push(tabToMove);
                }
                await saveSession(source);
                await saveSession(target);
                // Notify listeners
                messageListeners.forEach(l => {
                  try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                });
                response = { success: true };
              }
            }
          } else if (msg?.type === 'SCAN_TABS_TO_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            let addedCount = 0;
            if (target) {
              const tabsToScan = mockTabsState.length > 0 ? mockTabsState : [
                { url: 'https://news.ycombinator.com', title: 'Hacker News', favIconUrl: 'https://news.ycombinator.com/favicon.ico' },
                { url: 'https://developer.mozilla.org', title: 'MDN Web Docs', favIconUrl: 'https://developer.mozilla.org/favicon.ico' },
                { url: 'https://github.com/trending', title: 'Trending Repositories on GitHub', favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg' }
              ];
              for (const tab of tabsToScan) {
                const url = sanitizeUrl(tab.url);
                if (isValidUrl(url) && !target.tabs.find(t => isSameUrl(t.url, url))) {
                  target.tabs.push({ url, title: cleanTabTitle(tab.title || url), favIconUrl: tab.favIconUrl });
                  addedCount++;
                }
              }
              await saveSession(target);
              messageListeners.forEach(l => {
                try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
              });
            }
            response = { success: true, addedCount, validCount: target ? target.tabs.length : 0 };
          } else if (msg?.type === 'OPEN_FOLDER_TABS') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            let count = 0;
            if (target) {
              target.tabs.forEach(t => {
                let winRef: Window | null = null;
                try {
                  winRef = window.open(t.url, '_blank');
                  if (winRef) {
                    openedWindowRefs.set(t.url, winRef);
                  }
                } catch {}
                mockTabsState.push({
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  windowId: 1,
                  title: t.title || t.url,
                  url: t.url,
                  active: false
                });
                count++;
              });
              saveMockTabs();
            }
            response = { success: true, openedCount: count };
          } else if (msg?.type === 'CLOSE_FOLDER_TABS') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            let closedCount = 0;
            if (target) {
              const urls = target.tabs.map(t => t.url);
              for (let i = mockTabsState.length - 1; i >= 0; i--) {
                const tabUrl = mockTabsState[i].url;
                if (tabUrl && urls.some(u => isSameUrl(u, tabUrl))) {
                  mockTabsState.splice(i, 1);
                  closedCount++;
                  const winRef = openedWindowRefs.get(tabUrl);
                  if (winRef && !winRef.closed) {
                    try { winRef.close(); } catch {}
                  }
                  openedWindowRefs.delete(tabUrl);
                }
              }
              saveMockTabs();
            }
            response = { success: true, closedCount, allowedIncognito: false };
          } else if (msg?.type === 'RENAME_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.name = msg.newName || target.name;
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'EDIT_TAB_IN_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              const tab = target.tabs.find(t => t.url === msg.url);
              if (tab) {
                tab.title = msg.newTitle || tab.title;
                tab.url = msg.newUrl || tab.url;
                await saveSession(target);
              }
            }
            response = { success: true };
          } else if (msg?.type === 'UPDATE_FOLDER_LOCK') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.password = msg.password || undefined;
              target.recoveryWord = msg.recoveryWord || undefined;
              target.autoLockEnabled = Boolean(msg.autoLockEnabled);
              if (msg.password) {
                target.isLocked = true;
              }
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'UNLOCK_FOLDER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.isLocked = false;
              await saveSession(target);
              response = { success: true };
            } else {
              response = { error: 'Folder not found' };
            }
          } else if (msg?.type === 'SET_FOLDER_TIMER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              if (msg.action === 'open') {
                target.scheduledOpenTimes = msg.times || [];
              } else if (msg.action === 'close') {
                target.scheduledCloseTimes = msg.times || [];
              }
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'SET_TAB_TIMER') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              const tab = target.tabs.find(t => t.url === msg.url);
              if (tab) {
                if (msg.action === 'open') {
                  tab.scheduledOpenTimes = msg.times || [];
                } else if (msg.action === 'close') {
                  tab.scheduledCloseTimes = msg.times || [];
                }
                await saveSession(target);
              }
            }
            response = { success: true };
          } else if (msg?.type === 'UPDATE_FOLDER_SHARE_LINK') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              target.shareLink = msg.shareLink;
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'REMOVE_DUPLICATE_TABS') {
            const sessions = await getSessions();
            const target = sessions.find(s => s.id === msg.sessionId);
            if (target) {
              const seen = new Set<string>();
              target.tabs = target.tabs.filter(t => {
                if (seen.has(t.url)) return false;
                seen.add(t.url);
                return true;
              });
              await saveSession(target);
            }
            response = { success: true };
          } else if (msg?.type === 'EXECUTE_CONFIRMED_COMMANDS') {
            if (Array.isArray(msg.commands)) {
              for (const cmd of msg.commands) {
                if (cmd.type === 'OPEN_TAB' && cmd.args?.url) {
                  let winRef: Window | null = null;
                  try {
                    winRef = window.open(cmd.args.url, '_blank');
                    if (winRef) {
                      openedWindowRefs.set(cmd.args.url, winRef);
                    }
                  } catch {}
                  mockTabsState.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    windowId: 1,
                    title: cmd.args.title || cmd.args.url,
                    url: cmd.args.url,
                    active: true
                  });
                } else if ((cmd.type === 'CLOSE_TAB' || cmd.type === 'CLOSE_TABS') && cmd.args) {
                  const urlQuery = (cmd.args.url || '').toLowerCase();
                  const titleQuery = (cmd.args.title || '').toLowerCase();
                  const closeAll = cmd.args.all === 'true';
                  for (let i = mockTabsState.length - 1; i >= 0; i--) {
                    const tab = mockTabsState[i];
                    const match = closeAll ||
                      (urlQuery && tab.url && tab.url.toLowerCase().includes(urlQuery)) ||
                      (titleQuery && tab.title && tab.title.toLowerCase().includes(titleQuery));
                    if (match) {
                      const tabUrl = tab.url;
                      mockTabsState.splice(i, 1);
                      if (tabUrl) {
                        const winRef = openedWindowRefs.get(tabUrl);
                        if (winRef && !winRef.closed) {
                          try { winRef.close(); } catch {}
                        }
                        openedWindowRefs.delete(tabUrl);
                      }
                    }
                  }
                } else if (cmd.type === 'MOVE_TAB' && cmd.args) {
                  const sessions = await getSessions();
                  const source = sessions.find(s => s.id === cmd.args.sourceSessionId || s.name.toLowerCase() === (cmd.args.source || '').toLowerCase());
                  const target = sessions.find(s => s.id === cmd.args.targetSessionId || s.name.toLowerCase() === (cmd.args.target || '').toLowerCase());
                  if (source && target && cmd.args.url) {
                    const tabIdx = source.tabs.findIndex(t => t.url === cmd.args.url || isSameUrl(t.url, cmd.args.url));
                    if (tabIdx !== -1) {
                      const [moved] = source.tabs.splice(tabIdx, 1);
                      if (!target.tabs.find(t => t.url === moved.url || isSameUrl(t.url, moved.url))) {
                        target.tabs.push(moved);
                      }
                      await saveSession(source);
                      await saveSession(target);
                      messageListeners.forEach(l => {
                        try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                      });
                    }
                  }
                } else if (cmd.type === 'ADD_TAB' && cmd.args?.folder && cmd.args?.url) {
                  const sessions = await getSessions();
                  const folderName = (cmd.args.folder || 'General').replace(/^["']|["']$/g, '').trim();
                  let target = sessions.find(s => s.id === cmd.args.folder || s.name.toLowerCase() === folderName.toLowerCase());
                  if (!target) {
                    target = {
                      id: 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                      name: folderName,
                      timestamp: Date.now(),
                      tabs: [],
                      contextSummary: 'Created by AI Assistant'
                    };
                    sessions.push(target);
                  }
                  const safeUrl = sanitizeUrl(cmd.args.url);
                  if (isValidUrl(safeUrl) && !target.isLocked) {
                    if (!target.tabs.some(t => isSameUrl(t.url, safeUrl))) {
                      target.tabs.push({
                        url: safeUrl,
                        title: cleanTabTitle(cmd.args.title || safeUrl)
                      });
                      await saveSession(target);
                      messageListeners.forEach(l => {
                        try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                      });
                    }
                  }
                } else if (cmd.type === 'DELETE_TAB' && cmd.args?.folder && cmd.args?.url) {
                  const sessions = await getSessions();
                  const target = sessions.find(s => s.id === cmd.args.folder || s.name.toLowerCase() === (cmd.args.folder || '').toLowerCase());
                  if (target && !target.isLocked) {
                    target.tabs = target.tabs.filter(t => !isSameUrl(t.url, cmd.args.url));
                    await saveSession(target);
                    messageListeners.forEach(l => {
                      try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                    });
                  }
                } else if (cmd.type === 'DELETE_FOLDER' && (cmd.args?.folder || cmd.raw)) {
                  const folderTarget = cmd.args?.folder || cmd.raw.replace(/.*?folder="([^"]+)".*/, '$1');
                  const sessions = await getSessions();
                  const target = sessions.find(s => s.id === folderTarget || s.name.toLowerCase() === folderTarget.toLowerCase());
                  if (target && !target.isLocked) {
                    await deleteSession(target.id);
                    messageListeners.forEach(l => {
                      try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                    });
                  }
                } else if (cmd.type === 'RENAME_FOLDER' && cmd.args?.folder && cmd.args?.new_name) {
                  const sessions = await getSessions();
                  const target = sessions.find(s => s.id === cmd.args.folder || s.name.toLowerCase() === cmd.args.folder.toLowerCase());
                  if (target && !target.isLocked) {
                    target.name = cmd.args.new_name.replace(/^["']|["']$/g, '').trim();
                    await saveSession(target);
                    messageListeners.forEach(l => {
                      try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                    });
                  }
                } else if (cmd.type === 'COPY_TAB' && cmd.args?.src && cmd.args?.dest && cmd.args?.url) {
                  const sessions = await getSessions();
                  const src = sessions.find(s => s.id === cmd.args.src || s.name.toLowerCase() === cmd.args.src.toLowerCase());
                  let dest = sessions.find(s => s.id === cmd.args.dest || s.name.toLowerCase() === cmd.args.dest.toLowerCase());
                  if (!dest) {
                    const newDest: WorkspaceSession = {
                      id: 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                      name: cmd.args.dest.trim(),
                      timestamp: Date.now(),
                      tabs: [],
                      contextSummary: 'Created by AI Assistant'
                    };
                    sessions.push(newDest);
                    dest = newDest;
                  }
                  if (src && dest && !src.isLocked && !dest.isLocked) {
                    const tabToCopy = src.tabs.find(t => isSameUrl(t.url, cmd.args.url));
                    if (tabToCopy && !dest.tabs.some(t => isSameUrl(t.url, tabToCopy.url))) {
                      dest.tabs.push({ ...tabToCopy });
                      await saveSession(dest);
                      messageListeners.forEach(l => {
                        try { l({ type: 'REFRESH_FOLDERS' }, {}, () => {}); } catch {}
                      });
                    }
                  }
                } else if (cmd.type === 'RESTORE_FOLDER' && cmd.args?.folder) {
                  const sessions = await getSessions();
                  const target = sessions.find(s => s.id === cmd.args.folder || s.name.toLowerCase() === cmd.args.folder.toLowerCase());
                  if (target && !target.isLocked) {
                    for (const t of target.tabs) {
                      mockTabsState.push({
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        windowId: 1,
                        title: t.title,
                        url: t.url,
                        active: false
                      });
                      try { window.open(t.url, '_blank'); } catch {}
                    }
                  }
                }
              }
              saveMockTabs();
            }
            response = { success: true };
          }
        } catch (err: any) {
          response = { error: err.message || String(err) };
        }

        if (typeof callback === 'function') {
          setTimeout(() => callback(response), 0);
        }
        return response;
      },
      connect: (options?: any) => {
        const portListeners: Array<(msg: any) => void> = [];
        const port = {
          name: options?.name || 'chat-stream',
          onMessage: {
            addListener: (fn: any) => {
              if (typeof fn === 'function' && !portListeners.includes(fn)) portListeners.push(fn);
            },
            removeListener: (fn: any) => {
              const idx = portListeners.indexOf(fn);
              if (idx !== -1) portListeners.splice(idx, 1);
            },
          },
          onDisconnect: {
            addListener: () => {},
            removeListener: () => {},
          },
          postMessage: async (msg: any) => {
            if (msg.type === 'CHAT_STREAM_PROMPT') {
              const prompt = msg.prompt || '';
              try {
                const { streamLLM, getAIConfig } = await import('@/ai/llm');
                const config = await getAIConfig();
                if (!config || !config.apiKey) {
                  const noKeyMsg = "No AI provider configured yet. Please go to the **Preferences** tab to add your Gemini, OpenAI, or OpenRouter API key.";
                  portListeners.forEach(l => l({ type: 'CHUNK', text: noKeyMsg }));
                  portListeners.forEach(l => l({ type: 'DONE', fullText: noKeyMsg }));
                  return;
                }

                const { 
                  buildChatSystemPrompt, 
                  buildChatFullPrompt, 
                  extractCommandsAndCleanText, 
                  sanitizeStreamChunk 
                } = await import('./ai-chat-helper');

                const sessions = await getSessions();
                const systemPrompt = buildChatSystemPrompt();
                const fullPrompt = buildChatFullPrompt(prompt, mockTabsState, sessions, msg.history);

                const fullText = await streamLLM(fullPrompt, systemPrompt, (chunk: string) => {
                  const cleanChunk = sanitizeStreamChunk(chunk);
                  if (cleanChunk) {
                    portListeners.forEach(l => l({ type: 'CHUNK', text: cleanChunk }));
                  }
                });

                const { cleanedText, pendingCommands } = extractCommandsAndCleanText(fullText, mockTabsState, sessions, prompt);

                if (pendingCommands.length > 0) {
                  portListeners.forEach(l => l({ type: 'COMMANDS_PENDING', commands: pendingCommands }));
                }

                portListeners.forEach(l => l({ type: 'DONE', fullText: cleanedText }));
              } catch (err: any) {
                const errMsg = `Error connecting to AI: ${err?.message || 'Could not fetch response.'}`;
                portListeners.forEach(l => l({ type: 'CHUNK', text: errMsg }));
                portListeners.forEach(l => l({ type: 'DONE', fullText: errMsg }));
              }
            }
          },
          disconnect: () => {},
        };
        return port;
      },
    };
  }

  if (!g.chrome.tabs) {
    g.chrome.tabs = {
      query: async (_queryInfo: any, callback?: (tabs: any[]) => void) => {
        const copy = [...mockTabsState];
        if (typeof callback === 'function') callback(copy);
        return copy;
      },
      create: async (createProperties: any, callback?: (tab: any) => void) => {
        let winRef: Window | null = null;
        if (createProperties?.url) {
          try {
            winRef = window.open(createProperties.url, '_blank');
            if (winRef) {
              openedWindowRefs.set(createProperties.url, winRef);
            }
          } catch {}
        }
        const tab = { 
          id: Date.now() + Math.floor(Math.random() * 1000), 
          windowId: 1, 
          title: createProperties.title || createProperties.url, 
          ...createProperties, 
          active: true 
        };
        mockTabsState.push(tab);
        saveMockTabs();
        if (typeof callback === 'function') callback(tab);
        return tab;
      },
      update: async (tabId: number, updateProperties: any, callback?: (tab: any) => void) => {
        const target = mockTabsState.find(t => t.id === tabId);
        if (target) Object.assign(target, updateProperties);
        saveMockTabs();
        if (typeof callback === 'function') callback(target || { id: tabId, ...updateProperties });
        return target || { id: tabId, ...updateProperties };
      },
      remove: async (tabIds: any, callback?: () => void) => {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        for (let i = mockTabsState.length - 1; i >= 0; i--) {
          if (ids.includes(mockTabsState[i].id)) {
            const tabUrl = mockTabsState[i].url;
            mockTabsState.splice(i, 1);
            if (tabUrl) {
              const winRef = openedWindowRefs.get(tabUrl);
              if (winRef && !winRef.closed) {
                try { winRef.close(); } catch {}
              }
              openedWindowRefs.delete(tabUrl);
            }
          }
        }
        saveMockTabs();
        if (typeof callback === 'function') callback();
      },
    };
  }

  if (!g.chrome.windows) {
    g.chrome.windows = {
      create: async (createData: any, callback?: (win: any) => void) => {
        const urls = Array.isArray(createData?.url) ? createData.url : createData?.url ? [createData.url] : [];
        const createdTabs: any[] = [];
        urls.forEach((url: string) => {
          let winRef: Window | null = null;
          try {
            winRef = window.open(url, '_blank');
            if (winRef) {
              openedWindowRefs.set(url, winRef);
            }
          } catch {}
          const tab = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            windowId: 1,
            title: url,
            url,
            active: true
          };
          mockTabsState.push(tab);
          createdTabs.push(tab);
        });
        saveMockTabs();
        const win = { id: 1, tabs: createdTabs, ...createData };
        if (typeof callback === 'function') callback(win);
        return win;
      },
      update: async (winId: number, updateInfo: any, callback?: (win: any) => void) => {
        if (typeof callback === 'function') callback({ id: winId, ...updateInfo });
        return { id: winId, ...updateInfo };
      },
    };
  }

  if (!g.chrome.extension) {
    g.chrome.extension = {
      isAllowedIncognitoAccess: (callback?: (allowed: boolean) => void) => {
        if (typeof callback === 'function') callback(true);
        return Promise.resolve(true);
      },
    };
  }

  if (!g.chrome.storage) {
    g.chrome.storage = {
      local: {
        get: (keys: any, callback: (items: any) => void) => {
          const res: any = {};
          if (Array.isArray(keys)) {
            keys.forEach(k => {
              const val = localStorage.getItem(`tabflow_${k}`);
              if (val !== null) {
                try {
                  res[k] = JSON.parse(val);
                } catch {
                  res[k] = val;
                }
              }
            });
          }
          if (typeof callback === 'function') callback(res);
        },
        set: (items: any, callback?: () => void) => {
          Object.entries(items).forEach(([k, v]) => {
            localStorage.setItem(`tabflow_${k}`, JSON.stringify(v));
          });
          if (typeof callback === 'function') callback();
        },
      },
    };
  }
}

export const isWebPreviewMode = !isExtension;
