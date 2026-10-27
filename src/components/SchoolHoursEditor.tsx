import { useState } from 'react';
import { DAYS, type Day } from '../../shared/types';
import { attempt, M, type SchoolHourInput } from '../api';
import { TimeField } from './DateTimeField';
import { Card, DAY_MN, useToast } from './shared';
import { Icon } from './icons';

/** One row per weekday: either a school block or a day off. */
export interface DayRow {
  on: boolean;
  start: string;
  end: string;
}

const emptyRow = (): DayRow => ({ on: false, start: '08:00', end: '15:00' });

export const blankRows = (): Record<Day, DayRow> =>
  Object.fromEntries(DAYS.map((d) => [d, emptyRow()])) as Record<Day, DayRow>;

export function rowsFrom(entries: SchoolHourInput[]): Record<Day, DayRow> {
  const map = blankRows();
  for (const e of entries) {
    const [start, end] = e.timeSlot.split('-');
    if (start && end && e.day in map) map[e.day as Day] = { on: true, start, end };
  }
  return map;
}

/** The shape most Mongolian timetables actually have — where a blank form starts. */
export function weekdayPreset(): Record<Day, DayRow> {
  const rows = blankRows();
  for (const d of DAYS) rows[d] = { on: d !== 'Saturday' && d !== 'Sunday', start: '08:00', end: '15:00' };
  return rows;
}

export function toEntries(rows: Record<Day, DayRow>): SchoolHourInput[] {
  return DAYS.filter((d) => rows[d].on).map((d) => ({ day: d, timeSlot: `${rows[d].start}-${rows[d].end}` }));
}

/** `HH:MM` in, minutes out — negative never counts, so a backwards range reads as empty. */
function minutes(row: DayRow): number {
  const [sh, sm] = row.start.split(':').map(Number);
  const [eh, em] = row.end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function describe(row: DayRow): string {
  return `${Math.round((minutes(row) / 60) * 10) / 10} цаг`;
}

export function SchoolHoursFields({
  value,
  onChange,
  hint,
}: {
  value: Record<Day, DayRow>;
  onChange: (next: Record<Day, DayRow>) => void;
  hint?: string;
}) {
  function patch(day: Day, next: Partial<DayRow>) {
    onChange({ ...value, [day]: { ...value[day], ...next } });
  }

  /** Picking a time on a day off means the student means it to be a school day. */
  function setTime(day: Day, which: 'start' | 'end', v: string) {
    onChange({ ...value, [day]: { ...value[day], [which]: v, on: true } });
  }

  const booked = DAYS.filter((d) => value[d].on);
  const week = booked.reduce((sum, d) => sum + minutes(value[d]), 0);
  const overLong = booked.filter((d) => minutes(value[d]) > 600);
  const backwards = booked.filter((d) => minutes(value[d]) === 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-soft px-3 py-1.5 text-xs"
          onClick={() => onChange(weekdayPreset())}
        >
          <Icon name="school" size={14} /> Даваа–Баасан 08:00–15:00
        </button>
        <button
          type="button"
          className="btn-soft px-3 py-1.5 text-xs"
          onClick={() => onChange(blankRows())}
        >
          <Icon name="refresh" size={14} /> Бүгдийг арилгах
        </button>
        <p className="ml-auto text-xs font-semibold tabular-nums text-muted">
          {booked.length} өдөр · {Math.round((week / 60) * 10) / 10} цаг
        </p>
      </div>

      <div className="grid gap-2">
        {DAYS.map((day) => {
          const row = value[day];
          return (
            <div
              key={day}
              className={`card flex flex-wrap items-center gap-2 px-2.5 py-2 transition-all duration-200 ${
                row.on ? 'border-accent/40 bg-accent/5' : 'opacity-80'
              }`}
            >
              <button
                type="button"
                role="switch"
                aria-checked={row.on}
                aria-label={`${DAY_MN[day]} гарагт сургуультай эсэх`}
                className={`check-box ${row.on ? 'check-row-on' : ''}`}
                onClick={() => patch(day, { on: !row.on })}
              >
                {row.on && (
                  <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path className="check-mark" d="M4 10.5 8 14.5 16 5.5" />
                  </svg>
                )}
              </button>
              <span className={`w-14 shrink-0 text-xs font-bold ${row.on ? 'text-ink' : 'text-muted'}`}>{DAY_MN[day]}</span>
              <div className={`flex gap-2 ${row.on ? '' : 'opacity-60'}`}>
                <TimeField className="w-[7.6rem]" value={row.start} from={5} to={21} onChange={(v) => setTime(day, 'start', v)} />
                <TimeField className="w-[7.6rem]" value={row.end} from={6} to={22} onChange={(v) => setTime(day, 'end', v)} />
              </div>
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted">
                {row.on ? (minutes(row) === 0 ? '—' : describe(row)) : 'Хичээлгүй'}
              </span>
            </div>
          );
        })}
      </div>

      {overLong.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {overLong.map((d) => DAY_MN[d]).join(', ')} гарагийн хичээл 10 цагаас хэтэрч байна.
        </p>
      )}
      {backwards.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {backwards.map((d) => DAY_MN[d]).join(', ')} гарагт эхлэх, дуусах цаг адил байна.
        </p>
      )}
      {hint && <p className="mt-3 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function SchoolHoursCard({
  studentId,
  initial,
  onSaved,
}: {
  studentId: string;
  initial: SchoolHourInput[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<Day, DayRow>>(() => rowsFrom(initial));
  const [saved, setSaved] = useState<Record<Day, DayRow>>(() => rowsFrom(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  const dirty = JSON.stringify(toEntries(rows)) !== JSON.stringify(toEntries(saved));

  async function save() {
    setError('');
    const entries = toEntries(rows);
    if (!entries.length) return setError('Дор хаяж нэг өдөрт хичээлийн цаг заана уу.');
    setBusy(true);
    const problem = await attempt(() => M.setSchoolHours(studentId, entries));
    setBusy(false);
    if (problem) return setError(problem);
    setSaved(rows);
    toast('Хичээлийн хуваарь хадгалагдлаа');
    onSaved();
  }

  return (
    <Card
      title="Сургуулийн долоо хоногийн хуваарь"
      subtitle="Энэ цагийг систем чөлөөт цагт тооцдоггүй — зөвхөн хичээлээс гадуурх ажлыг л үлдсэн цагт багтаана"
      actions={
        <button className="btn-grad px-3 py-1.5 text-xs" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Хадгалж байна…' : <><Icon name="save" size={14} /> Хадгалах</>}
        </button>
      }
    >
      <SchoolHoursFields
        value={rows}
        onChange={setRows}
        hint="Хуваарь солигдвол эцэг эхийн өмнөх зөвшөөрөл цуцлагдана."
      />
      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {node}
    </Card>
  );
}
