import { useEffect, useRef, useState } from 'react';
import { attempt, M, type AssignmentDTO, type ExamDTO } from '../api';
import { Card, Donut, fmtDate, useCountUp, useToast } from './shared';
import { Icon } from './icons';

export default function AssignmentsPanel({
  assignments,
  exams,
  readOnly,
  onChanged,
}: {
  assignments: AssignmentDTO[];
  exams: ExamDTO[];
  readOnly?: boolean;
  onChanged: () => void;
}) {
  const done = assignments.filter((a) => a.isCompleted).length;
  const pct = assignments.length ? Math.round((done / assignments.length) * 100) : 0;
  const shown = useCountUp(pct);
  const today = new Date().toISOString().slice(0, 10);
  const { toastError, node } = useToast();

  // Celebrate the crossing, not the state: reloading or changing tabs at 100%
  // must not replay the burst.
  const [celebrate, setCelebrate] = useState(false);
  const lastPct = useRef(pct);
  useEffect(() => {
    const rose = lastPct.current < 100 && pct === 100;
    lastPct.current = pct;
    if (!rose) return;
    setCelebrate(true);
    const timer = setTimeout(() => setCelebrate(false), 1800);
    return () => clearTimeout(timer);
  }, [pct]);

  async function toggle(a: AssignmentDTO) {
    const problem = await attempt(() => M.toggleAssignment(a.id, !a.isCompleted));
    if (problem) return toastError(problem);
    onChanged();
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
      <Card className="relative overflow-hidden lg:col-span-2" title="Хичээлийн дэвшил" subtitle="Гүйцэтгэсэн даалгавраас автоматаар тооцоолно">
        <div className="flex items-center gap-5">
          <Donut pct={pct} label="Гүйцэтгэл" celebrate={celebrate} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {done}<span className="text-muted">/{assignments.length} даалгавар</span>
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line/70">
              <div className="h-full rounded-full bg-ok transition-colors duration-500" style={{ width: `${shown}%` }} />
            </div>
            {pct === 100 && assignments.length > 0 ? (
              <p
                className="animate-pop mt-3 inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-xs font-bold text-ok"
                style={celebrate ? { animationDelay: '0.9s' } : undefined}
              >
                <Icon name="sparkles" size={15} /> Бүгд дууссан — амрах цаг!
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Даалгавар дээр дараад гүйцэтгэсэн гэж тэмдэглэ — хувь нь шууд шинэчлэгдэнэ.
              </p>
            )}
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-2">
          {assignments.map((a) => {
            const overdue = !a.isCompleted && a.dueDate < today;
            return (
              <li key={a.id}>
                <label
                  className={`check-row group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${
                    a.isCompleted ? 'check-row-on border-ok/30 bg-ok/5' : overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-surface'
                  } ${readOnly ? 'cursor-default' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={a.isCompleted}
                    disabled={readOnly}
                    onChange={() => toggle(a)}
                    aria-label={`${a.title} — ${a.isCompleted ? 'гүйцэтгэсэн' : 'гүйцэтгээгүй'}`}
                  />
                  <span className="check-box" aria-hidden>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5.2 4.2 8.4 11 1.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="check-mark" />
                    </svg>
                  </span>
                  {/* The ticked box plus struck text already say "done", and an overdue
                      row carries its own triangle by the date — a leading status icon
                      here only ever duplicates one of the two. */}
                  <span className={`min-w-0 flex-1 truncate text-sm font-semibold transition-all duration-300 ${a.isCompleted ? 'done-slide translate-x-1' : ''}`}>
                    {a.title}
                  </span>
                  <span className="hidden rounded-full bg-page px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted sm:inline">
                    {a.subject}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${overdue ? 'text-danger' : 'text-muted'}`}>
                    {overdue && <Icon name="alert" size={13} className="mr-1 inline text-danger" title="Хугацаа хэтэрсэн" />}{fmtDate(a.dueDate)}
                  </span>
                </label>
              </li>
            );
          })}
          {!assignments.length && <li className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Даалгавар алга.</li>}
        </ul>
      </Card>

      <Card className="lg:col-span-3" title="Шалгалтын хуваарь" subtitle="Багшийн товлосон шалгалтууд">
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {exams.map((e) => (
            <li key={e.id} className="card flex items-center gap-3 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn/15 text-warn shadow-sm">
                <Icon name="clipboard" size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{e.subject}</p>
                <p className="text-xs font-medium tabular-nums text-muted">{fmtDate(e.examDate)} · {e.time}</p>
              </div>
            </li>
          ))}
          {!exams.length && <li className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Шалгалт төлөвлөгдөөгүй.</li>}
        </ul>
      </Card>
      {node}
    </div>
  );
}
