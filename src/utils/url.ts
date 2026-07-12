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
export function isSameUrl(url1: string, url2: string): boolean {
  const clean = (url: string) => {
    const noQueryOrHash = url.split('?')[0].split('#')[0];
    return noQueryOrHash.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
  };
  return clean(url1) === clean(url2);
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
