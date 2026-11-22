/**
 * Safe JSON parsing & error-formatting utilities shared across API routes and UI clients.
 * Prevents raw browser SyntaxErrors like:
 *   `Unexpected token '<', "<!doctype "... is not valid JSON`
 * when a reverse proxy, CDN, or SPA fallback returns HTML instead of JSON.
 */

export interface SafeJsonParseResult<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  isHtml: boolean;
  error?: string;
}

export function looksLikeHtmlPayload(rawText: string, contentType?: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    return true;
  }
  const trimmed = rawText.trimStart().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body') ||
    trimmed.startsWith('<!--')
  );
}

export function parseJsonResponseText<T = Record<string, unknown>>(
  rawText: string,
  status: number,
  contentType?: string | null
): SafeJsonParseResult<T> {
  const text = typeof rawText === 'string' ? rawText : '';
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      ok: false,
      isHtml: false,
      error: `Empty response received from server (HTTP ${status}). Please try again.`,
    };
  }

  if (looksLikeHtmlPayload(trimmed, contentType)) {
    return {
      ok: false,
      isHtml: true,
      error:
        status >= 500
          ? `Server gateway returned an HTML error page (HTTP ${status}). The AI service may be temporarily busy—please retry in a few seconds.`
          : `API endpoint returned an HTML page instead of JSON (HTTP ${status}). Please refresh the page or ensure the portal backend server is running.`,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    return {
      ok: true,
      data: parsed,
      isHtml: false,
    };
  } catch {
    return {
      ok: false,
      isHtml: false,
      error: `Received an unreadable non-JSON response from server (HTTP ${status}). Please try again.`,
    };
  }
}

/**
 * Strips optional markdown ```json ... ``` fences before parsing model JSON output.
 */
export function parseModelJsonText<T = Record<string, unknown>>(rawText: string): T {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    throw new Error('Model returned an empty response.');
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate) as T;
}

/**
 * Extracts a clean, teacher-friendly error message from Gemini SDK / HTTP errors.
 */
export function extractReadableApiError(
  err: unknown,
  fallback = 'AI service encountered an unexpected error. Please try again.'
): { status: number; message: string; isTransient: boolean } {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : fallback;

  let extractedMessage = rawMessage;
  let code = 0;
  let statusText = '';

  // Gemini SDK often places a JSON payload inside err.message
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') code = parsed.error.code;
        if (typeof parsed.error.status === 'string') statusText = parsed.error.status;
        if (typeof parsed.error.message === 'string' && parsed.error.message.trim()) {
          extractedMessage = parsed.error.message.trim();
        }
      }
    } catch {
      // Keep rawMessage
    }
  }

  if (!code && typeof err === 'object' && err !== null) {
    const anyErr = err as { status?: number; code?: number };
    if (typeof anyErr.status === 'number') code = anyErr.status;
    else if (typeof anyErr.code === 'number') code = anyErr.code;
  }

  const upper = `${statusText} ${extractedMessage}`.toUpperCase();

  if (
    code === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return {
      status: 403,
      isTransient: false,
      message:
        'Gemini API key permission error. Please verify your GEMINI_API_KEY in Settings > Secrets and try again.',
    };
  }

  if (code === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      status: 429,
      isTransient: true,
      message:
        'AI quota or rate limit temporarily reached. Please wait a moment and try again, or check your API key tier in Settings > Secrets.',
    };
  }

  if (
    code === 503 ||
    code === 500 ||
    code === 504 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('DEADLINE_EXCEEDED') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('ECONNRESET')
  ) {
    return {
      status: 503,
      isTransient: true,
      message:
        'The AI model is temporarily experiencing high demand. Please wait a few seconds and click Generate Paper again.',
    };
  }

  if (code === 404 || upper.includes('NOT_FOUND')) {
    return {
      status: 502,
      isTransient: false,
      message: `AI model lookup failed: ${extractedMessage}`,
    };
  }

  return {
    status: code >= 400 && code < 600 ? code : 502,
    isTransient: false,
    message: extractedMessage || fallback,
  };
}
