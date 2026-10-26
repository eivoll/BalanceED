import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'balanceed_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const KEY_LEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** scrypt with a per-password salt; params are stored in the digest so they can be raised later. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize('NFKC'), salt, KEY_LEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length !== KEY_LEN) return false;
  try {
    const actual = scryptSync(
      password.normalize('NFKC'),
      Buffer.from(parts[4], 'base64'),
      KEY_LEN,
      { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: SCRYPT.maxmem },
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Only the digest of a random token is stored, so a leaked database cannot replay sessions. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/** Scoped to /graphql because nothing outside the API needs it. */
export function sessionCookie(token: string, ttlMs = SESSION_TTL_MS): string {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/graphql; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}${secure}`;
}

export function clearedSessionCookie(): string {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/graphql; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
