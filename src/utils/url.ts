/**
 * Tabflow URL Utilities
 * Shared URL validation, comparison, and sanitization functions.
 */

/** Allowed URL schemes for tabs */
const ALLOWED_SCHEMES = ['http:', 'https:'];

/** Blocked URL schemes that could be used for injection */
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'file:', 'chrome:', 'chrome-extension:', 'about:', 'blob:', 'vbscript:'];

/**
 * Validates that a URL is safe to open in a browser tab.
 * Only allows http:// and https:// protocols.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  // Block known dangerous schemes
  const lowerUrl = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) return false;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_SCHEMES.includes(parsed.protocol);
  } catch {
    // If it doesn't parse as a URL, it might be a bare domain like "google.com"
    // We'll allow these since sanitizeUrl will prepend https://
    try {
      const withProtocol = new URL(`https://${trimmed}`);
      return ALLOWED_SCHEMES.includes(withProtocol.protocol);
    } catch {
      return false;
    }
  }
}

/**
 * Ensures a URL has a protocol prefix.
 * Returns the URL with https:// prepended if no scheme is present.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Compares two URLs for equivalence, ignoring:
 * - Protocol (http vs https)
 * - www. prefix
 * - Trailing slash
 * - Query string and hash
 */
export function isSameUrl(url1?: string, url2?: string): boolean {
  if (!url1 || !url2) return false;
  const s1 = sanitizeUrl(url1);
  const s2 = sanitizeUrl(url2);
  try {
    const u1 = new URL(s1);
    const u2 = new URL(s2);

    // Normalize hostname: lowercase, remove www.
    const h1 = u1.hostname.replace(/^www\./, '').toLowerCase();
    const h2 = u2.hostname.replace(/^www\./, '').toLowerCase();
    if (h1 !== h2) return false;

    // Normalize port
    const port1 = u1.port || (u1.protocol === 'https:' ? '443' : '80');
    const port2 = u2.port || (u2.protocol === 'https:' ? '443' : '80');
    if (port1 !== port2) return false;

    // Normalize pathname: remove trailing slash, normalize empty to /
    const p1 = (u1.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    const p2 = (u2.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    if (p1 !== p2) return false;

    // Normalize search params: sorted keys
    const sp1 = Array.from(u1.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const sp2 = Array.from(u2.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sp1.length !== sp2.length) return false;
    for (let i = 0; i < sp1.length; i++) {
      if (sp1[i][0] !== sp2[i][0] || sp1[i][1] !== sp2[i][1]) return false;
    }

    return true;
  } catch {
    const clean = (url: string) => url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
    return clean(url1) === clean(url2);
  }
}

/**
 * Strips potentially dangerous content from text that will be included
 * in LLM prompts. Removes control characters and normalizes whitespace.
 */
export function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  // Remove control characters (except newline, tab)
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * Strips notification counters like (10), (99+), [2], (*), and leading numbers from tab titles.
 */
export function cleanTabTitle(title?: string): string {
  if (!title) return 'Untitled';
  let clean = title;
  clean = clean.replace(/^[\(\[\{]\s*(?:\d+\+?|[\*\•\!])\s*[\)\]\}]\s*/g, '');
  clean = clean.replace(/^\d+[\.\-\)]\s+/g, '');
  clean = clean.trim();
  return clean || title;
}

/**
 * Extracts a clean domain string (e.g. "youtube.com", "chatgpt.com") from a URL.
 */
export function getCleanDomain(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

/**
 * Strips pipes '|' and cleans tab titles for safe embedding into Markdown tables and prompts.
 */
export function sanitizeTabTitleForTable(title?: string): string {
  const clean = cleanTabTitle(title);
  return clean.replace(/\|/g, '-').replace(/\s+/g, ' ').trim();
}
