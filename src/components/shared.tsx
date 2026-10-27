import { useEffect, useState, type ReactNode } from 'react';
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

/** Circular completion gauge with animated arc. */
export function Donut({ pct, size = 120, label }: { pct: number; size?: number; label?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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
          className="donut-arc"
        />
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'rgb(var(--c-ok))' }} />
            <stop offset="100%" style={{ stopColor: 'rgb(var(--c-accent2))' }} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums tracking-tight">{pct}%</span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>}
      </div>
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
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line/70">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: fill }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
        <span>Бага</span>
        <span>Дунд</span>
        <span>Өндөр</span>
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

/** Mini category icon for schedule activities — both languages, because teachers post in either. */
const CAT_PATTERNS: [RegExp, IconName][] = [
  [/сагс|бөмбөг|хөвтөр|тэмцээн|дасгал|бөх|хармаг|гүрлэг|sport|basket|football|judo|swim|gym|tournament/, 'activity'],
  [/робот|програм|код|python|figma|мэдээлэл зүй|stem|robot|code|computer/, 'cpu'],
  [/хөгжим|пиани|гитар|дуун|концерт|music|piano|choir|concert/, 'music'],
  [/зураг|дизайн|урлаг|савдар|гар ур|арт|art|design|draw|paint|mural/, 'palette'],
  [/маргаа|илтгэл|унш|цэвэр яриа|speech|debate|reading|essay/, 'speech'],
  [/сайн дурын|хандив|асрах|номын сан|мод суулг|нийгэм|volunteer|charity|library|community|babysit/, 'heart'],
  [/математик|физи|хими|биологи|түүх|газар зүй|давталт|лабор|tutor|math|physic|chem|science|calc|lab/, 'book'],
];

export function catIcon(activity: string): IconName {
  const a = activity.toLowerCase();
  return CAT_PATTERNS.find(([re]) => re.test(a))?.[1] ?? 'clock';
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
