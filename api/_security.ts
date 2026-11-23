import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';

/**
 * Serverless Security Suite for PakEdu Vercel Endpoints (/api/*)
 * - Zero-Secret JWT verification using `jose` & Google's public JWKS certificates
 * - Requires NO Firebase Admin SDK and NO Service Account
 * - Payload size enforcement (256KB max)
 * - Distributed rate limiting (Upstash Redis / Vercel KV with safe in-memory fallback)
 * - Strict CORS restricted to application origins
 */

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'rising-safeguard-8bcxw';

// Google's official public JSON Web Key Set (JWKS) for Firebase Auth ID tokens
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  payload?: JWTPayload;
}

/**
 * Verifies a Firebase ID token cryptographically using Google's public JWKS.
 * Checks signature, expiration, issuer (https://securetoken.google.com/<projectId>),
 * and audience (<projectId>).
 */
export async function verifyFirebaseToken(idToken: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  return payload;
}

/**
 * Authenticates request via Authorization: Bearer <token>.
 * If invalid, expired, or missing, immediately replies with HTTP 401 and returns null.
 */
export async function authenticateRequest(
  req: any,
  res: any
): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Missing or invalid Authorization Bearer token header.',
    });
    return null;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({
      error: 'Unauthorized: Empty token provided.',
    });
    return null;
  }

  try {
    const payload = await verifyFirebaseToken(idToken);
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : undefined;

    if (!uid) {
      res.status(401).json({
        error: 'Unauthorized: Token payload is missing a valid subject (UID).',
      });
      return null;
    }

    return { uid, email, payload };
  } catch (err: any) {
    console.warn('[ServerlessAuth] Token verification failed:', err.message || err);
    res.status(401).json({
      error: 'Unauthorized: The provided Firebase ID token is invalid or expired.',
      code: err.code || 'auth/invalid-token',
    });
    return null;
  }
}

/**
 * Strict CORS and Security Headers
 */
export function setCorsAndSecurityHeaders(req: any, res: any): boolean {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://pakedu.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const isAllowed =
    allowedOrigins.includes(origin) ||
    (origin.startsWith('https://pakedu-') && origin.endsWith('.vercel.app'));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://pakedu.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // Preflight handled
  }
  return false;
}

/**
 * Enforces JSON payload limit (256KB) to prevent DoS memory exhaustion
 */
export function validatePayloadSize(
  req: any,
  res: any,
  maxBytes: number = 256 * 1024
): boolean {
  const rawBody = req.body;
  const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
  const byteLength = Buffer.byteLength(bodyString, 'utf8');

  if (byteLength > maxBytes) {
    res.status(413).json({
      error: `Payload Too Large: Request body (${Math.round(byteLength / 1024)}KB) exceeds the 256KB limit.`,
    });
    return false;
  }
  return true;
}

// In-Memory Rate Limiting Fallback
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const inMemoryStore = new Map<string, RateLimitRecord>();

function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, val] of inMemoryStore.entries()) {
    if (val.resetAt < now) {
      inMemoryStore.delete(key);
    }
  }
}

/**
 * Distributed (Upstash Redis / Vercel KV) or In-Memory Rate Limiter
 */
async function incrementCounter(
  key: string,
  windowSeconds: number
): Promise<{ count: number; ttlSeconds: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const response = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, windowSeconds],
          ['TTL', key],
        ]),
      });

      if (response.ok) {
        const results = await response.json();
        const count = results[0]?.result || 1;
        const ttl = results[2]?.result || windowSeconds;
        return { count, ttlSeconds: ttl };
      }
    } catch (err) {
      console.warn('[RateLimit] Upstash/KV REST failed, using in-memory store:', err);
    }
  }

  // In-memory fallback
  cleanExpiredEntries();
  const now = Date.now();
  const existing = inMemoryStore.get(key);

  if (!existing || existing.resetAt <= now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { count: 1, ttlSeconds: windowSeconds };
  }

  existing.count += 1;
  const ttlSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return { count: existing.count, ttlSeconds };
}

/**
 * Checks per-user (30/min) and per-IP (60/min) rate limits
 */
export async function enforceRateLimits(
  req: any,
  res: any,
  userId: string
): Promise<boolean> {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';

  // 1. Per-User limit: 30 requests / min
  const userKey = `ratelimit:user:${userId}`;
  const userRate = await incrementCounter(userKey, 60);

  if (userRate.count > 30) {
    res.setHeader('Retry-After', String(userRate.ttlSeconds));
    res.status(429).json({
      error: 'Too Many Requests: User rate limit exceeded (30 requests/min). Please wait before trying again.',
      retryAfterSeconds: userRate.ttlSeconds,
    });
    return false;
  }

  // 2. Per-IP limit: 60 requests / min
  const ipKey = `ratelimit:ip:${ip}`;
  const ipRate = await incrementCounter(ipKey, 60);

  if (ipRate.count > 60) {
    res.setHeader('Retry-After', String(ipRate.ttlSeconds));
    res.status(429).json({
      error: 'Too Many Requests: IP rate limit exceeded (60 requests/min). Please wait before trying again.',
      retryAfterSeconds: ipRate.ttlSeconds,
    });
    return false;
  }

  return true;
}
