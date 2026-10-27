import { useCallback, useEffect, useState } from 'react';
import { attempt, M, Q, type AnalysisDTO, type AssignmentDTO, type ExamDTO, type OpportunityDTO, type ScheduleItemDTO, type SchoolHourInput, type StudentDTO } from '../api';
import AboutMeEditor, { AddScheduleForm } from './AboutMeEditor';
import AnalysisPanel from './AnalysisPanel';
import AssignmentsPanel from './AssignmentsPanel';
import OpportunityHub from './OpportunityHub';
import ScheduleGrid from './ScheduleGrid';
import { SchoolHoursCard } from './SchoolHoursEditor';
import { Card, Donut, GaugeDial, StatusIcon, StressMeter, fmtDate, formatJoinCode, useToast } from './shared';
import { Icon, type IconName } from './icons';

type Tab = 'schedule' | 'academics' | 'opportunities' | 'analysis' | 'aboutme';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'schedule', label: 'Хуваарь', icon: 'calendar' },
  { id: 'academics', label: 'Даалгавар & шалгалт', icon: 'book' },
  { id: 'opportunities', label: 'Боломжууд', icon: 'target' },
  { id: 'analysis', label: 'AI шинжилгээ', icon: 'bulb' },
  { id: 'aboutme', label: 'Танилцуулга', icon: 'user' },
];

export default function StudentView({
  student,
  onStudentsChanged,
}: {
  student: StudentDTO;
  onStudentsChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>('schedule');
  const [schedule, setSchedule] = useState<ScheduleItemDTO[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDTO[]>([]);
  const [exams, setExams] = useState<ExamDTO[]>([]);
  const [matched, setMatched] = useState<OpportunityDTO[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisDTO | null>(null);
  const [schoolHours, setSchoolHours] = useState<SchoolHourInput[] | null>(null);
  const [verified, setVerified] = useState(student.parentVerification);
  const { toast, toastError, node: toastNode } = useToast();

  const reload = useCallback(() => {
    Q.schedule(student.id).then((d) => setSchedule(d.schedule));
    Q.assignments(student.id).then((d) => setAssignments(d.assignments));
    Q.exams(student.id).then((d) => setExams(d.exams));
    Q.matched(student.id).then((d) => setMatched(d.matchedOpportunities));
    Q.analysis(student.id).then((d) => setAnalysis(d.workloadAnalysis));
    Q.schoolHours(student.id).then((d) => setSchoolHours(d.schoolHours));
  }, [student.id]);

  useEffect(() => {
    setVerified(student.parentVerification);
    reload();
  }, [student, reload]);

  async function removeItem(id: string) {
    const problem = await attempt(() => M.removeScheduleItem(id));
    if (problem) return toastError(problem);
    setVerified({ isScheduleApproved: false });
    reload();
    onStudentsChanged();
  }

  const pct = assignments.length
    ? Math.round((assignments.filter((a) => a.isCompleted).length / assignments.length) * 100)
    : 0;

  async function copyCode() {
    if (!student.joinCode) return;
    try {
      await navigator.clipboard.writeText(formatJoinCode(student.joinCode));
      toast('Холбох код хуулагдлаа');
    } catch {
      toastError('Хуулж чадсангүй — кодыг дэлгэцээс бичиж авна уу');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Hero */}
      <section className="glass p-5">
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight">Сайн уу, {student.name.split(' ')[0]}</h2>
              {verified.isScheduleApproved ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok">
                  <StatusIcon level="ok" /> Эцэг эх зөвшөөрсөн · {verified.approvedDate ? fmtDate(verified.approvedDate) : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-bold text-warn">
                  <StatusIcon level="warn" />
                  {student.hasParent
                    ? 'Эцэг эхийн баталгаажуулалт хүлээгдэж байна'
                    : 'Эцэг эх холбоогүй — хуваарь баталгаажуулаагүй'}
                </span>
              )}
              {student.joinCode && (!student.hasParent || !student.hasTeacher) && (
                <button
                  type="button"
                  onClick={copyCode}
                  title="Багш эсвэл эцэг эх энэ кодоор тантай холбогдоно. Дарвал хуулна."
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-muted transition-colors duration-150 hover:text-ink"
                >
                  <Icon name="clipboard" size={13} /> Холбох код: {formatJoinCode(student.joinCode)}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-muted">
              {[String(student.grade), student.school, student.aboutMe.interests.slice(0, 3).join(', ')]
                .filter((part) => part.trim() !== '')
                .join(' · ')}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3.5">
              <Donut pct={pct} size={84} />
              <div className="whitespace-nowrap text-xs font-semibold leading-tight text-muted">
                <p className="text-ink">{assignments.filter((a) => a.isCompleted).length}/{assignments.length} даалгавар</p>
                <p>гүйцэтгэсэн</p>
              </div>
            </div>
            {analysis && (
              <div className="hidden scale-90 sm:block">
                <GaugeDial score={analysis.workloadAnalysis.workloadScore} />
              </div>
            )}
            {analysis && (
              <div className="hidden lg:block">
                <StressMeter
                  score={analysis.workloadAnalysis.stressScore}
                  risk={analysis.workloadAnalysis.stressRisk}
                  width={150}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-2" aria-label="Сурагчийн цэс">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              tab === t.id
                ? 'bg-accent text-onaccent shadow-md'
                : 'border border-line bg-surface/70 text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink hover:shadow-sm'
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </nav>

      <div key={tab} className="animate-rise grid grid-cols-1 gap-5">
        {tab === 'schedule' && (
          <>
            <Card title="Долоо хоногийн хуваарь" subtitle="Бүртгэгдээгүй үлдсэн цагууд автоматаар чөлөөт цаг болж тэмдэглэгдэнэ">
              <ScheduleGrid items={schedule} editable onRemove={removeItem} />
            </Card>
            {schoolHours && (
              <SchoolHoursCard
                key={JSON.stringify(schoolHours)}
                studentId={student.id}
                initial={schoolHours}
                onSaved={() => { reload(); onStudentsChanged(); }}
              />
            )}
            <AddScheduleForm studentId={student.id} onAdded={() => { reload(); onStudentsChanged(); }} />
          </>
        )}

        {tab === 'academics' && (
          <AssignmentsPanel assignments={assignments} exams={exams} onChanged={reload} />
        )}

        {tab === 'opportunities' && <OpportunityHub items={matched} onChanged={reload} />}

        {tab === 'analysis' && analysis && <AnalysisPanel analysis={analysis} />}

        {tab === 'aboutme' && <AboutMeEditor student={student} onSaved={() => { reload(); onStudentsChanged(); }} />}
      </div>
      {toastNode}
    </div>
  );
}
