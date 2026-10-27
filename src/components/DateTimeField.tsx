import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from './icons';

const WEEK_SHORT = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ни'];
const DAY_FULL = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Splitting by hand keeps dates local; `new Date('2026-10-27')` would read as UTC and shift a day. */
function parts(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return isReal(y, mo, d) ? { y, m: mo, d } : null;
}

function isReal(y: number, m: number, d: number): boolean {
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
}

/** Monday-first column index for that date. */
const columnOf = (y: number, m: number, d: number) => (new Date(y, m, d).getDay() + 6) % 7;

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function todayParts() {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}

/** Closes a popover on Escape or a click outside, and hands focus back to its trigger. */
function useDismiss(root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, root, trigger, close]);
}

/**
 * The panel hangs under its trigger and flips to a right anchor when the field
 * sits near the edge of a narrow screen, so a phone never gets a cut-off calendar.
 */
function Frame({ children, width = 280 }: { children: ReactNode; width?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  useLayoutEffect(() => {
    const box = host.current?.parentElement?.getBoundingClientRect();
    if (box) setAlign(box.left + width > window.innerWidth - 12 ? 'right' : 'left');
  }, [width]);
  return (
    <div ref={host} className={`animate-pop absolute top-[calc(100%+0.375rem)] z-50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
      {children}
    </div>
  );
}

const shell = 'rounded-2xl border border-line bg-surface p-3 shadow-lift';

export function DateField({
  label,
  value,
  onChange,
  min,
  clearable = true,
  className = '',
}: {
  label?: string;
  /** ISO `YYYY-MM-DD`, or empty when nothing is picked yet. */
  value: string;
  onChange: (next: string) => void;
  /** Earliest selectable date, inclusive. */
  min?: string;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = parts(value);
  const today = todayParts();
  const [view, setView] = useState(() => {
    const base = picked ?? today;
    return { y: base.y, m: base.m };
  });
  const [cursor, setCursor] = useState(() => picked ?? today);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  useDismiss(root, trigger, open, () => setOpen(false));

  // Opening from the keyboard should land on the value, not the first cell of the month.
  useEffect(() => {
    if (!open) return;
    const base = picked ?? today;
    setView({ y: base.y, m: base.m });
    setCursor(base);
  }, [open]);

  const minParts = parts(min ?? '');

  const selectable = (y: number, m: number, d: number) => !minParts || iso(y, m, d) >= iso(minParts.y, minParts.m, minParts.d);

  function commit(y: number, m: number, d: number) {
    if (!selectable(y, m, d)) return;
    onChange(iso(y, m, d));
    setOpen(false);
    trigger.current?.focus();
  }

  function move(days: number) {
    const date = new Date(cursor.y, cursor.m, cursor.d + days);
    setCursor({ y: date.getFullYear(), m: date.getMonth(), d: date.getDate() });
    if (date.getMonth() !== view.m || date.getFullYear() !== view.y) setView({ y: date.getFullYear(), m: date.getMonth() });
  }

  function onGridKey(e: ReactKeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      move(step);
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const next = shiftMonth(view.y, view.m, e.key === 'PageUp' ? -1 : 1);
      setView(next);
      const d = Math.min(cursor.d, daysInMonth(next.y, next.m));
      setCursor({ ...next, d });
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setCursor(today);
      setView({ y: today.y, m: today.m });
    }
  }

  // Roving tabindex: one tab stop for the whole grid, arrows do the rest.
  useEffect(() => {
    if (!open) return;
    const cell = grid.current?.querySelector<HTMLElement>(`[data-day="${cursor.d}"][data-active="1"]`);
    cell?.focus();
  }, [cursor, open]);

  const lead = columnOf(view.y, view.m, 1);
  const count = daysInMonth(view.y, view.m);
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const isPicked = (d: number) => !!picked && picked.y === view.y && picked.m === view.m && picked.d === d;
  const isToday = (d: number) => today.y === view.y && today.m === view.m && today.d === d;

  return (
    <div className={`relative ${className}`}>
      {label && <span className="label">{label}</span>}
      <button
        ref={trigger}
        type="button"
        className="field flex items-center gap-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={16} className="shrink-0 text-accent" />
        <span className={`min-w-0 flex-1 truncate tabular-nums ${value ? '' : 'text-muted/70'}`}>
          {picked
            ? `${picked.y} оны ${picked.m + 1} сарын ${picked.d} · ${DAY_FULL[columnOf(picked.y, picked.m, picked.d)]}`
            : 'Огноо сонгох'}
        </span>
        <Icon name="chevronDown" size={14} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <Frame>
          <div ref={root} role="dialog" aria-label="Огноо сонгох" className={`${shell} w-[17.5rem]`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="icon-toggle h-7 w-7"
                aria-label="Өмнөх сар"
                onClick={() => setView(shiftMonth(view.y, view.m, -1))}
              >
                <Icon name="chevronDown" size={15} className="rotate-90" />
              </button>
              <p className="text-sm font-bold tabular-nums">
                {view.y} он · {view.m + 1} сар
              </p>
              <button
                type="button"
                className="icon-toggle h-7 w-7"
                aria-label="Дараах сар"
                onClick={() => setView(shiftMonth(view.y, view.m, 1))}
              >
                <Icon name="chevronDown" size={15} className="-rotate-90" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-muted">
              {WEEK_SHORT.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div ref={grid} className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKey}>
              {cells.map((d, i) =>
                d === null ? (
                  <span key={`b${i}`} />
                ) : (
                  <button
                    key={d}
                    type="button"
                    data-day={d}
                    data-active={cursor.d === d && cursor.m === view.m && cursor.y === view.y ? 1 : undefined}
                    tabIndex={cursor.d === d && cursor.m === view.m && cursor.y === view.y ? 0 : -1}
                    aria-pressed={isPicked(d)}
                    aria-label={`${view.m + 1} сарын ${d}`}
                    disabled={!selectable(view.y, view.m, d)}
                    onClick={() => commit(view.y, view.m, d)}
                    className={`h-8 rounded-lg text-xs font-semibold tabular-nums outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
                      isPicked(d)
                        ? 'bg-accent text-onaccent'
                        : isToday(d)
                          ? 'bg-accent/15 text-ink hover:bg-accent/25'
                          : 'hover:bg-line/60'
                    }`}
                  >
                    {d}
                  </button>
                ),
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
              <button
                type="button"
                className="text-xs font-bold text-accent hover:underline"
                onClick={() => commit(today.y, today.m, today.d)}
              >
                Өнөөдөр
              </button>
              {clearable && (
                <button
                  type="button"
                  className="text-xs font-semibold text-muted hover:text-danger"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>
        </Frame>
      )}
    </div>
  );
}

/** Times are picked from a grid, so nobody fights a browser's native spinner. */
export function TimeField({
  label,
  value,
  onChange,
  from = 6,
  to = 22,
  minuteStep = 15,
  className = '',
}: {
  label?: string;
  /** `HH:MM`. */
  value: string;
  onChange: (next: string) => void;
  from?: number;
  to?: number;
  minuteStep?: 5 | 10 | 15 | 30;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(root, trigger, open, () => setOpen(false));

  const m = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = m ? Number(m[1]) : 9;
  const minute = m ? Number(m[2]) : 0;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);

  function set(nextHour: number, nextMinute: number) {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  }

  return (
    <div className={`relative ${className}`}>
      {label && <span className="label">{label}</span>}
      <button
        ref={trigger}
        type="button"
        className="field flex items-center gap-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="clock" size={16} className="shrink-0 text-accent" />
        <span className={`min-w-0 flex-1 truncate tabular-nums ${m ? '' : 'text-muted/70'}`}>{m ? value : 'Цаг сонгох'}</span>
        <Icon name="chevronDown" size={14} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <Frame>
          <div ref={root} role="dialog" aria-label="Цаг сонгох" className={`${shell} w-[17.5rem]`}>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="eyebrow text-muted">Цаг</p>
              <p className="text-lg font-extrabold tabular-nums text-accent">
                {pad(hour)}:{pad(minute)}
              </p>
            </div>
            <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto pr-1">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={h === hour}
                  onClick={() => set(h, minute)}
                  className={`h-8 rounded-lg text-xs font-bold tabular-nums transition-all duration-150 ${
                    h === hour ? 'bg-accent text-onaccent' : 'bg-line/50 hover:bg-accent/20'
                  }`}
                >
                  {pad(h)}
                </button>
              ))}
            </div>
            <p className="eyebrow mb-2 mt-3 text-muted">Минут</p>
            <div className="grid grid-cols-4 gap-1">
              {minutes.map((mm) => (
                <button
                  key={mm}
                  type="button"
                  aria-pressed={mm === minute}
                  onClick={() => set(hour, mm)}
                  className={`h-8 rounded-lg text-xs font-bold tabular-nums transition-all duration-150 ${
                    mm === minute ? 'bg-accent text-onaccent' : 'bg-line/50 hover:bg-accent/20'
                  }`}
                >
                  {pad(mm)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-accent/10 py-2 text-xs font-bold text-accent transition-all duration-150 hover:bg-accent/20"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Сонгосон цаагаа ашиглах
            </button>
          </div>
        </Frame>
      )}
    </div>
  );
}

/** One control for a start and an end time, which is how every slot in the app is entered. */
export function TimeRangeFields({
  startLabel = 'Эхлэх',
  endLabel = 'Дуусах',
  start,
  end,
  onChange,
}: {
  startLabel?: string;
  endLabel?: string;
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TimeField label={startLabel} value={start} onChange={(v) => onChange({ start: v, end })} />
      <TimeField label={endLabel} value={end} onChange={(v) => onChange({ start, end: v })} />
    </div>
  );
}
