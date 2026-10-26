import 'dotenv/config';

const API_KEY = process.env.GOOGLE_AI_API_KEY ?? '';
const MODEL = process.env.GEMMA_MODEL || 'gemma-3-27b-it';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const gemmaEnabled = Boolean(API_KEY);

/**
 * Single-turn Gemma completion via Google AI Studio. Returns null when no
 * API key is configured or the call fails — callers must fall back to the
 * deterministic templates in analysis.ts.
 */
export async function gemmaComplete(prompt: string): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.warn('[gemma] request failed:', (err as Error).message);
    return null;
  }
}
