import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { navigate, type Page } from '../router';
import { Icon, type IconName } from './icons';

export const DAY_MN: Record<string, string> = {
  Monday: 'Даваа',
  Tuesday: 'Мягмар',
  Wednesday: 'Лхагва',
  Thursday: 'Пүрэв',
  Friday: 'Баасан',
  Saturday: 'Бямба',
  Sunday: 'Ням',
};

export const STATUS_MN: Record<string, string> = {
  Balanced: 'Тэнцвэртэй',
  Manageable: 'Хэвийн',
  Busy: 'Ачаалалтай',
  Overworked: 'Хэт ачаалалтай',
};

export const RISK_MN: Record<string, string> = {
  Low: 'Бага',
  Medium: 'Дунд',
  High: 'Өндөр',
};

export const LEVEL_MN: Record<string, string> = {
  School: 'Сургуулийн',
  National: 'Үндэсний',
  Global: 'Олон улсын',
};

/** Status always pairs color with an icon, so it never relies on hue alone. */
export function StatusIcon({ level }: { level: 'ok' | 'warn' | 'danger' }) {
  if (level === 'ok') return <Icon name="check" title="Сайн" />;
  if (level === 'warn') return <Icon name="alert" title="Анхааруулга" />;
  return <Icon name="octagon" title="Эрсдэл өндөр" />;
}

export function riskLevel(risk: string): 'ok' | 'warn' | 'danger' {
  return risk === 'Low' ? 'ok' : risk === 'Medium' ? 'warn' : 'danger';
}

export function scoreLevel(score: number): 'ok' | 'warn' | 'danger' {
  return score < 4 ? 'ok' : score <= 7 ? 'warn' : 'danger';
}

const LEVEL_TEXT: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};
const LEVEL_SOFT: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'bg-ok/10 text-ok border-ok/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
};

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'info' }) {
  const cls =
    tone === 'good'
      ? 'bg-ok/10 text-ok border-ok/30'
      : tone === 'bad'
        ? 'bg-danger/10 text-danger border-danger/30'
        : tone === 'info'
          ? 'bg-accent/10 text-accent border-accent/30'
          : 'bg-surface text-muted border-line';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const level = scoreLevel(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${LEVEL_SOFT[level]}`}>
      <StatusIcon level={level} /> {score.toFixed(1)}<span className="font-medium opacity-70">/10</span>
    </span>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const SPARK_TONE = ['rgb(var(--c-ok))', 'rgb(var(--c-accent2))', 'rgb(var(--c-accent))'];
/** Uneven angles and offsets read as a burst rather than a clockwork ring. */
const SPARKS = Array.from({ length: 11 }, (_, i) => ({
  a: (i * 32.7 + 8) * (Math.PI / 180),
  fill: SPARK_TONE[i % SPARK_TONE.length],
  late: (i % 5) * 0.045,
}));

/**
 * Eases a number toward its target so a rising percentage is followed, not snapped to.
 * Mounted values are painted as-is — only a change after mount animates.
 */
export function useCountUp(target: number, ms = 800) {
  const [shown, setShown] = useState(target);
  const live = useRef({ value: target, raf: 0 });

  useEffect(() => {
    const s = live.current;
    if (s.value === target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      s.value = target;
      setShown(target);
      return;
    }
    const from = s.value;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      s.value = Math.round(from + (target - from) * (1 - (1 - p) ** 3));
      setShown(s.value);
      if (p < 1) s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [target, ms]);

  return shown;
}

/** Circular completion gauge with animated arc. */
export function Donut({
  pct,
  size = 120,
  label,
  celebrate = false,
}: {
  pct: number;
  size?: number;
  label?: string;
  celebrate?: boolean;
}) {
  const shown = useCountUp(pct);
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, shown)) / 100) * c;
  // 12px is the ring's own thickness plus breathing room, so the figure can never
  // touch the arc — text-2xl "100%" is wider than the hole of a small gauge.
  const inner = Math.round(size * 0.22);
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${celebrate ? 'donut-flash' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} className="stroke-line/70" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          stroke="url(#donutGrad)"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'rgb(var(--c-ok))' }} />
            <stop offset="100%" style={{ stopColor: 'rgb(var(--c-accent2))' }} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-3 flex flex-col items-center justify-center leading-none">
        <span className={`font-extrabold tabular-nums tracking-tight whitespace-nowrap ${celebrate ? 'donut-num-pop' : ''}`} style={{ fontSize: inner }}>
          {shown}%
        </span>
        {label && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>}
      </div>
      {celebrate && (
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="donut-spark"
              style={
                {
                  '--sx': `${Math.cos(s.a) * size * 0.62}px`,
                  '--sy': `${Math.sin(s.a) * size * 0.62}px`,
                  background: s.fill,
                  animationDelay: `${0.62 + s.late}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Semicircular workload dial, 1-10. */
export function GaugeDial({ score }: { score: number }) {
  const level = scoreLevel(score);
  const frac = Math.min(10, Math.max(0, score)) / 10;
  const r = 70;
  const half = Math.PI * r;
  const off = half - frac * half;
  const stroke = level === 'ok' ? 'rgb(var(--c-ok))' : level === 'warn' ? 'rgb(var(--c-warn))' : 'rgb(var(--c-danger))';
  return (
    <div className="relative w-[180px]">
      <svg width={180} height={100} viewBox="0 0 180 100">
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" strokeWidth={14} strokeLinecap="round" className="stroke-line/70" />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          style={{ stroke }}
          strokeDasharray={half}
          strokeDashoffset={off}
          className="gauge-arc"
        />
        {[...Array(10)].map((_, i) => {
          const a = Math.PI - (i / 9) * Math.PI;
          const x1 = 90 + Math.cos(a) * 54;
          const y1 = 90 - Math.sin(a) * 54;
          const x2 = 90 + Math.cos(a) * 48;
          const y2 = 90 - Math.sin(a) * 48;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2} className="stroke-line" />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className={`text-3xl font-extrabold tabular-nums tracking-tight ${LEVEL_TEXT[level]}`}>{score.toFixed(1)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Ачаалал / 10</span>
      </div>
    </div>
  );
}

/** Stress is a 0-100 reading, so it gets a bar rather than a dial copied from load. */
/** Mirrors riskFromScore on the server: 0–24 бага, 25–54 дунд, 55+ өндөр. */
const RISK_BANDS = [25, 55];
const RISK_ZONES = [
  { label: 'Бага', width: 25, align: 'text-left' },
  { label: 'Дунд', width: 30, align: 'text-center' },
  { label: 'Өндөр', width: 45, align: 'text-right' },
];

export function StressMeter({ score, risk, width = 180 }: { score: number; risk: string; width?: number }) {
  const level = riskLevel(risk);
  const fill = level === 'ok' ? 'rgb(var(--c-ok))' : level === 'warn' ? 'rgb(var(--c-warn))' : 'rgb(var(--c-danger))';
  return (
    <div style={{ width }} className="shrink-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow text-muted">Стресс</span>
        <span className={`text-lg font-extrabold tabular-nums leading-none ${LEVEL_TEXT[level]}`}>
          {score}
          <span className="text-[11px] font-bold text-muted">/100</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-line/70">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: fill }}
        />
        {RISK_BANDS.map((edge) => (
          <span key={edge} className="absolute top-0 h-full w-px bg-ink/25" style={{ left: `${edge}%` }} />
        ))}
      </div>
      <div className="mt-1 flex text-[10px] font-semibold text-muted">
        {RISK_ZONES.map((z) => (
          <span key={z.label} className={z.align} style={{ width: `${z.width}%` }}>
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Friendly AI coach avatar with a speech bubble. */
export function CoachCard({ children, title = 'AI зөвлөгөө' }: { children: ReactNode; title?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-onaccent shadow-md">
        <Icon name="bulb" size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-1 text-accent">{title}</p>
        <div className="mn-bubble">{children}</div>
      </div>
    </div>
  );
}

/** Route-backed tab strip — each button is a page with its own URL. */
export function PageNav({
  label,
  page,
  items,
}: {
  label: string;
  page: Page;
  items: { id: Page; label: string; icon: IconName }[];
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(t.id)}
          aria-current={page === t.id ? 'page' : undefined}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            page === t.id
              ? 'bg-accent text-onaccent shadow-md'
              : 'border border-line bg-surface/70 text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink hover:shadow-sm'
          }`}
        >
          <Icon name={t.icon} size={16} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** Mini category icon for schedule activities — both languages, because teachers post in either. */
const CAT_PATTERNS: [RegExp, IconName, string][] = [
  [/сагс|бөмбөг|хөвтөр|тэмцээн|дасгал|бөх|хармаг|гүрлэг|sport|basket|football|judo|swim|gym|tournament/, 'activity', 'Спорт'],
  [/робот|програм|код|python|figma|мэдээлэл зүй|stem|robot|code|computer/, 'cpu', 'Кодчлол'],
  [/хөгжим|пиани|гитар|дуун|концерт|music|piano|choir|concert/, 'music', 'Хөгжим'],
  [/зураг|дизайн|урлаг|савдар|гар ур|арт|art|design|draw|paint|mural/, 'palette', 'Урлаг'],
  [/маргаа|илтгэл|унш|цэвэр яриа|speech|debate|reading|essay/, 'speech', 'Маргаа'],
  [/сайн дурын|хандив|асрах|номын сан|мод суулг|нийгэм|volunteer|charity|library|community|babysit/, 'heart', 'Нийгэмд'],
  [/математик|физи|хими|биологи|түүх|газар зүй|давталт|лабор|tutor|math|physic|chem|science|calc|lab/, 'book', 'Хичээл'],
];

function catOf(text: string): [RegExp, IconName, string] | undefined {
  const a = text.toLowerCase();
  return CAT_PATTERNS.find(([re]) => re.test(a));
}

export function catIcon(activity: string): IconName {
  return catOf(activity)?.[1] ?? 'clock';
}

/** Category label for an opportunity or activity; empty when nothing matches. */
export function catTag(activity: string): string {
  return catOf(activity)?.[2] ?? '';
}

/** Mongolian dates read month-first ("10 сарын 29"); the browser's mn-MN locale data is not reliable. */
export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return `${d.getMonth() + 1} сарын ${d.getDate()}`;
}

/** Local `YYYY-MM-DD` for today — used to stop pickers offering a date already past. */
export function todayIso(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.tone === 'ok' ? 2600 : 6000);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" aria-live="polite" className="animate-pop fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`glass flex max-w-[90vw] items-center gap-2 bg-surface/95 px-4 py-2.5 text-sm font-semibold shadow-lift ${
          msg.tone === 'ok' ? 'border-ok/40 text-ok' : 'border-danger/40 text-danger'
        }`}
      >
        <StatusIcon level={msg.tone === 'ok' ? 'ok' : 'danger'} /> {msg.text}
      </div>
    </div>
  ) : null;
  const toast = (text: string) => setMsg({ text, tone: 'ok' });
  const toastError = (text: string) => setMsg({ text, tone: 'error' });
  return { toast, toastError, node };
}

/** Codes are stored bare and shown in two groups, so they stay readable when dictated. */
export const formatJoinCode = (code: string): string => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

/** One code entry + button, shared by the teacher roster and the childless parent view. */
export function CodeLinkForm({
  hint,
  button,
  submit,
  onDone,
}: {
  hint: string;
  button: string;
  /** Returns the server's error message, or null when the link succeeded. */
  submit: (code: string) => Promise<string | null>;
  onDone: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const fieldId = useId();

  async function run(e: { preventDefault(): void }) {
    e.preventDefault();
    setProblem('');
    setBusy(true);
    const err = await submit(code);
    setBusy(false);
    if (err) return setProblem(err);
    setCode('');
    onDone();
  }

  return (
    <form className="flex flex-wrap items-start gap-2" onSubmit={run}>
      <div className="min-w-0 flex-1">
        <label className="label" htmlFor={fieldId}>
          Холбох код
        </label>
        <input
          id={fieldId}
          className="field"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC-123"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button type="submit" className="btn-soft mt-5 px-4 py-2 text-xs" disabled={busy || code.trim().length < 4}>
        {busy ? 'Шалгаж байна…' : button}
      </button>
      {problem && <p className="w-full text-[11px] font-semibold text-danger">{problem}</p>}
      <p className="w-full text-[11px] leading-relaxed text-muted">{hint}</p>
    </form>
  );
}
