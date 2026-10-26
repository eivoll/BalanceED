import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'balanceed_theme';

interface A11yState {
  theme: Theme;
  setTheme: (next: Theme) => void;
  voiceInput: (onText: (text: string) => void) => { supported: boolean; start: () => void };
}

const Ctx = createContext<A11yState | null>(null);

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function A11yProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const value = useMemo<A11yState>(
    () => ({
      theme,
      setTheme: setThemeState,
      voiceInput: (onText) => {
        const SR =
          (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
        if (!SR) return { supported: false, start: () => alert('Voice input is not supported in this browser. Дуу оруулга энэ хөтчид дэмжигдэхгүй.') };
        let started = false;
        return {
          supported: true,
          start: () => {
            if (started) return;
            started = true;
            const rec = new SR();
            rec.lang = 'mn-MN';
            rec.onresult = (e) => onText(e.results[0][0].transcript);
            rec.onend = () => { started = false; };
            rec.onerror = () => { started = false; };
            rec.start();
          },
        };
      },
    }),
    [theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

interface SpeechRec extends EventTarget {
  lang: string;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
}

export function useA11y(): A11yState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useA11y must be used within A11yProvider');
  return ctx;
}
