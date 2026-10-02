/**
 * Tabflow AI Chat Helper
 * Shared system prompt, context builder, and response sanitizer/command parser.
 */

import { sanitizeForPrompt, isValidUrl, cleanTabTitle } from './url';
import type { WorkspaceSession } from '../storage/db';

export interface PendingCommand {
  type: string;
  args: Record<string, string>;
  raw: string;
}

/**
 * Filter to determine whether a tab is an actual external user browsing tab
 * (ignoring internal extension pages, dashboard, chrome://, and blank URLs).
 */
export function isUserWebTab(tab: { url?: string; title?: string; pendingUrl?: string }): boolean {
  const rawUrl = tab.url || tab.pendingUrl || '';
  if (!rawUrl || typeof rawUrl !== 'string') return false;

  const lower = rawUrl.toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;

  // Exclude extension internal URLs and browser internals
  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('moz-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('devtools://')
  ) {
    return false;
  }

  // Exclude Tabflow development servers, dashboard, and popup pages
  if (
    lower.includes('localhost:5173') ||
    lower.includes('127.0.0.1:5173') ||
    lower.includes('localhost:3000') ||
    lower.includes('127.0.0.1:3000') ||
    lower.includes('localhost:4173') ||
    lower.includes('127.0.0.1:4173') ||
    lower.includes('/src/dashboard/') ||
    lower.includes('/src/popup/')
  ) {
    return false;
  }

  return true;
}

export function buildChatSystemPrompt(): string {
  return `You are the Tabflow AI Browser Assistant. 
You help users manage workspaces, browse context, summarize tabs, search the web, and trigger browser actions.

CRITICAL INSTRUCTIONS & FORMAT PROTOCOL:
1. In the context below, you will see two clear sections:
   - "ACTIVE OPEN BROWSER TABS": The user's currently active open tabs in their browser.
   - "SAVED WORKSPACE FOLDERS": The user's saved folders and tabs in Tabflow.
2. When the user asks to "Summarize my active tabs" or asks about their tabs:
   - IF ACTIVE OPEN BROWSER TABS ARE LISTED:
     Give a concise, well-structured summary of those currently open tabs. Explain the purpose of each tab and how they relate.
   - IF NO ACTIVE OPEN BROWSER TABS ARE OPEN:
     State clearly: "You currently have no external browser tabs open."
     Then provide a helpful overview of the tabs saved inside their workspace folders (e.g. what's stored in each folder).
   - NEVER invent or list fake tabs (such as React, Vite, or Tailwind) unless they are explicitly present in the context.
   - NEVER list Tabflow itself, extension URLs, or localhost dashboard pages as open user tabs.
3. You do NOT have external browser navigation or function-calling tools.
4. NEVER output XML tags or function-calling blocks such as <dots_function_call>, <invoke>, <function_calls>, or <tool_call>.
5. When asked to "Find the latest news on AI" or search for a topic, provide a helpful, concise summary of recent developments, and append a command to open search results.
6. When asked to "Play some focus music on YouTube" or open music/videos, provide a brief encouraging reply, and append a command to open YouTube.
7. Available Commands (Append each on its own line at the very end of your response using key="value" format):
   - COMMAND: OPEN_TAB url="<url>"
   - COMMAND: CLOSE_TAB url="<url_or_domain>" title="<title_keyword>" all="<true_or_false>"
   - COMMAND: DELETE_TAB folder="<folder_name_or_id>" url="<url>"
   - COMMAND: DELETE_FOLDER folder="<folder_name_or_id>"
   - COMMAND: MOVE_TAB src="<src_folder>" dest="<dest_folder>" url="<url>"
   - COMMAND: COPY_TAB src="<src_folder>" dest="<dest_folder>" url="<url>"
   - COMMAND: ADD_TAB folder="<folder_name_or_id>" url="<url>" title="<title>"
   - COMMAND: RENAME_FOLDER folder="<old_name_or_id>" new_name="<new_name>"
   - COMMAND: RESTORE_FOLDER folder="<folder_name_or_id>"
   - COMMAND: SCHEDULE_FOLDER folder="<folder_name_or_id>" action="<open_or_close>" time="<epoch_milliseconds>"
   - COMMAND: SCHEDULE_TAB folder="<folder_name_or_id>" url="<url>" action="<open_or_close>" time="<epoch_milliseconds>"
   - COMMAND: CLEAR_SCHEDULE folder="<folder_name_or_id>" url="<optional_tab_url>"
   - COMMAND: LOCK_FOLDER folder="<folder_name_or_id>"

8. CRITICAL RULE FOR TAB ORGANIZATION & SAVING TABS INTO FOLDERS:
   - You CANNOT organize tabs or create folders by merely writing conversational text.
   - When the user asks to organize, group, or save tabs into folders, OR whenever the user confirms / replies "yes", "proceed", "sure", or "go ahead" after a proposed folder categorization:
     a) Announce the folders you are organizing the tabs into.
     b) YOU MUST EMIT A COMMAND LINE FOR EACH TAB:
        COMMAND: ADD_TAB folder="<FolderName>" url="<TabURL>" title="<TabTitle>"
     c) NEVER say "Your tabs have been successfully organized into folders" or "Adding tab to folder" without appending the corresponding COMMAND: ADD_TAB commands at the very end!
     d) If you do not append the COMMAND: ADD_TAB lines, NO FOLDERS OR TABS WILL BE CREATED IN TABFLOW!

Output ONLY user-facing markdown text followed optionally by one or more COMMAND: lines.`;
}

export function buildChatFullPrompt(
  prompt: string,
  openTabs: Array<{ title?: string; url?: string }>,
  folders: Array<{ id: string; name: string; isLocked?: boolean; tabs?: Array<{ title?: string; url?: string }> }>,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): string {
  const now = new Date();
  const timeContextStr = `Current local time: ${now.toString()} (Epoch milliseconds: ${Date.now()})\n\n`;

  const userTabs = openTabs.filter(isUserWebTab);
  let contextStr = "### ACTIVE OPEN BROWSER TABS:\n";
  if (userTabs.length === 0) {
    contextStr += "(No external browser tabs currently open. The user only has Tabflow open.)\n\n";
  } else {
    for (const tab of userTabs) {
      const cleanTitle = cleanTabTitle(sanitizeForPrompt(tab.title || tab.url || 'Untitled'));
      contextStr += `- Title: "${cleanTitle}"\n  URL: ${tab.url}\n`;
    }
    contextStr += "\n";
  }

  let folderContextStr = "### SAVED WORKSPACE FOLDERS:\n";
  if (!folders || folders.length === 0) {
    folderContextStr += "(No saved workspace folders.)\n\n";
  } else {
    for (const session of folders) {
      if (session.isLocked) {
        folderContextStr += `- Folder: "${sanitizeForPrompt(session.name)}" (ID: ${session.id}) [LOCKED — contents hidden]\n`;
        continue;
      }
      folderContextStr += `- Folder: "${sanitizeForPrompt(session.name)}" (ID: ${session.id}) [${session.tabs?.length || 0} tabs]:\n`;
      if (!session.tabs || session.tabs.length === 0) {
        folderContextStr += "    (No tabs in this folder)\n";
      } else {
        for (const tab of session.tabs) {
          const cleanTitle = cleanTabTitle(sanitizeForPrompt(tab.title || tab.url || 'Untitled'));
          folderContextStr += `    * "${cleanTitle}" — ${tab.url}\n`;
        }
      }
    }
    folderContextStr += "\n";
  }

  let historyStr = "";
  if (history && Array.isArray(history)) {
    historyStr = "### CONVERSATION HISTORY:\n";
    const recentHistory = history.slice(-8);
    for (const turn of recentHistory) {
      const roleName = turn.role === 'user' ? 'User' : 'Assistant';
      historyStr += `${roleName}: ${turn.content}\n`;
    }
    historyStr += "\n";
  }

  return `${timeContextStr}${contextStr}${folderContextStr}${historyStr}User Question: ${prompt}`;
}

export function parseCommandArgs(argStr: string): Record<string, string> {
  const args: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(argStr)) !== null) {
    args[match[1]] = match[2];
  }
  return args;
}

export function extractCommandsAndCleanText(
  rawText: string,
  openTabs: Array<{ title?: string; url?: string }> = [],
  folders: Array<{ id: string; name: string; tabs?: Array<{ title?: string; url?: string }>; isLocked?: boolean }> = [],
  userPrompt: string = ''
): { cleanedText: string; pendingCommands: PendingCommand[] } {
  const pendingCommands: PendingCommand[] = [];
  const commandsFound: string[] = [];

  // 1. Match standard COMMAND: syntax and <tool_call>
  const commandLineRegex = /(?:\*\*|)?(?:COMMAND:|<tool_call>)\s*(OPEN_TAB|DELETE_TAB|DELETE_FOLDER|MOVE_TAB|COPY_TAB|ADD_TAB|CLOSE_TAB|RENAME_FOLDER|RESTORE_FOLDER|SCHEDULE_FOLDER|SCHEDULE_TAB|CLEAR_SCHEDULE|LOCK_FOLDER)\s+([^<\n*]+?)(?:>|\*\*|)?(?=\n|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = commandLineRegex.exec(rawText)) !== null) {
    commandsFound.push(match[0]);
    const cmdType = match[1].toUpperCase();
    const cmdArgsStr = match[2].trim();
    const args = parseCommandArgs(cmdArgsStr);
    pendingCommands.push({ type: cmdType, args, raw: match[0] });
  }

  // 2. Match XML function calling syntax (<dots_function_call> / <invoke>)
  const invokeRegex = /<invoke\s+name="([^"]+)"[\s\S]*?>([\s\S]*?)<\/invoke>/gi;
  let invokeMatch: RegExpExecArray | null;
  while ((invokeMatch = invokeRegex.exec(rawText)) !== null) {
    const fnName = invokeMatch[1].toLowerCase();
    const body = invokeMatch[2];

    const paramRegex = /<parameter\s+name="([^"]+)"\s*>(.*?)<\/parameter>/gi;
    let pMatch: RegExpExecArray | null;
    const params: Record<string, string> = {};
    while ((pMatch = paramRegex.exec(body)) !== null) {
      params[pMatch[1].toLowerCase()] = pMatch[2].trim();
    }

    if (fnName === 'browser_navigate' || fnName === 'open_tab' || fnName === 'browser_open') {
      if (params.url && isValidUrl(params.url)) {
        pendingCommands.push({
          type: 'OPEN_TAB',
          args: { url: params.url },
          raw: invokeMatch[0]
        });
      } else if (params.search_query || params.query) {
        const query = params.search_query || params.query;
        pendingCommands.push({
          type: 'OPEN_TAB',
          args: { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
          raw: invokeMatch[0]
        });
      } else if (params.action === 'youtube' || params.action === 'music') {
        pendingCommands.push({
          type: 'OPEN_TAB',
          args: { url: 'https://www.youtube.com/results?search_query=focus+music' },
          raw: invokeMatch[0]
        });
      }
    }
  }

  // 3. Fallback Tab Organization: If no ADD_TAB command was explicitly emitted,
  // detect conversational folder organization or tab categorization
  if (!pendingCommands.some(c => c.type === 'ADD_TAB')) {
    const textLines = rawText.split('\n');
    let activeFolder: string | null = null;
    const allKnownTabs = [...openTabs];
    if (folders && Array.isArray(folders)) {
      folders.forEach(f => {
        if (f.tabs) allKnownTabs.push(...f.tabs);
      });
    }

    const findMatchingTab = (tabName: string): { title?: string; url?: string } | undefined => {
      const cleanName = cleanTabTitle(tabName).toLowerCase();
      return allKnownTabs.find(t => {
        if (!t) return false;
        const tTitle = cleanTabTitle(t.title || '').toLowerCase();
        const tUrl = (t.url || '').toLowerCase();
        if (tTitle && (tTitle === cleanName || tTitle.includes(cleanName) || cleanName.includes(tTitle))) return true;
        if (cleanName.includes('chatgpt') && tUrl.includes('chatgpt')) return true;
        if (cleanName.includes('gemini') && tUrl.includes('gemini')) return true;
        if (cleanName.includes('openrouter') && tUrl.includes('openrouter')) return true;
        if (cleanName.includes('youtube') && tUrl.includes('youtube')) return true;
        if ((cleanName.includes('twitter') || cleanName.includes('x (')) && (tUrl.includes('twitter') || tUrl.includes('x.com'))) return true;
        if (cleanName.includes('linkedin') && tUrl.includes('linkedin')) return true;
        if (cleanName.includes('keep') && tUrl.includes('keep.google')) return true;
        if (cleanName.includes('apollo') && tUrl.includes('apollo.io')) return true;
        if (cleanName.includes('maps') && (tUrl.includes('maps') || tUrl.includes('apify'))) return true;
        if (cleanName.includes('color hunt') && tUrl.includes('colorhunt')) return true;
        if (cleanName.includes('github') && tUrl.includes('github')) return true;
        if (cleanName.includes('vercel') && tUrl.includes('vercel')) return true;
        return false;
      });
    };

    for (const rawLine of textLines) {
      const line = rawLine.trim();
      if (!line) continue;

      const folderHeaderMatch = line.match(/^(?:###\s*|\*\*\s*|\d+[\.\)]\s*)?([A-Za-z0-9\s&/\-_]+?)(?:\s+Folder|\s+Workspace)?(?:\*\*)?:\s*$/i);
      if (
        folderHeaderMatch &&
        !line.toLowerCase().includes('proposed folder') &&
        !line.toLowerCase().includes('creating and organizing') &&
        !line.toLowerCase().includes('organize your')
      ) {
        const potentialFolder = folderHeaderMatch[1].trim();
        if (potentialFolder.length >= 2 && potentialFolder.length <= 40) {
          activeFolder = potentialFolder;
          continue;
        }
      }

      const addingMatch = line.match(/^Adding\s+(.+?)\s+to\s+(?:the\s+)?(.+?)(?:\s+folder|\s+workspace)?$/i);
      if (addingMatch) {
        const tabTitle = addingMatch[1].trim();
        const targetFolder = (addingMatch[2]?.trim() || activeFolder || 'General').replace(/^["']|["']$/g, '');
        const matched = findMatchingTab(tabTitle);
        if (matched && matched.url) {
          const alreadyAdded = pendingCommands.some(c => c.type === 'ADD_TAB' && c.args.url === matched.url);
          if (!alreadyAdded) {
            pendingCommands.push({
              type: 'ADD_TAB',
              args: { folder: targetFolder, url: matched.url, title: cleanTabTitle(matched.title || tabTitle) },
              raw: `COMMAND: ADD_TAB folder="${targetFolder}" url="${matched.url}" title="${cleanTabTitle(matched.title || tabTitle)}"`
            });
          }
        }
        continue;
      }

      if (activeFolder) {
        const urlMatch = line.match(/^(?:[-*•]\s*)?(?:\[(.+?)\]\((https?:\/\/[^\s)]+)\)|([^(]+?)\s*\((https?:\/\/[^\s)]+)\))/i);
        if (urlMatch) {
          const tabTitle = cleanTabTitle((urlMatch[1] || urlMatch[3] || '').trim());
          const tabUrl = (urlMatch[2] || urlMatch[4] || '').trim();
          if (isValidUrl(tabUrl)) {
            const alreadyAdded = pendingCommands.some(c => c.type === 'ADD_TAB' && c.args.url === tabUrl);
            if (!alreadyAdded) {
              pendingCommands.push({
                type: 'ADD_TAB',
                args: { folder: activeFolder, url: tabUrl, title: tabTitle || tabUrl },
                raw: `COMMAND: ADD_TAB folder="${activeFolder}" url="${tabUrl}" title="${tabTitle || tabUrl}"`
              });
            }
          }
          continue;
        }

        const inlineListMatch = line.match(/^([A-Za-z0-9\s&/\-_]+?)\s*[-–—:]\s*(.+)$/i);
        if (inlineListMatch && !line.startsWith('Adding') && !line.toLowerCase().startsWith('http')) {
          const folderCandidate = inlineListMatch[1].trim();
          const itemsStr = inlineListMatch[2].trim();
          if (folderCandidate.length >= 2 && folderCandidate.length <= 40 && itemsStr.includes(',')) {
            const items = itemsStr.split(',').map(s => s.trim());
            for (const item of items) {
              const matched = findMatchingTab(item);
              if (matched && matched.url) {
                const alreadyAdded = pendingCommands.some(c => c.type === 'ADD_TAB' && c.args.url === matched.url);
                if (!alreadyAdded) {
                  pendingCommands.push({
                    type: 'ADD_TAB',
                    args: { folder: folderCandidate, url: matched.url, title: cleanTabTitle(matched.title || item) },
                    raw: `COMMAND: ADD_TAB folder="${folderCandidate}" url="${matched.url}" title="${cleanTabTitle(matched.title || item)}"`
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Strip all tool commands and XML tags from response
  let cleaned = rawText;
  for (const cmd of commandsFound) {
    cleaned = cleaned.replace(cmd, '');
  }

  cleaned = cleaned
    .replace(/<dots_function_call>[\s\S]*?<\/dots_function_call>/gi, '')
    .replace(/<invoke[\s\S]*?<\/invoke>/gi, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<\/?(?:dots_function_call|invoke|parameter|tool_call|function_calls)[^>]*>/gi, '')
    .trim();

  // 4. If the model output ONLY XML or was blank, synthesize a rich fallback
  if (!cleaned) {
    const q = userPrompt.toLowerCase();
    const userTabs = openTabs.filter(isUserWebTab);
    const hasWorkspaces = folders && folders.length > 0;

    if (q.includes('summar') || q.includes('tab') || q.includes('active') || q.includes('workspace')) {
      let summaryText = '';

      if (userTabs.length > 0) {
        summaryText += `### 📑 Active Open Browser Tabs\n\n` +
          `Here are the ${userTabs.length} tab${userTabs.length > 1 ? 's' : ''} currently active in your browser:\n\n` +
          userTabs.map((t, i) => `${i + 1}. **${t.title || 'Untitled'}**\n   *${t.url}*`).join('\n\n');
      } else {
        summaryText += `### 📑 Active Open Browser Tabs\n\n*You currently have no external browser tabs open.*`;
      }

      if (hasWorkspaces) {
        summaryText += '\n\n---\n\n### 📂 Saved Workspaces Context\n\n';
        folders.forEach((f) => {
          if (f.isLocked) {
            summaryText += `#### **${f.name}** [🔒 Locked]\n*(Unlock this folder in Folders view to inspect tabs)*\n\n`;
            return;
          }
          const tabCount = f.tabs?.length || 0;
          summaryText += `#### **${f.name}** (${tabCount} tab${tabCount === 1 ? '' : 's'})\n`;
          if (f.tabs && f.tabs.length > 0) {
            summaryText += f.tabs.map(t => `- **${t.title || 'Untitled'}** (*${t.url}*)`).join('\n') + '\n\n';
          } else {
            summaryText += `*(Empty folder)*\n\n`;
          }
        });
      }

      summaryText += `\n*You can ask me to open tabs, group them into a workspace, close inactive tabs, or set open/close timers.*`;

      cleaned = summaryText;
    } else if (q.includes('news') || q.includes('ai')) {
      cleaned = "### 🔍 AI News & Updates\n\nI have prepared a live search for the latest news and breakthroughs in AI. Click **Approve & Execute** below to open the search results in a new tab.";
      if (!pendingCommands.some(c => c.type === 'OPEN_TAB')) {
        pendingCommands.push({
          type: 'OPEN_TAB',
          args: { url: 'https://www.google.com/search?q=latest+news+on+AI' },
          raw: 'COMMAND: OPEN_TAB url="https://www.google.com/search?q=latest+news+on+AI"'
        });
      }
    } else if (q.includes('music') || q.includes('youtube') || q.includes('focus')) {
      cleaned = "### 🎵 Focus Music on YouTube\n\nI have prepared a curated focus and study music stream for you on YouTube. Click **Approve & Execute** below to launch it.";
      if (!pendingCommands.some(c => c.type === 'OPEN_TAB')) {
        pendingCommands.push({
          type: 'OPEN_TAB',
          args: { url: 'https://www.youtube.com/results?search_query=focus+music+work+study' },
          raw: 'COMMAND: OPEN_TAB url="https://www.youtube.com/results?search_query=focus+music+work+study"'
        });
      }
    } else {
      cleaned = "I have processed your request. Please review the suggested workspace actions below.";
    }
  }

  return { cleanedText: cleaned, pendingCommands };
}

/**
 * Filter streaming chunks to prevent raw XML tags like <dots_function_call>
 * from displaying on the user's screen during live streaming.
 */
export function sanitizeStreamChunk(chunk: string): string {
  return chunk
    .replace(/<dots_function_call>[\s\S]*?<\/dots_function_call>/gi, '')
    .replace(/<invoke[\s\S]*?<\/invoke>/gi, '')
    .replace(/<\/?(?:dots_function_call|invoke|parameter|tool_call|function_calls)[^>]*>/gi, '')
    .replace(/(?:\*\*|)?COMMAND:[^\n]*\n?/gi, '');
}
