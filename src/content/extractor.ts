/**
 * Tabflow Content Extractor
 * Injected into active pages to extract readable content for summarization.
 */

function extractReadableText() {
  // 1. If there's a selection, prioritize that.
  const selection = window.getSelection()?.toString().trim();
  if (selection && selection.length > 50) return selection;

  // 2. Try to grab <article> or main content areas
  const article = document.querySelector('article, main, [role="main"]');
  if (article) {
    return cleanText(article.textContent || '');
  }

  // 3. Fallback to body text, stripping nav/footer/scripts
  const clone = document.body.cloneNode(true) as HTMLElement;
  const junkSelectors = ['nav', 'header', 'footer', 'script', 'style', 'noscript', 'iframe', 'svg', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'];
  
  junkSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  return cleanText(clone.textContent || '');
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/<[^>]*>?/gm, '') // Strip remaining HTML tags just in case
    .trim()
    .slice(0, 15000); // Limit size to ~4000 tokens to avoid crashing extensions
}

const text = extractReadableText();
const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

// IMPORTANT: This expression MUST be the last statement in the file.
// chrome.scripting.executeScript uses it as the return value.
// Do NOT add any code after this line.
({ text, metaDescription });
