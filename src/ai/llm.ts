import { getSetting } from '@/storage/db';

export type Provider = 'gemini' | 'openrouter' | 'chatgpt';

export interface AIConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string }, delta?: { content?: string } }>;
}

export async function getAIConfig(): Promise<AIConfig | null> {
  const provider = await getSetting<Provider>('aiProvider', 'gemini');
  const apiKey = await getSetting<string>(`apiKey_${provider}`, '');
  const model = await getSetting<string>(`model_${provider}`, '');

  if (!apiKey) return null;

  return { provider, apiKey, model };
}

// Universal call function
export async function callLLM(prompt: string, systemPrompt: string = ''): Promise<string> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error('No AI provider configured. Please set an API key in settings.');
  }

  const { provider, apiKey, model } = config;

  if (provider === 'gemini') {
    return callGemini(apiKey, model || 'gemini-2.5-flash', prompt, systemPrompt);
  } else if (provider === 'openrouter') {
    return callOpenRouter(apiKey, model || 'google/gemini-2.5-flash', prompt, systemPrompt);
  } else if (provider === 'chatgpt') {
    return callChatGPT(apiKey, model || 'gpt-4o-mini', prompt, systemPrompt);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function callGemini(apiKey: string, model: string, prompt: string, systemPrompt: string): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: 0.3 }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[GEMINI_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }
  const data = await res.json() as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callChatGPT(apiKey: string, model: string, prompt: string, systemPrompt: string): Promise<string> {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[OPENAI_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }
  const data = await res.json() as OpenAIResponse;
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(apiKey: string, model: string, prompt: string, systemPrompt: string): Promise<string> {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/google-deepmind/antigravity',
      'X-Title': 'Tabflow Browser AI'
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[OPENROUTER_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }
  const data = await res.json() as OpenAIResponse;
  return data.choices?.[0]?.message?.content || '';
}

export async function streamLLM(
  prompt: string,
  systemPrompt: string = '',
  onChunk: (text: string) => void
): Promise<string> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error('No AI provider configured. Please set an API key in settings.');
  }

  const { provider, apiKey, model } = config;

  if (provider === 'gemini') {
    return streamGemini(apiKey, model || 'gemini-2.5-flash', prompt, systemPrompt, onChunk);
  } else if (provider === 'openrouter') {
    return streamOpenRouter(apiKey, model || 'google/gemini-2.5-flash', prompt, systemPrompt, onChunk);
  } else if (provider === 'chatgpt') {
    return streamChatGPT(apiKey, model || 'gpt-4o-mini', prompt, systemPrompt, onChunk);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function streamGemini(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: 0.3 }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[GEMINI_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }

  return parseSSEResponse<GeminiResponse>(res, onChunk, (json) => json.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

async function streamChatGPT(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, stream: true })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[OPENAI_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }

  return parseSSEResponse<OpenAIResponse>(res, onChunk, (json) => json.choices?.[0]?.delta?.content || '');
}

async function streamOpenRouter(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/google-deepmind/antigravity',
      'X-Title': 'Tabflow Browser AI'
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, stream: true })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`[OPENROUTER_API_ERROR] ${res.status} ${res.statusText}: ${errorBody}`);
  }

  return parseSSEResponse<OpenAIResponse>(res, onChunk, (json) => json.choices?.[0]?.delta?.content || '');
}

async function parseSSEResponse<T>(
  res: Response,
  onChunk: (text: string) => void,
  extractText: (json: T) => string
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Response body not readable");
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') continue;
        
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          try {
            const json = JSON.parse(dataStr) as T;
            const text = extractText(json);
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch (e) {
            // Log partial/malformed SSE chunks for debugging (M7)
            console.warn('[Tabflow SSE] Failed to parse chunk:', dataStr, e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
