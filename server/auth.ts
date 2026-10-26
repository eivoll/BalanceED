import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

export const SESSION_COOKIE = 'balanceed_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const KEY_LEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// promisify only sees the 3-argument overload, so re-declare the options form.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * A salt fixed at process start, used to burn the same CPU when the account
 * does not exist as a real check does, so login timing cannot enumerate users.
 */
const ABSENT_SALT = randomBytes(16);

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** scrypt with a per-password salt; params are stored in the digest so they can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password.normalize('NFKC'), salt, KEY_LEN, SCRYPT)) as Buffer;
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length !== KEY_LEN) return false;
  try {
    const actual = (await scryptAsync(
      password.normalize('NFKC'),
      Buffer.from(parts[4], 'base64'),
      KEY_LEN,
      { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: SCRYPT.maxmem },
    )) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Hash a password, or burn the same time verifying a dummy when the account is missing. */
export async function verifyOrPad(password: string, stored: string | undefined): Promise<boolean> {
  if (stored) return verifyPassword(password, stored);
  await scryptAsync(password.normalize('NFKC'), ABSENT_SALT, KEY_LEN, SCRYPT);
  return false;
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
