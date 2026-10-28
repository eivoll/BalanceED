import { useCallback, useEffect, useState } from 'react';
import { DAYS } from '../../shared/types';
import { attempt, M, Q, type AnalysisDTO, type ClassRowDTO, type OpportunityDTO, type ScheduleItemDTO, type StudentDTO } from '../api';
import { navigate, type Page } from '../router';
import RosterPanel from './RosterPanel';
import { Icon } from './icons';
import ScheduleGrid from './ScheduleGrid';
import { DateField, TimeField, TimeRangeFields } from './DateTimeField';
import { Card, CoachCard, DAY_MN, LEVEL_MN, PageNav, Pill, RISK_MN, STATUS_MN, StatusIcon, fmtDate, riskLevel, scoreLevel, todayIso, useToast } from './shared';

const LEVELS = ['School', 'National', 'Global'];

const TEACHER_TABS: { id: Page; label: string; icon: 'school' | 'send' }[] = [
  { id: 'teacher', label: 'Ангид хяналт', icon: 'school' },
  { id: 'publish', label: 'Нийтлэх', icon: 'send' },
];

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const level = scoreLevel(score);
  const color = level === 'ok' ? 'bg-ok' : level === 'warn' ? 'bg-warn' : 'bg-danger';
  return (
    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line/70" aria-hidden>
      <span className={`block h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, (score / max) * 100)}%` }} />
    </span>
  );
}

export default function TeacherView({
  students,
  page,
  initialStudentId,
  onChanged,
}: {
  students: StudentDTO[];
  page: Page;
  initialStudentId: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<ClassRowDTO[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [analysis, setAnalysis] = useState<AnalysisDTO | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItemDTO[]>([]);
  const [opps, setOpps] = useState<OpportunityDTO[]>([]);
  const { toast, toastError, node: toastNode } = useToast();

  async function removeOpp(id: string) {
    const problem = await attempt(() => M.deleteOpportunity(id));
    if (problem) return toastError(problem);
    toast('Боломж устгагдлаа');
    reload();
  }

  const reload = useCallback(() => {
    Q.classWorkload().then((d) => setRows(d.classWorkload)).catch(() => setRows([]));
    Q.opportunities().then((d) => setOpps(d.opportunities)).catch(() => setOpps([]));
    if (!studentId) {
      setAnalysis(null);
      setSchedule([]);
      return;
    }
    Q.analysis(studentId).then((d) => setAnalysis(d.workloadAnalysis)).catch(() => setAnalysis(null));
    Q.schedule(studentId).then((d) => setSchedule(d.schedule)).catch(() => setSchedule([]));
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (studentId && !students.some((s) => s.id === studentId)) setStudentId(students[0]?.id || '');
  }, [students, studentId]);

  const overview = (
    <>
      <RosterPanel students={students} onChanged={onChanged} />

      {students.length === 0 && (
        <div className="glass p-8 text-center text-sm text-muted">
          Ангидаа сурагч нэмэгдмэгц ачааллын индекс, AI зөвлөмж энд харагдана.
        </div>
      )}

      {students.length > 0 && (
        <>
          <Card
            title="Ачааллын индекс — анги"
            subtitle="Ачаалал (1–10) ба стресс (0–100) · мөр дээр дарж сурагч сонгоно"
          >
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {rows.map((r, i) => (
                <button
                  key={r.studentId}
                  onClick={() => setStudentId(r.studentId)}
                  className={`lift animate-rise flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                    r.studentId === studentId
                      ? 'border-accent/60 bg-accent/5 ring-4 ring-accent/10'
                      : 'border-line bg-surface'
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-page text-sm font-extrabold text-accent">
                    {r.studentName.split(' ')[0]?.[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="block truncate text-sm font-bold">{r.studentName}</span>
                      <span className="shrink-0 text-sm font-extrabold tabular-nums">{r.workloadScore.toFixed(1)}<span className="text-[11px] font-medium text-muted">/10</span></span>
                    </span>
                    <ScoreBar score={r.workloadScore} />
                    <span className="mt-2.5 flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Стресс</span>
                      <span className="shrink-0 text-xs font-extrabold tabular-nums">{r.stressScore}<span className="text-[11px] font-medium text-muted">/100</span></span>
                    </span>
                    <ScoreBar score={r.stressScore} max={100} />
                    <span className="mt-1.5 block truncate text-[11px] font-medium text-muted">
                      {r.grade} · {STATUS_MN[r.status] ?? r.status} · <StatusIcon level={riskLevel(r.stressRisk)} /> {RISK_MN[r.stressRisk] ?? r.stressRisk} эрсдэл
                      {r.topDriver && <> · голлох шалтгаан: {r.topDriver}</>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {analysis && (
            <div className="grid grid-cols-1 gap-5">
              <Card title={`AI зөвлөмж — ${analysis.studentName}`} subtitle="Давхцлыг арилгах, хугацаа сунгахад туслах саналууд">
                <CoachCard>
                  <p className="inline-flex items-center gap-2 font-semibold"><Icon name="alert" size={15} /> Хугацаа сунгах санал:</p>
                  <p className="mt-1">{analysis.teacherRecommendations.deadlineAdjustments}</p>
                  <p className="mt-3 inline-flex items-center gap-2 font-semibold"><Icon name="book" size={15} /> Шалгалтын бэлтгэл:</p>
                  <p className="mt-1">{analysis.teacherRecommendations.examPrepAdvice}</p>
                </CoachCard>
                {analysis.academicProgress.scheduleConflicts.length > 0 && (
                  <ul className="mt-4 grid grid-cols-1 gap-2">
                    {analysis.academicProgress.scheduleConflicts.map((c, i) => (
                      <li key={i} className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
                        <span className="font-bold"><StatusIcon level="warn" /> {c.examOrAssignment}</span>
                        <span className="ml-2 tabular-nums text-muted">{fmtDate(c.date)}</span>
                        <p className="mt-1 leading-relaxed text-muted">{c.conflictDescriptionMongolian}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Сурагчийн хуваарь" subtitle="Зөвхөн давхцал шалгах зорилгоор харуулсан">
                <ScheduleGrid items={schedule} />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );

  const publishing = (
    <>
      {students.length === 0 ? (
        <div className="glass p-8 text-center text-sm text-muted">
          <p>
            Эхлээд «Ангид хяналт» хуудаснаа сурагч нэмнэ үү — даалгавар, шалгалт тухайн сурагчийн
            хуваарьт очно.
          </p>
          <div className="mt-5">
            <button type="button" className="btn-grad" onClick={() => navigate('teacher')}>
              <Icon name="school" size={16} /> Ангид хяналт
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <PostWorkForm studentId={studentId} students={students} onPosted={reload} />
          <PostOpportunityForm onPosted={reload} />
        </div>
      )}

      <Card title="Боломжуудын жагсаалт" subtitle="Нийтлэгдсэн боломж, сурагчдын бүртгэл">
        {!opps.length && (
          <p className="rounded-xl border border-line bg-page/60 p-4 text-sm text-muted">
            Одоогоор нийтлэгдсэн боломж байхгүй — «Боломж нэмэх» маягтаар эхний боломжоо нэмнэ үү.
          </p>
        )}
        <ul className="grid grid-cols-1 gap-2">
          {opps.map((o) => (
            <li key={o.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
              <Pill tone={o.level === 'Global' ? 'good' : o.level === 'National' ? 'info' : 'neutral'}>{LEVEL_MN[o.level] ?? o.level}</Pill>
              <span className="min-w-0">
                <strong className="block truncate text-sm">{o.title}</strong>
                <span className="block truncate text-[11px] font-medium text-muted">
                  {o.organizer}
                  {o.location && <> · {o.location}</>}
                  {o.requiredSkills.length && <> · {o.requiredSkills.join(', ')}</>}
                </span>
                {!!o.signupNames?.length && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Бүртгэлтэй:</span>
                    {o.signupNames.map((n, i) => (
                      <span key={`${n}-${i}`} className="rounded-full border border-line bg-page/70 px-2 py-0.5 text-[10px] font-semibold">
                        {n}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-3 text-xs font-medium text-muted">
                <span className="tabular-nums">{DAY_MN[o.day]} {o.timeSlot}</span>
                <span className="tabular-nums">
                  <Icon name="user" size={13} /> {o.signups}
                  {o.placesLeft !== null && <> / {o.capacity}</>}
                </span>
                {o.deadline && <span className="tabular-nums">Хугацаа: {fmtDate(o.deadline)}</span>}
                <button
                  type="button"
                  className="icon-toggle border border-line"
                  title="Боломжийг устгах"
                  aria-label={`${o.title} устгах`}
                  onClick={() => removeOpp(o.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {toastNode}
      </Card>
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageNav label="Багшийн цэс" page={page} items={TEACHER_TABS} />
      {page === 'publish' ? publishing : overview}
    </div>
  );
}

function PostWorkForm({ studentId, students, onPosted }: { studentId: string; students: StudentDTO[]; onPosted: () => void }) {
  const [mode, setMode] = useState<'assignment' | 'exam'>('assignment');
  const [sid, setSid] = useState(studentId);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const { toast, toastError, node } = useToast();

  useEffect(() => setSid(studentId), [studentId]);

  async function post() {
    // The title field only exists in assignment mode, so exams must not be gated on it.
    if (!subject.trim() || !date || (mode === 'assignment' && !title.trim())) return toastError('Бүх талбарыг бөглөнө үү.');
    const problem = await attempt(() =>
      mode === 'assignment' ? M.createAssignment(sid, title.trim(), subject.trim(), date) : M.createExam(sid, subject.trim(), date, time),
    );
    if (problem) return toastError(problem);
    setTitle(''); setSubject(''); setDate('');
    toast(mode === 'assignment' ? 'Даалгавар нийтлэгдлээ' : 'Шалгалт товлогдлоо');
    onPosted();
  }

  return (
    <Card title="Даалгавар / шалгалт нийтлэх" subtitle="Сурагчийн хуваарь шууд шинэчлэгдэнэ">
      <div className="seg mb-4 max-w-xs" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <span className="seg-indicator" style={{ width: 'calc((100% - 0.5rem)/2)', transform: `translateX(${mode === 'assignment' ? 0 : 100}%)` }} aria-hidden />
        <button className={`seg-btn ${mode === 'assignment' ? 'active' : ''}`} onClick={() => setMode('assignment')}>Даалгавар</button>
        <button className={`seg-btn ${mode === 'exam' ? 'active' : ''}`} onClick={() => setMode('exam')}>Шалгалт</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Сурагч</span>
          <select className="field" value={sid} onChange={(e) => setSid(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {mode === 'assignment' && (
          <div>
            <span className="label">Гарчиг</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Математикийн бодлого 8" />
          </div>
        )}
        <div>
          <span className="label">Хичээл</span>
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Математик" />
        </div>
        <DateField label={mode === 'assignment' ? 'Хугацаа' : 'Шалгалтын огноо'} value={date} min={todayIso()} onChange={setDate} />
        {mode === 'exam' && <TimeField label="Цаг" value={time} from={7} to={19} minuteStep={5} onChange={setTime} />}
      </div>
      <div className="mt-4">
        <button className="btn-grad" onClick={post}><Icon name="send" size={15} /> Сурагчийн хуваарьт нийтлэх</button>
      </div>
      {node}
    </Card>
  );
}

function PostOpportunityForm({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [skills, setSkills] = useState('');
  const [day, setDay] = useState('Saturday');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [level, setLevel] = useState('School');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [capacity, setCapacity] = useState('');
  const { toast, toastError, node } = useToast();

  async function post() {
    if (!title.trim() || !organizer.trim()) return toastError('Гарчиг, зохион байгуулагчийг бөглөнө үү.');
    if (start >= end) return toastError('Эхлэх цаг дуусах цагаас өмнө байх ёстой.');
    const problem = await attempt(() =>
      M.createOpportunity({
        title: title.trim(),
        organizer: organizer.trim(),
        requiredSkills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        day,
        timeSlot: `${start}-${end}`,
        level,
        description: description.trim(),
        location: location.trim(),
        deadline: deadline.trim(),
        capacity: capacity.trim() ? Math.max(0, Math.round(Number(capacity))) : 0,
      }),
    );
    if (problem) return toastError(problem);
    setTitle(''); setOrganizer(''); setSkills(''); setDescription(''); setLocation(''); setDeadline(''); setCapacity('');
    toast('Боломж нийтлэгдлээ');
    onPosted();
  }

  return (
    <Card title="Боломж нэмэх" subtitle="Ур чадвар · цаг · хамрах хүрээг тодорхойлно">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Гарчиг</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Зуны кодчилолын сургалт — удирдагч" />
        </div>
        <div>
          <span className="label">Зохион байгуулагч</span>
          <input className="field" value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="Төсөл, клуб, сургууль" />
        </div>
        <div className="sm:col-span-2">
          <span className="label">Товч танилцуулга</span>
          <textarea
            className="field min-h-[4.5rem] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Хэн оролцох боломжтой, юу хийх вэ."
            maxLength={600}
          />
        </div>
        <div className="sm:col-span-2">
          <span className="label">Шаардлагатай ур чадвар</span>
          <input className="field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, илтгэл тавих" />
        </div>
        <div>
          <span className="label">Газар</span>
          <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Сургуулийн 203 тоот" />
        </div>
        <div>
          <span className="label">Хамрах хүрээ</span>
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_MN[l] ?? l}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Өдөр</span>
          <select className="field" value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => <option key={d} value={d}>{DAY_MN[d]}</option>)}
          </select>
        </div>
        <TimeRangeFields start={start} end={end} onChange={(next) => { setStart(next.start); setEnd(next.end); }} />
        <div>
          <DateField label="Бүртгэлийн сүүлийн огноо" value={deadline} min={todayIso()} onChange={setDeadline} />
        </div>
        <div>
          <span className="label">Сул орон</span>
          <input
            className="field"
            type="number"
            min={0}
            max={999}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="0 = хязгааргүй"
          />
        </div>
      </div>
      <div className="mt-4">
        <button className="btn-grad" onClick={post}><Icon name="plus" size={16} /> Нийтлэх</button>
      </div>
      {node}
    </Card>
  );
}
