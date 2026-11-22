/**
 * Server environment variable parsing, validation, and security hardening.
 * Ensures placeholder keys are rejected, numeric limits are bounded, and
 * model names stay within the approved active Gemini model allowlist.
 */

const PLACEHOLDER_API_KEYS = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY_HERE',
  'REPLACE_WITH_YOUR_GEMINI_API_KEY',
  'CHANGEME',
]);

export const DEFAULT_GEMINI_API_KEY = '';

const ALLOWED_FREE_TIER_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-4-hydrogen',
]);

export interface ParsedServerEnv {
  port: number;
  nodeEnv: string;
  appUrl: string;
  geminiApiKey: string;
  hasValidGeminiApiKey: boolean;
  primaryModel: string;
  fallbackModel: string;
  rateLimitPerMinute: number;
  cacheTtlMs: number;
}

export function isPlaceholderApiKey(rawKey: unknown): boolean {
  if (typeof rawKey !== 'string') return true;
  const normalized = rawKey.trim();
  if (!normalized) return true;
  if (PLACEHOLDER_API_KEYS.has(normalized.toUpperCase())) return true;
  if (normalized.toLowerCase().includes('your_gemini_api_key')) return true;
  return false;
}

export function getEffectiveGeminiApiKey(candidateKey?: unknown): string {
  if (typeof candidateKey === 'string' && !isPlaceholderApiKey(candidateKey)) {
    return candidateKey.trim();
  }
  // 1. Server-side environment variables (Node.js & Vercel Functions)
  const nodeKey =
    typeof process !== 'undefined' && process.env
      ? process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
      : '';
  if (!isPlaceholderApiKey(nodeKey)) {
    return nodeKey.trim();
  }

  // 2. Client-side environment variables (Vite & Capacitor Android build)
  try {
    const viteKey =
      typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_GEMINI_API_KEY as string) ||
          (import.meta.env.GEMINI_API_KEY as string) ||
          ''
        : '';
    if (!isPlaceholderApiKey(viteKey)) {
      return viteKey.trim();
    }
  } catch {
    // Ignore environments where import.meta is unavailable
  }

  return DEFAULT_GEMINI_API_KEY;
}

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const num = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function resolveAllowedModel(raw: string | undefined, fallback: string): string {
  const candidate = (raw || '').trim();
  if (candidate && ALLOWED_FREE_TIER_MODELS.has(candidate)) {
    return candidate;
  }
  return fallback;
}

export function parseServerEnv(
  env: Record<string, string | undefined>
): ParsedServerEnv {
  const rawApiKey = (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim();
  const effectiveApiKey = getEffectiveGeminiApiKey(rawApiKey);
  const hasValidGeminiApiKey = !isPlaceholderApiKey(effectiveApiKey);

  const port = parseBoundedInt(env.PORT, 3000, 1024, 65535);
  const rateLimitPerMinute = parseBoundedInt(
    env.API_RATE_LIMIT_PER_MINUTE,
    45,
    5,
    500
  );
  const cacheTtlMinutes = parseBoundedInt(
    env.API_CACHE_TTL_MINUTES,
    30,
    1,
    180
  );

  return {
    port,
    nodeEnv: (env.NODE_ENV || 'development').trim(),
    appUrl: (env.APP_URL || '').trim(),
    geminiApiKey: effectiveApiKey,
    hasValidGeminiApiKey,
    primaryModel: resolveAllowedModel(
      env.GEMINI_PRIMARY_MODEL,
      'gemini-4-hydrogen'
    ),
    fallbackModel: resolveAllowedModel(
      env.GEMINI_FALLBACK_MODEL,
      'gemini-3.1-flash-lite'
    ),
    rateLimitPerMinute,
    cacheTtlMs: cacheTtlMinutes * 60 * 1000,
  };
}
