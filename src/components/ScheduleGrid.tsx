import { DAYS } from '../../shared/types';
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

export default function ScheduleGrid({
  items,
  editable,
  onRemove,
}: {
  items: ScheduleItemDTO[];
  editable?: boolean;
  onRemove?: (id: string) => void;
}) {
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
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">{d.slice(0, 3)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td className="sched-cell border-r bg-page/60 text-center text-[10px] font-semibold tabular-nums text-muted">
                  {String(h).padStart(2, '0')}:00
                </td>
                {DAYS.map((day) => {
                  const cell = items.find((i) => {
                    if (i.day !== day) return false;
                    const [s, e] = slotHours(i.timeSlot);
                    return s <= h && e > h;
                  });
                  if (!cell) return <td key={day} className="sched-cell h-9 bg-surface/40" />;
                  const [s] = slotHours(cell.timeSlot);
                  const isStart = Math.floor(s) === h;
                  return (
                    <td
                      key={day}
                      className={`sched-cell h-9 ${cell.isFreeSlot ? 'sched-free' : 'sched-busy'} ${!isStart ? 'border-t-0' : ''}`}
                    >
                      {isStart && (
                        <div className="flex h-full items-start gap-1.5 px-1 pt-0.5">
                          <span className="leading-none text-accent" aria-hidden>
                            {cell.isFreeSlot ? <Icon name="sparkles" size={15} /> : <Icon name={catIcon(cell.activity)} size={15} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            {cell.isFreeSlot ? (
                              <span className="block truncate text-[10px] tabular-nums text-ok/80">{cell.timeSlot}</span>
                            ) : (
                              <>
                                <span className="block truncate text-[11px] font-semibold leading-tight">{cell.activity}</span>
                                <span className="block text-[10px] tabular-nums text-muted">{cell.timeSlot}</span>
                              </>
                            )}
                          </div>
                          {editable && !cell.isFreeSlot && onRemove && (
                            <button
                              className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-sm font-bold text-danger/70 transition-all duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
                              title="Устгах"
                              aria-label={`${cell.activity} устгах`}
                              onClick={() => onRemove(cell.id)}
                            >
                              <Icon name="close" size={13} />
                            </button>
                          )}
                        </div>
                      )}
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
          <span className="h-3 w-3 rounded border border-ok/40 bg-free" /> <Icon name="sparkles" size={13} /> Чөлөөт цаг (Free Slot)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-busy" /> <Icon name="pin" size={13} /> Хичээлээс гадуурх үйл ажиллагаа
        </span>
      </div>
    </div>
  );
}
