import { DAYS } from '../../shared/types';
import type { Day } from '../../shared/types';
import type { ScheduleItemDTO } from '../api';
import { Icon } from './icons';
import { DAY_MN, catIcon } from './shared';

/** Fallback window when a student has nothing booked yet. */
const DEFAULT_START = 8;
const DEFAULT_END = 20;
/** The grid never claims to show the whole day; these are its outer limits. */
const GRID_START = 5;
const GRID_END = 23;

function slotHours(timeSlot: string): [number, number] {
  const [a, b] = timeSlot.split('-').map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h + (m || 0) / 60;
  });
  return [a, b];
}

/** A timetable that starts at 07:00 or runs to 21:30 would otherwise be cut off. */
function hourRange(items: ScheduleItemDTO[]): number[] {
  let from = DEFAULT_START;
  let to = DEFAULT_END;
  for (const i of items) {
    if (i.isFreeSlot) continue;
    const [s, e] = slotHours(i.timeSlot);
    from = Math.min(from, Math.floor(s));
    to = Math.max(to, Math.ceil(e));
  }
  from = Math.max(GRID_START, Math.min(from, GRID_END - 1));
  to = Math.min(GRID_END, Math.max(to, from + 1));
  return Array.from({ length: to - from }, (_, i) => i + from);
}

type Cell = { kind: 'empty' } | { kind: 'covered' } | { kind: 'block'; item: ScheduleItemDTO; span: number };

/**
 * One row per hour, with each activity spanning the hours it covers. Overlapping
 * entries are trimmed to the rows still free, so the table never gains a stray cell.
 */
function dayCells(items: ScheduleItemDTO[], day: Day, hours: number[]): Cell[] {
  const cells: Cell[] = hours.map(() => ({ kind: 'empty' }));
  const blocks = items
    .filter((i) => i.day === day)
    .map((i) => {
      const [s, e] = slotHours(i.timeSlot);
      return {
        item: i,
        from: Math.min(hours.length - 1, Math.max(0, Math.floor(s) - hours[0])),
        to: Math.min(hours.length, Math.max(0, Math.ceil(e) - hours[0])),
      };
    })
    .filter((b) => b.from < b.to)
    // School sits under everything else, so a club that overlaps it still stays visible.
    .sort((a, b) => Number(a.item.isSchool) - Number(b.item.isSchool) || a.from - b.from || b.to - a.to);

  for (const b of blocks) {
    let from = b.from;
    while (from < hours.length && cells[from].kind !== 'empty') from++;
    if (from >= hours.length) continue;
    let span = 1;
    while (from + span < b.to && cells[from + span].kind === 'empty') span++;
    cells[from] = { kind: 'block', item: b.item, span };
    for (let r = from + 1; r < from + span; r++) cells[r] = { kind: 'covered' };
  }
  return cells;
}

export default function ScheduleGrid({
  items,
  editable,
  onRemove,
}: {
  items: ScheduleItemDTO[];
  editable?: boolean;
  onRemove?: (id: string) => void;
}) {
  const hours = hourRange(items);
  const columns = DAYS.map((day) => ({ day, cells: dayCells(items, day, hours) }));

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line/70">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-xs" aria-label="Долоо хоногийн хуваарь">
          <thead>
            <tr className="bg-page/80">
              <th className="w-12 border-b border-r border-line/60 px-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                Цаг
              </th>
              {DAYS.map((d) => (
                <th key={d} className="border-b border-r border-line/60 px-2 py-2.5 text-center last:border-r-0">
                  <span className="block text-xs font-bold">{DAY_MN[d]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h, row) => (
              <tr key={h}>
                <td className="sched-cell border-r bg-page/60 text-center text-[10px] font-semibold tabular-nums text-muted">
                  {String(h).padStart(2, '0')}:00
                </td>
                {columns.map(({ day, cells }) => {
                  const cell = cells[row];
                  if (cell.kind === 'covered') return null;
                  if (cell.kind === 'empty') return <td key={day} className="sched-cell h-9 bg-surface/40" />;
                  const { item, span } = cell;
                  const tone = item.isSchool ? 'sched-school' : item.isFreeSlot ? 'sched-free' : 'sched-busy';
                  return (
                    <td key={day} rowSpan={span} className={`sched-cell h-9 ${tone}`}>
                      <div className="flex h-full items-start gap-1.5 px-1 pt-0.5">
                        <span className="leading-none text-accent" aria-hidden>
                          {item.isSchool ? (
                            <Icon name="school" size={15} />
                          ) : item.isFreeSlot ? (
                            <Icon name="sparkles" size={15} />
                          ) : (
                            <Icon name={catIcon(item.activity)} size={15} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          {item.isFreeSlot ? (
                            <span className="block truncate text-[10px] tabular-nums text-ok/80">{item.timeSlot}</span>
                          ) : (
                            <>
                              <span
                                className={`block truncate text-[11px] font-semibold leading-tight ${
                                  item.isSchool ? 'text-muted' : ''
                                }`}
                              >
                                {item.activity}
                              </span>
                              <span className="block text-[10px] tabular-nums text-muted">{item.timeSlot}</span>
                            </>
                          )}
                        </div>
                        {editable && !item.isFreeSlot && !item.isSchool && onRemove && (
                          <button
                            className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-sm font-bold text-danger/70 transition-all duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
                            title="Устгах"
                            aria-label={`${item.activity} устгах`}
                            onClick={() => onRemove(item.id)}
                          >
                            <Icon name="close" size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-accent/40 bg-accent/15" /> <Icon name="school" size={13} /> Сургуулийн хичээл
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-busy" /> <Icon name="clock" size={13} /> Хичээлээс гадуурх ажил
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-ok/40 bg-free" /> <Icon name="sparkles" size={13} /> Чөлөөт цаг
        </span>
      </div>
    </div>
  );
}
