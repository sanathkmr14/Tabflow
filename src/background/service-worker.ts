
import { callLLM, streamLLM } from '@/ai/llm';
import { getSessions, saveSession, deleteSession, WorkspaceSession } from '@/storage/db';
import { isValidUrl, sanitizeUrl, isSameUrl, cleanTabTitle } from '@/utils/url';
import { 
  buildChatSystemPrompt, 
  buildChatFullPrompt, 
  extractCommandsAndCleanText, 
  sanitizeStreamChunk,
  isUserWebTab
} from '@/utils/ai-chat-helper';

// Register auto-lock-check alarm on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('auto-lock-check', { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('auto-lock-check', { periodInMinutes: 15 });
});

// ─── Session Mutation Mutex (M1) ─────────────────────────────────────────────
// Prevents concurrent read-modify-write operations from overwriting each other.
let sessionMutexPromise: Promise<void> = Promise.resolve();

function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = sessionMutexPromise.then(fn, fn);
  sessionMutexPromise = result.then(() => {}, () => {});
  return result;
}

function safeBase64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function safeBase64Decode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function checkIncognitoAllowed(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.extension && typeof chrome.extension.isAllowedIncognitoAccess === 'function') {
        chrome.extension.isAllowedIncognitoAccess((res) => resolve(!!res));
      } else {
        resolve(true);
      }
    } catch {
      resolve(true);
    }
  });
}

// Track tab lifecycle to trigger ingestion
const tabTimes = new Map<number, number>();

chrome.tabs.onActivated.addListener((activeInfo) => {
  tabTimes.set(activeInfo.tabId, Date.now());
});

// M9: Combined into a single onRemoved listener
chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabTimes.delete(tabId);
  try {
    const data = await chrome.storage.session.get('tabToFolderMap');
    if (data.tabToFolderMap && data.tabToFolderMap[tabId.toString()]) {
      const map = { ...data.tabToFolderMap };
      delete map[tabId.toString()];
      await chrome.storage.session.set({ tabToFolderMap: map });
    }
  } catch {
    // Session storage may not be initialized
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    // Record time on load complete
    tabTimes.set(tabId, Date.now());
  }
});

// ─── Smart Launcher (Cmd+K / Ctrl+K) ─────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'smart-launcher') return;

  const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');

  // Check if a dashboard tab is already open
  const existingTabs = await chrome.tabs.query({ url: dashboardUrl + '*' });

  if (existingTabs.length > 0 && existingTabs[0].id != null) {
    const tab = existingTabs[0];
    // Focus the window and the tab
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tab.id!, { active: true });
    // Send a message to open the launcher modal
    chrome.tabs.sendMessage(tab.id!, { type: 'OPEN_LAUNCHER' }).catch(() => {});
  } else {
    // Open a fresh dashboard with the launcher flag
    await chrome.tabs.create({ url: dashboardUrl + '?launcher=true' });
  }
});


// ─── Chat Stream Port (E: Streaming support) ────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'chat-stream') {
    port.onMessage.addListener(async (msg: any) => {
      if (msg.type === 'CHAT_STREAM_PROMPT') {
        try {
          const tabs = await chrome.tabs.query({});
          const relevantTabs = tabs.filter(isUserWebTab);
          const sessions = await getSessions();

          const systemPrompt = buildChatSystemPrompt();
          const fullPrompt = buildChatFullPrompt(msg.prompt, relevantTabs, sessions, msg.history);

          const responseText = await streamLLM(fullPrompt, systemPrompt, (chunk) => {
            const cleanChunk = sanitizeStreamChunk(chunk);
            if (cleanChunk) {
              port.postMessage({ type: 'CHUNK', text: cleanChunk });
            }
          });

          const { cleanedText, pendingCommands } = extractCommandsAndCleanText(responseText, relevantTabs, sessions, msg.prompt);

          if (pendingCommands.length > 0) {
            port.postMessage({ type: 'COMMANDS_PENDING', commands: pendingCommands });
          }

          port.postMessage({ type: 'DONE', fullText: cleanedText });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          port.postMessage({ type: 'ERROR', error: errMsg });
        }
      }
    });
  }
});

// ─── Messaging Layer (Frontend to Backend) ──────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    sendResponse({ error: err.toString() });
  });
  return true; // async
});

async function handleMessage(message: any) {
  if (message.type === 'CHAT_WITH_TABS') {
    return await handleChatWithTabs(message.prompt);
  }
  if (message.type === 'OPEN_FOLDER_TABS') {
    return await handleOpenFolderTabs(message.sessionId, message.target);
  }

  if (message.type === 'GET_SESSIONS') {
    const sessions = await getSessions();
    // Strip sensitive fields before sending to frontend
    return sessions.map(s => ({
      ...s,
      password: s.password ? '[SET]' : undefined,
      recoveryWord: s.recoveryWord ? '[SET]' : undefined
    }));
  }
  if (message.type === 'EXECUTE_CONFIRMED_COMMANDS') {
    for (const cmd of message.commands) {
      try {
        await executeParsedCommand(cmd.type, cmd.args, cmd.raw);
      } catch (err) {
        console.error(`Error executing confirmed command ${cmd.type}:`, err);
      }
    }
    return { success: true };
  }
  if (message.type === 'RESTORE_SESSION') {
    return await handleRestoreSession(message.sessionId);
  }
  if (message.type === 'CREATE_FOLDER') {
    return await handleCreateFolder(message.name, message.tabs || []);
  }
  if (message.type === 'DELETE_FOLDER') {
    await deleteSession(message.sessionId);
    chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    return { success: true };
  }
  if (message.type === 'ADD_TAB_TO_FOLDER') {
    return await handleAddTab(message.sessionId, message.tab, message.passwordHash);
  }
  if (message.type === 'SCAN_TABS_TO_FOLDER') {
    return await handleScanTabs(message.sessionId, message.passwordHash);
  }
  if (message.type === 'SET_FOLDER_TIMER') {
    return await handleSetFolderTimer(message.sessionId, message.action, message.times);
  }
  if (message.type === 'SET_TAB_TIMER') {
    return await handleSetTabTimer(message.sessionId, message.url, message.action, message.times);
  }
  if (message.type === 'REMOVE_TAB_FROM_FOLDER') {
    return await handleRemoveTabFromFolder(message.sessionId, message.url, message.passwordHash);
  }
  if (message.type === 'MOVE_TAB') {
    return await handleMoveTab(message.sourceSessionId, message.targetSessionId, message.url, message.passwordHash);
  }
  if (message.type === 'EDIT_TAB_IN_FOLDER') {
    return await handleEditTabInFolder(message.sessionId, message.url, message.newTitle, message.newUrl, message.passwordHash);
  }
  if (message.type === 'RENAME_FOLDER') {
    return await handleRenameFolder(message.sessionId, message.newName, message.passwordHash);
  }
  if (message.type === 'TOGGLE_PIN_FOLDER') {
    return await handleTogglePinFolder(message.sessionId);
  }
  if (message.type === 'TOGGLE_STAR_TAB') {
    return await handleToggleStarTab(message.sessionId, message.url);
  }
  if (message.type === 'REMOVE_DUPLICATE_TABS') {
    return await handleRemoveDuplicateTabs(message.sessionId, message.passwordHash);
  }
  if (message.type === 'CLOSE_FOLDER_TABS') {
    return await handleCloseFolderTabs(message.sessionId, message.passwordHash);
  }
  if (message.type === 'UPDATE_FOLDER_LOCK') {
    return await handleUpdateFolderLock(message.sessionId, message.password, message.recoveryWord, message.autoLockEnabled);
  }
  if (message.type === 'UPDATE_FOLDER_SHARE_LINK') {
    return await handleUpdateFolderShareLink(message.sessionId, message.shareLink);
  }
  if (message.type === 'LOCK_FOLDER') {
    return await handleSetFolderLockState(message.sessionId, true);
  }
  if (message.type === 'UNLOCK_FOLDER') {
    // Require password hash to unlock
    if (!message.passwordHash) throw new Error('Password required to unlock');
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === message.sessionId);
    if (!session) throw new Error('Folder not found');
    if (session.password && session.password !== message.passwordHash) {
      throw new Error('Incorrect password');
    }
    return await handleSetFolderLockState(message.sessionId, false);
  }
  if (message.type === 'VERIFY_PASSWORD') {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === message.sessionId);
    if (!session) throw new Error("Folder not found");
    return session.password === message.passwordHash;
  }
  if (message.type === 'VERIFY_RECOVERY_WORD') {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === message.sessionId);
    if (!session) throw new Error("Folder not found");
    return session.recoveryWord === message.recoveryWordHash;
  }
  throw new Error(`Unknown message type: ${message.type}`);
}

// Helper to parse key-value pairs from a command line like: folder="Personal" url="https://www.youtube.com/"

function sanitizeFolderName(name: string): string {
  if (!name) return 'New Folder';
  let clean = name.replace(/<[^>]*>?/gm, '');
  clean = clean.substring(0, 100);
  return clean.trim() || 'New Folder';
}

function parseCommandArgs(argStr: string): Record<string, string> {
  const args: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(argStr)) !== null) {
    args[match[1]] = match[2];
  }
  return args;
}


async function executeParsedCommand(cmdType: string, args: Record<string, string>, cmdArgsStr: string) {
  if (cmdType === 'OPEN_TAB') {
    const rawUrl = args.url || cmdArgsStr.trim().replace(/^url=|^"|"$/g, '');
    const url = sanitizeUrl(rawUrl);
    if (isValidUrl(url)) {
      chrome.tabs.create({ url }).catch(console.error);
    }
  } else if (cmdType === 'DELETE_TAB') {
    if (args.folder && args.url) {
      const session = await resolveFolder(args.folder);
      if (session && !session.isLocked) {
        session.tabs = session.tabs.filter(t => t.url !== args.url);
        await saveSession(session);
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  } else if (cmdType === 'DELETE_FOLDER') {
    const folderName = args.folder || cmdArgsStr.trim().replace(/^folder=|^"|"$/g, '');
    const session = await resolveFolder(folderName);
    if (session && !session.isLocked) {
      await deleteSession(session.id);
      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    }
  } else if (cmdType === 'MOVE_TAB') {
    if (args.src && args.dest && args.url) {
      const srcSession = await resolveFolder(args.src);
      const destSession = await resolveOrCreateFolder(args.dest);
      if (srcSession && !srcSession.isLocked && !destSession.isLocked) {
        const tabToMove = srcSession.tabs.find(t => t.url === args.url);
        if (tabToMove) {
          if (!destSession.tabs.find(t => t.url === args.url)) {
            destSession.tabs.push({ ...tabToMove });
            await saveSession(destSession);
          }
          srcSession.tabs = srcSession.tabs.filter(t => t.url !== args.url);
          await saveSession(srcSession);
          chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
        }
      }
    }
  } else if (cmdType === 'COPY_TAB') {
    if (args.src && args.dest && args.url) {
      const srcSession = await resolveFolder(args.src);
      const destSession = await resolveOrCreateFolder(args.dest);
      if (srcSession && !srcSession.isLocked && !destSession.isLocked) {
        const tabToCopy = srcSession.tabs.find(t => t.url === args.url);
        if (tabToCopy) {
          if (!destSession.tabs.find(t => t.url === args.url)) {
            destSession.tabs.push({ ...tabToCopy });
            await saveSession(destSession);
            chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
          }
        }
      }
    }
  } else if (cmdType === 'ADD_TAB') {
    if (args.folder && args.url) {
      const url = sanitizeUrl(args.url);
      if (isValidUrl(url)) {
        const session = await resolveOrCreateFolder(args.folder);
        if (!session.isLocked && !session.tabs.find(t => t.url === url)) {
          session.tabs.push({ url, title: args.title || url });
          await saveSession(session);
          chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
        }
      }
    }
  } else if (cmdType === 'CLOSE_TAB' || cmdType === 'CLOSE_TABS') {
    const urlQuery = args.url ? args.url.toLowerCase() : '';
    const titleQuery = args.title ? args.title.toLowerCase() : '';
    const closeAll = args.all === 'true';
    
    const tabs = await chrome.tabs.query({});
    const tabsToClose = tabs.filter((t) => {
      if (!t.id) return false;
      if (t.url && (t.url.includes('chrome-extension://') || t.url.includes('/dashboard/') || t.url.includes('chrome://'))) return false;
      
      if (closeAll) return true;
      if (urlQuery && t.url && t.url.toLowerCase().includes(urlQuery)) return true;
      if (titleQuery && t.title && t.title.toLowerCase().includes(titleQuery)) return true;
      return false;
    });
    
    for (const tab of tabsToClose) {
      await chrome.tabs.remove(tab.id!).catch(console.error);
    }
  } else if (cmdType === 'RENAME_FOLDER') {
    if (args.folder && args.new_name) {
      const session = await resolveFolder(args.folder);
      if (session && !session.isLocked) {
        session.name = sanitizeFolderName(args.new_name.replace(/^["']|["']$/g, ''));
        await saveSession(session);
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  } else if (cmdType === 'RESTORE_FOLDER') {
    if (args.folder) {
      const session = await resolveFolder(args.folder);
      if (session && !session.isLocked) {
        for (const tab of session.tabs) {
          await chrome.tabs.create({ url: tab.url, active: false }).catch(console.error);
        }
      }
    }
  } else if (cmdType === 'SCHEDULE_FOLDER') {
    if (args.folder && args.action && args.time) {
      const session = await resolveFolder(args.folder);
      const timeVal = Number(args.time);
      if (session && !session.isLocked && !isNaN(timeVal)) {
        const action = args.action.toLowerCase() === 'open' ? 'open' : 'close';
        const existingTimes = action === 'open' ? (session.scheduledOpenTimes || []) : (session.scheduledCloseTimes || []);
        const newTimes = [...existingTimes, timeVal].filter((v, idx, arr) => arr.indexOf(v) === idx);
        await handleSetFolderTimer(session.id, action, newTimes);
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  } else if (cmdType === 'SCHEDULE_TAB') {
    if (args.folder && args.url && args.action && args.time) {
      const session = await resolveFolder(args.folder);
      const timeVal = Number(args.time);
      if (session && !session.isLocked && !isNaN(timeVal)) {
        const action = args.action.toLowerCase() === 'open' ? 'open' : 'close';
        const tab = session.tabs.find(t => t.url === args.url);
        if (tab) {
          const existingTimes = action === 'open' ? (tab.scheduledOpenTimes || []) : (tab.scheduledCloseTimes || []);
          const newTimes = [...existingTimes, timeVal].filter((v, idx, arr) => arr.indexOf(v) === idx);
          await handleSetTabTimer(session.id, args.url, action, newTimes);
          chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
        }
      }
    }
  } else if (cmdType === 'CLEAR_SCHEDULE') {
    if (args.folder) {
      const session = await resolveFolder(args.folder);
      if (session && !session.isLocked) {
        if (args.url) {
          await handleSetTabTimer(session.id, args.url, 'open', []);
          await handleSetTabTimer(session.id, args.url, 'close', []);
        } else {
          await handleSetFolderTimer(session.id, 'open', []);
          await handleSetFolderTimer(session.id, 'close', []);
        }
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  } else if (cmdType === 'LOCK_FOLDER') {
    if (args.folder) {
      const session = await resolveFolder(args.folder);
      if (session && session.password) {
        await handleSetFolderLockState(session.id, true);
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  }
}


// M3: Resolve a folder/session by name or ID (exact match only)
async function resolveFolder(folderNameOrId: string) {
  const sessions = await getSessions();
  const query = folderNameOrId.replace(/^["']|["']$/g, '').trim().toLowerCase();
  
  // Try exact match on ID
  let session = sessions.find(s => s.id === query);
  if (session) return session;
  
  // Try case-insensitive name match
  session = sessions.find(s => s.name.toLowerCase() === query);
  return session; // No more partial match fallback
}

// Resolve a folder/session, or create a new manual folder if it doesn't exist
async function resolveOrCreateFolder(folderName: string) {
  let session = await resolveFolder(folderName);
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      name: folderName.replace(/^["']|["']$/g, '').trim(),
      timestamp: Date.now(),
      tabs: [],
      contextSummary: "Manually created folder"
    };
    await saveSession(session);
  }
  return session;
}

async function handleChatWithTabs(userPrompt: string) {
  const tabs = await chrome.tabs.query({});
  const relevantTabs = tabs.filter(isUserWebTab);
  const sessions = await getSessions();

  const systemPrompt = buildChatSystemPrompt();
  const fullPrompt = buildChatFullPrompt(userPrompt, relevantTabs, sessions);

  const responseText = await callLLM(fullPrompt, systemPrompt);
  const { cleanedText, pendingCommands } = extractCommandsAndCleanText(responseText, relevantTabs, sessions, userPrompt);

  return { text: cleanedText, commands: pendingCommands };
}

// ─── Session Management ─────────────────────────────────────────────────────

async function handleRestoreSession(sessionId: string) {
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Session not found");
  if (session.isLocked) throw new Error("Folder is locked");

  for (const tab of session.tabs) {
    if (isValidUrl(tab.url)) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
  }
  return { success: true };
}

// ─── Manual Folders & Timers ────────────────────────────────────────────────

function verifySessionAccess(session: WorkspaceSession, passwordHash?: string) {
  if (session.isLocked) {
    if (!passwordHash) throw new Error("Folder is locked");
    if (session.password && session.password !== passwordHash) {
      throw new Error("Incorrect password");
    }
  }
}

async function handleCreateFolder(name: string, tabs: any[]) {
  return withSessionLock(async () => {
    name = sanitizeFolderName(name);
    const session: WorkspaceSession = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ws-' + Date.now(),
      name,
      timestamp: Date.now(),
      tabs: tabs.map(t => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl })),
      contextSummary: "Manually created folder"
    };
    await saveSession(session);
    chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    return session;
  });
}

async function handleAddTab(sessionId: string, tab: {url: string, title: string, favIconUrl?: string}, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);
    
    const url = sanitizeUrl(tab.url);
    if (!isValidUrl(url)) throw new Error("Invalid URL");
    
    if (!session.tabs.find(t => isSameUrl(t.url, url))) {
      session.tabs.push({
        url,
        title: cleanTabTitle(tab.title || url),
        favIconUrl: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=32`
      });
      await saveSession(session);
      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      return { session, added: true };
    }
    return { session, added: false };
  });
}

async function handleRemoveTabFromFolder(sessionId: string, url: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);
    
    session.tabs = session.tabs.filter(t => t.url !== url);
    await saveSession(session);
    return session;
  });
}

async function handleMoveTab(sourceSessionId: string, targetSessionId: string, url: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const sourceSession = sessions.find(s => s.id === sourceSessionId);
    const targetSession = sessions.find(s => s.id === targetSessionId);
    if (!sourceSession || !targetSession) throw new Error("Folder not found");
    
    verifySessionAccess(sourceSession, passwordHash);
    verifySessionAccess(targetSession, passwordHash);

    const tabIndex = sourceSession.tabs.findIndex(t => t.url === url || isSameUrl(t.url, url));
    if (tabIndex === -1) return { success: false, error: "Tab not found in source folder" };

    const [tabToMove] = sourceSession.tabs.splice(tabIndex, 1);
    
    if (!targetSession.tabs.find(t => t.url === tabToMove.url || isSameUrl(t.url, tabToMove.url))) {
      targetSession.tabs.push(tabToMove);
    }

    // Migrate any active timer alarms to the new folder
    if (tabToMove.scheduledOpenTimes || tabToMove.scheduledCloseTimes) {
      try {
        const oldAlarmPrefix = `tab|${safeBase64Encode(tabToMove.url)}|${sourceSessionId}`;
        const allAlarms = await chrome.alarms.getAll();
        for (const alarm of allAlarms) {
          if (alarm.name.includes(oldAlarmPrefix)) {
            await chrome.alarms.clear(alarm.name);
          }
        }
        for (const t of tabToMove.scheduledOpenTimes || []) {
          chrome.alarms.create(`open|tab|${safeBase64Encode(tabToMove.url)}|${targetSessionId}|${t}`, { when: t });
        }
        for (const t of tabToMove.scheduledCloseTimes || []) {
          chrome.alarms.create(`close|tab|${safeBase64Encode(tabToMove.url)}|${targetSessionId}|${t}`, { when: t });
        }
      } catch {
        // Continue even if alarm migration had an issue
      }
    }
    
    await saveSession(sourceSession);
    await saveSession(targetSession);
    chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    return { success: true };
  });
}

async function handleEditTabInFolder(sessionId: string, url: string, newTitle: string, newUrl: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);

    const tab = session.tabs.find(t => isSameUrl(t.url, url));
    if (tab) {
      tab.title = cleanTabTitle(newTitle);
      const sanitizedNewUrl = sanitizeUrl(newUrl);
      
      if (!isSameUrl(url, sanitizedNewUrl)) {
        if (!isValidUrl(sanitizedNewUrl)) throw new Error("Invalid URL");
        // Clear old alarms
        const openAlarmPrefix = `open|tab|${safeBase64Encode(url)}|${sessionId}`;
        const closeAlarmPrefix = `close|tab|${safeBase64Encode(url)}|${sessionId}`;
        
        const allAlarms = await chrome.alarms.getAll();
        for (const alarm of allAlarms) {
          if (alarm.name.startsWith(openAlarmPrefix) || alarm.name.startsWith(closeAlarmPrefix)) {
            await chrome.alarms.clear(alarm.name);
          }
        }

        // Recreate alarms for new URL
        tab.url = sanitizedNewUrl;
        const newOpenPrefix = `open|tab|${safeBase64Encode(sanitizedNewUrl)}|${sessionId}`;
        const newClosePrefix = `close|tab|${safeBase64Encode(sanitizedNewUrl)}|${sessionId}`;
        
        if (tab.scheduledOpenTimes) {
          for (const time of tab.scheduledOpenTimes) {
            chrome.alarms.create(`${newOpenPrefix}|${time}`, { when: time });
          }
        }
        if (tab.scheduledCloseTimes) {
          for (const time of tab.scheduledCloseTimes) {
            chrome.alarms.create(`${newClosePrefix}|${time}`, { when: time });
          }
        }
      }
      
      await saveSession(session);
      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    }
    return session;
  });
}

async function handleRenameFolder(sessionId: string, newName: string, passwordHash?: string) {
  return withSessionLock(async () => {
    newName = sanitizeFolderName(newName);
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);

    session.name = newName;
    await saveSession(session);
    return session;
  });
}

async function handleTogglePinFolder(sessionId: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");

    session.isPinned = !session.isPinned;
    await saveSession(session);
    return session;
  });
}

async function handleToggleStarTab(sessionId: string, url: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");

    const tab = session.tabs.find(t => t.url === url);
    if (tab) {
      tab.isStarred = !tab.isStarred;
      await saveSession(session);
    }
    return session;
  });
}

async function handleScanTabs(sessionId: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    verifySessionAccess(session, passwordHash);

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome') && isValidUrl(t.url));
    
    let addedCount = 0;
    for (const tab of validTabs) {
      const url = sanitizeUrl(tab.url!);
      if (!session.tabs.find(t => isSameUrl(t.url, url))) {
        session.tabs.push({
          url,
          title: cleanTabTitle(tab.title || url),
          favIconUrl: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=32`
        });
        addedCount++;
      }
    }
    await saveSession(session);
    chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    return { session, addedCount, validCount: validTabs.length };
  });
}

async function handleRemoveDuplicateTabs(sessionId: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    verifySessionAccess(session, passwordHash);

    const uniqueUrls = new Set<string>();
    const newTabs: any[] = [];
    for (const tab of session.tabs) {
      const cleanUrlStr = tab.url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
      if (!uniqueUrls.has(cleanUrlStr)) {
        uniqueUrls.add(cleanUrlStr);
        newTabs.push(tab);
      }
    }
    session.tabs = newTabs;
    await saveSession(session);
    return session;
  });
}

async function handleOpenFolderTabs(sessionId: string, target: 'current' | 'new' | 'incognito', passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);

    const urls = session.tabs.map(t => t.url).filter(u => isValidUrl(u));
    if (urls.length === 0) return { success: true, openedCount: 0 };

    let tabIds: number[] = [];

    if (target === 'current') {
      const currentWinTabs = await chrome.tabs.query({ currentWindow: true });
      for (const url of urls) {
        if (!currentWinTabs.find(t => t.url && isSameUrl(t.url, url))) {
          const t = await chrome.tabs.create({ url, active: false });
          if (t.id) tabIds.push(t.id);
        }
      }
      // If all tabs in this folder were already opened in this window, switch to the first matching tab
      if (tabIds.length === 0 && currentWinTabs.length > 0) {
        const firstMatch = currentWinTabs.find(t => urls.some(u => isSameUrl(u, t.url)));
        if (firstMatch && firstMatch.id) {
          await chrome.tabs.update(firstMatch.id, { active: true });
        }
      }
    } else if (target === 'new') {
      try {
        const win = await chrome.windows.create({ url: urls, focused: true });
        if (win?.id) {
          const winTabs = await chrome.tabs.query({ windowId: win.id });
          tabIds = winTabs.map(t => t.id!).filter(Boolean);
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to open new window.' };
      }
    } else if (target === 'incognito') {
      const allowed = await checkIncognitoAllowed();
      if (!allowed) {
        return { success: false, error: 'Incognito mode access is not enabled. Please enable "Allow in Incognito" in chrome://extensions.' };
      }
      try {
        const win = await chrome.windows.create({ url: urls, incognito: true, focused: true });
        if (win?.id) {
          const winTabs = await chrome.tabs.query({ windowId: win.id });
          tabIds = winTabs.map(t => t.id!).filter(Boolean);
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to open incognito window.' };
      }
    }
    
    // Track mapping for timers
    try {
      const data = await chrome.storage.session.get('tabToFolderMap');
      const map = data.tabToFolderMap || {};
      for (const id of tabIds) {
        map[id.toString()] = sessionId;
      }
      await chrome.storage.session.set({ tabToFolderMap: map });
    } catch {
      // Session storage may not be initialized
    }

    return { success: true, openedCount: tabIds.length };
  });
}

async function handleCloseFolderTabs(sessionId: string, passwordHash?: string) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    verifySessionAccess(session, passwordHash);

    const urls = session.tabs.map(t => t.url);
    const openTabs = await chrome.tabs.query({});
    
    let map: Record<string, string> = {};
    try {
      const data = await chrome.storage.session.get('tabToFolderMap');
      map = (data.tabToFolderMap || {}) as Record<string, string>;
    } catch {
      // Ignore
    }

    const tabsToClose: number[] = [];
    const remainingMap = { ...map };

    for (const t of openTabs) {
      if (!t.id) continue;
      
      const isMappedToFolder = map[t.id.toString()] === sessionId;
      const matchesFolderUrl = t.url && urls.some(url => isSameUrl(url, t.url!));
      
      if (isMappedToFolder || matchesFolderUrl) {
        tabsToClose.push(t.id);
        delete remainingMap[t.id.toString()];
      }
    }

    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      try {
        await chrome.storage.session.set({ tabToFolderMap: remainingMap });
      } catch {
        // Ignore
      }
    }

    const allowed = await checkIncognitoAllowed();
    return { success: true, closedCount: tabsToClose.length, allowedIncognito: allowed };
  });
}

async function handleUpdateFolderLock(sessionId: string, password?: string, recoveryWord?: string, autoLockEnabled?: boolean) {
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Folder not found");

  if (password !== undefined && password !== '[SET]') {
    session.password = password;
  }
  if (recoveryWord !== undefined && recoveryWord !== '[SET]') {
    session.recoveryWord = recoveryWord;
  }
  if (autoLockEnabled !== undefined) {
    session.autoLockEnabled = autoLockEnabled;
  }
  if (!session.password) {
    session.isLocked = false;
  }
  await saveSession(session);
  return session;
}

async function handleUpdateFolderShareLink(sessionId: string, shareLink: string) {
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Folder not found");

  session.shareLink = shareLink;
  await saveSession(session);
  return session;
}

async function handleSetFolderLockState(sessionId: string, isLocked: boolean) {
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Folder not found");

  session.isLocked = isLocked;
  await saveSession(session);
  return session;
}

async function handleSetFolderTimer(sessionId: string, action: 'open' | 'close', times: number[]) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    const alarmPrefix = `${action}|folder|${sessionId}`;
    
    // Clear old alarms
    const allAlarms = await chrome.alarms.getAll();
    for (const alarm of allAlarms) {
      if (alarm.name.startsWith(alarmPrefix)) {
        await chrome.alarms.clear(alarm.name);
      }
    }

    const validTimes = times.filter(t => t > Date.now());

    if (action === 'open') session.scheduledOpenTimes = validTimes.length > 0 ? validTimes : undefined;
    else session.scheduledCloseTimes = validTimes.length > 0 ? validTimes : undefined;

    for (const time of validTimes) {
      chrome.alarms.create(`${alarmPrefix}|${time}`, { when: time });
    }

    await saveSession(session);
    return session;
  });
}

async function handleSetTabTimer(sessionId: string, url: string, action: 'open' | 'close', times: number[]) {
  return withSessionLock(async () => {
    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Folder not found");
    
    const tab = session.tabs.find(t => t.url === url);
    if (!tab) throw new Error("Tab not found in folder");

    const alarmPrefix = `${action}|tab|${safeBase64Encode(url)}|${sessionId}`;
    
    const allAlarms = await chrome.alarms.getAll();
    for (const alarm of allAlarms) {
      if (alarm.name.startsWith(alarmPrefix)) {
        await chrome.alarms.clear(alarm.name);
      }
    }

    const validTimes = times.filter(t => t > Date.now());

    if (action === 'open') tab.scheduledOpenTimes = validTimes.length > 0 ? validTimes : undefined;
    else tab.scheduledCloseTimes = validTimes.length > 0 ? validTimes : undefined;

    for (const time of validTimes) {
      chrome.alarms.create(`${alarmPrefix}|${time}`, { when: time });
    }

    await saveSession(session);
    return session;
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Auto-lock Periodic Check
  if (alarm.name === 'auto-lock-check') {
    const sessions = await getSessions();
    let updated = false;
    for (const session of sessions) {
      if (session.autoLockEnabled && !session.isLocked) {
        session.isLocked = true;
        await saveSession(session);
        updated = true;
      }
    }
    if (updated) {
      chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    }
    return;
  }

  // Folder Level Alarms
  if (alarm.name.includes('|folder|')) {
    const parts = alarm.name.split('|');
    const action = parts[0];
    const sessionId = parts[2];
    const firedTime = parseInt(parts[3] || '0', 10);

    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (session.isLocked) {
      console.warn(`[Alarm] Bypassed folder action ${action} because folder ${session.name} is locked.`);
      // We still want to clear the scheduled time from DB below
    } else {
      if (action === 'open') {
        for (const tab of session.tabs) {
          const safeUrl = sanitizeUrl(tab.url);
          if (isValidUrl(safeUrl)) {
            await chrome.tabs.create({ url: safeUrl, active: false }).catch(console.error);
          }
        }
      } else if (action === 'close') {
        const urls = session.tabs.map(t => t.url);
        const openTabs = await chrome.tabs.query({});
        for (const t of openTabs) {
          if (t.url && urls.some(u => isSameUrl(u, t.url)) && t.id) {
            await chrome.tabs.remove(t.id).catch(console.error);
          }
        }
      }
    }

    if (action === 'open') {
      if (firedTime) {
        session.scheduledOpenTimes = session.scheduledOpenTimes?.filter(t => Math.abs(t - firedTime) > 1000);
        if (session.scheduledOpenTimes?.length === 0) session.scheduledOpenTimes = undefined;
      } else {
        session.scheduledOpenTimes = undefined;
      }
    } else if (action === 'close') {
      if (firedTime) {
        session.scheduledCloseTimes = session.scheduledCloseTimes?.filter(t => Math.abs(t - firedTime) > 1000);
        if (session.scheduledCloseTimes?.length === 0) session.scheduledCloseTimes = undefined;
      } else {
        session.scheduledCloseTimes = undefined;
      }
    }
    
    await saveSession(session);
    chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
    return;
  }

  // Tab Level Alarms
  if (alarm.name.includes('|tab|')) {
    const parts = alarm.name.split('|');
    const action = parts[0];
    const b64Url = parts[2];
    const sessionId = parts[3];
    let url = safeBase64Decode(b64Url);
    const firedTime = parseInt(parts[4] || '0', 10);
    url = sanitizeUrl(url);

    const sessions = await getSessions();
    const session = sessions.find(s => s.id === sessionId);
    
    if (session && session.isLocked) {
      console.warn(`[Alarm] Bypassed tab action ${action} because folder ${session.name} is locked.`);
    } else if (isValidUrl(url)) {
      if (action === 'open') {
        await chrome.tabs.create({ url, active: false }).catch(console.error);
      } else if (action === 'close') {
        const allTabs = await chrome.tabs.query({});
        for (const t of allTabs) {
          if (t.id && t.url && isSameUrl(t.url, url)) {
            await chrome.tabs.remove(t.id).catch(console.error);
          }
        }
      }
    }

    // Clear schedule in DB
    if (session) {
      const tab = session.tabs.find(t => t.url === url);
      if (tab) {
        if (action === 'open') {
          if (firedTime) {
            tab.scheduledOpenTimes = tab.scheduledOpenTimes?.filter(t => Math.abs(t - firedTime) > 1000);
            if (tab.scheduledOpenTimes?.length === 0) tab.scheduledOpenTimes = undefined;
          } else {
            tab.scheduledOpenTimes = undefined;
          }
        }
        if (action === 'close') {
          if (firedTime) {
            tab.scheduledCloseTimes = tab.scheduledCloseTimes?.filter(t => Math.abs(t - firedTime) > 1000);
            if (tab.scheduledCloseTimes?.length === 0) tab.scheduledCloseTimes = undefined;
          } else {
            tab.scheduledCloseTimes = undefined;
          }
        }
        await saveSession(session);
        chrome.runtime.sendMessage({ type: 'REFRESH_FOLDERS' }).catch(() => {});
      }
    }
  }
});
