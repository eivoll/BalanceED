import { useMemo, useRef } from 'react';

interface SpeechRec extends EventTarget {
  lang: string;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
}

type SpeechCtor = new () => SpeechRec;

const Speech =
  (window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition;

/**
 * Dictation for the Mongolian text fields. Browsers without the Web Speech API
 * report `supported: false` so the caller can drop the control rather than fail
 * on click.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const sink = useRef(onText);
  sink.current = onText;
  const listening = useRef(false);

  return useMemo(
    () => ({
      supported: !!Speech,
      start: () => {
        if (!Speech || listening.current) return;
        listening.current = true;
        const rec = new Speech();
        rec.lang = 'mn-MN';
        rec.onresult = (e) => sink.current(e.results[0][0].transcript);
        rec.onend = () => { listening.current = false; };
        rec.onerror = () => { listening.current = false; };
        rec.start();
      },
    }),
    [],
  );
}
