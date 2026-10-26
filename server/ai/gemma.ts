import 'dotenv/config';
import { createHash } from 'node:crypto';

const API_KEY = process.env.GOOGLE_AI_API_KEY ?? '';
const MODEL = process.env.GEMMA_MODEL || 'gemma-3-27b-it';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const gemmaEnabled = Boolean(API_KEY);

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 60;
/** Prompt digest -> expiry + text, so reopening a report does not re-bill an identical request. */
const cache = new Map<string, [number, string]>();

/**
 * Single-turn Gemma completion via Google AI Studio. Returns null when no
 * API key is configured or the call fails — callers must fall back to the
 * deterministic templates in analysis.ts.
 */
export async function gemmaComplete(prompt: string): Promise<string | null> {
  if (!API_KEY) return null;
  const digest = createHash('sha256').update(prompt).digest('hex');
  const cached = cache.get(digest);
  if (cached) {
    if (cached[0] > Date.now()) return cached[1];
    cache.delete(digest);
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      // The key goes in a header: as a query parameter it lands in proxy logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[gemma] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    if (text === null) return null;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(digest, [Date.now() + CACHE_TTL_MS, text]);
    return text;
  } catch (err) {
    console.warn('[gemma] request failed:', (err as Error).message);
    return null;
  }
}
