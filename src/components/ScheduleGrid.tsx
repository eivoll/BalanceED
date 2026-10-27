import { DAYS } from '../../shared/types';
import type { Day } from '../../shared/types';
import type { ScheduleItemDTO } from '../api';
import { Icon } from './icons';
import { DAY_MN, catIcon } from './shared';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 – 20:00

function slotHours(timeSlot: string): [number, number] {
  const [a, b] = timeSlot.split('-').map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h + (m || 0) / 60;
  });
  return [a, b];
}

type Cell = { kind: 'empty' } | { kind: 'covered' } | { kind: 'block'; item: ScheduleItemDTO; span: number };

/**
 * One row per hour, with each activity spanning the hours it covers. Overlapping
 * entries are trimmed to the rows still free, so the table never gains a stray cell.
 */
function dayCells(items: ScheduleItemDTO[], day: Day): Cell[] {
  const cells: Cell[] = HOURS.map(() => ({ kind: 'empty' }));
  const blocks = items
    .filter((i) => i.day === day)
    .map((i) => {
      const [s, e] = slotHours(i.timeSlot);
      return {
        item: i,
        from: Math.min(HOURS.length - 1, Math.max(0, Math.floor(s) - HOURS[0])),
        to: Math.min(HOURS.length, Math.max(0, Math.ceil(e) - HOURS[0])),
      };
    })
    .filter((b) => b.from < b.to)
    .sort((a, b) => a.from - b.from || b.to - a.to);

  for (const b of blocks) {
    let from = b.from;
    while (from < HOURS.length && cells[from].kind !== 'empty') from++;
    if (from >= HOURS.length) continue;
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
  const columns = DAYS.map((day) => ({ day, cells: dayCells(items, day) }));

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
            {HOURS.map((h, row) => (
              <tr key={h}>
                <td className="sched-cell border-r bg-page/60 text-center text-[10px] font-semibold tabular-nums text-muted">
                  {String(h).padStart(2, '0')}:00
                </td>
                {columns.map(({ day, cells }) => {
                  const cell = cells[row];
                  if (cell.kind === 'covered') return null;
                  if (cell.kind === 'empty') return <td key={day} className="sched-cell h-9 bg-surface/40" />;
                  const { item, span } = cell;
                  return (
                    <td
                      key={day}
                      rowSpan={span}
                      className={`sched-cell h-9 ${item.isFreeSlot ? 'sched-free' : 'sched-busy'}`}
                    >
                      <div className="flex h-full items-start gap-1.5 px-1 pt-0.5">
                        <span className="leading-none text-accent" aria-hidden>
                          {item.isFreeSlot ? <Icon name="sparkles" size={15} /> : <Icon name={catIcon(item.activity)} size={15} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          {item.isFreeSlot ? (
                            <span className="block truncate text-[10px] tabular-nums text-ok/80">{item.timeSlot}</span>
                          ) : (
                            <>
                              <span className="block truncate text-[11px] font-semibold leading-tight">{item.activity}</span>
                              <span className="block text-[10px] tabular-nums text-muted">{item.timeSlot}</span>
                            </>
                          )}
                        </div>
                        {editable && !item.isFreeSlot && onRemove && (
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
          <span className="h-3 w-3 rounded border border-ok/40 bg-free" /> <Icon name="sparkles" size={13} /> Чөлөөт цаг
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-busy" /> <Icon name="pin" size={13} /> Хичээлээс гадуурх үйл ажиллагаа
        </span>
      </div>
    </div>
  );
}
