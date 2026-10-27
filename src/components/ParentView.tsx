import { useCallback, useEffect, useState } from 'react';
import { attempt, M, Q, type AnalysisDTO, type ScheduleItemDTO, type StudentDTO } from '../api';
import ScheduleGrid from './ScheduleGrid';
import { Icon } from './icons';
import { Card, CoachCard, Donut, Pill, RISK_MN, ScoreBadge, StatusIcon, fmtDate, riskLevel, useToast } from './shared';

export default function ParentView({ student, onStudentsChanged }: { student: StudentDTO; onStudentsChanged: () => void }) {
  const [schedule, setSchedule] = useState<ScheduleItemDTO[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisDTO | null>(null);
  const [verification, setVerification] = useState(student.parentVerification);
  const { toast, toastError, node } = useToast();

  const reload = useCallback(() => {
    Q.schedule(student.id).then((d) => setSchedule(d.schedule));
    Q.analysis(student.id).then((d) => setAnalysis(d.workloadAnalysis));
  }, [student.id]);

  useEffect(() => {
    setVerification(student.parentVerification);
    reload();
  }, [student, reload]);

  async function approve(approved: boolean) {
    const problem = await attempt(() => M.approveSchedule(student.id, approved));
    if (problem) return toastError(problem);
    toast(approved ? 'Хуваарь баталгаажлаа' : 'Баталгаажуулалт цуцлагдлаа');
    onStudentsChanged();
  }

  const progress = analysis?.academicProgress;

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card
        title="1 · Хуваарь баталгаажуулалт"
        subtitle={`${student.name} — долоо хоногийн хуваарийг шалгаад зөвшөөрнө үү`}
        actions={
          verification.isScheduleApproved ? (
            <Pill tone="good"><StatusIcon level="ok" /> Зөвшөөрсөн · {verification.approvedDate ? fmtDate(verification.approvedDate) : ''}</Pill>
          ) : (
            <Pill tone="bad"><StatusIcon level="warn" /> Хүлээгдэж байна</Pill>
          )
        }
      >
        <ScheduleGrid items={schedule} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn-grad inline-flex items-center gap-2"
            disabled={verification.isScheduleApproved}
            onClick={() => approve(true)}
          >
            <Icon name="check" size={16} /> Зөвшөөрөх
          </button>
          <button
            className="btn-danger inline-flex items-center gap-2"
            disabled={!verification.isScheduleApproved}
            onClick={() => approve(false)}
          >
            <Icon name="close" size={16} /> Зөвшөөрөл цуцлах
          </button>
        </div>
      </Card>

      {analysis && progress && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="2 · Бодит цагийн дэвшил" subtitle="Даалгаврын гүйцэтгэл шууд шинэчлэгдэнэ">
            <div className="flex items-center gap-6">
              <Donut pct={progress.completionPercentage} label="Гүйцэтгэл" />
              <div className="grid grid-cols-1 gap-2 text-sm">
                <p className="font-semibold">
                  {progress.completedAssignments}<span className="text-muted">/{progress.totalAssignments} даалгавар дууссан</span>
                </p>
                <p className="flex items-center gap-2 font-semibold">
                  Ойрын шалгалт: {progress.upcomingExamsCount}
                  {progress.upcomingExamsCount > 0 && <Icon name="bell" size={15} className="text-warn" />}
                </p>
                <p className="flex items-center gap-2">
                  Ачаалал: <ScoreBadge score={analysis.workloadAnalysis.workloadScore} />
                </p>
                <Pill tone={analysis.workloadAnalysis.stressRisk === 'High' ? 'bad' : analysis.workloadAnalysis.stressRisk === 'Medium' ? 'info' : 'good'}>
                  Стрессийн эрсдэл: {RISK_MN[analysis.workloadAnalysis.stressRisk] ?? analysis.workloadAnalysis.stressRisk} <StatusIcon level={riskLevel(analysis.workloadAnalysis.stressRisk)} />
                </Pill>
              </div>
            </div>
            {progress.scheduleConflicts.length > 0 && (
              <ul className="mt-4 grid grid-cols-1 gap-2">
                {progress.scheduleConflicts.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                    <StatusIcon level="warn" /> {c.examOrAssignment} — {fmtDate(c.date)}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line/70 pt-3 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Долоо хоногийн ачаалал</dt>
                <dd className="font-bold tabular-nums">{analysis.weeklyScheduleSummary.totalActivityHours} цаг</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Товлогдсон үйл ажиллагаа</dt>
                <dd className="font-bold tabular-nums">{analysis.weeklyScheduleSummary.scheduledItems}</dd>
              </div>
            </dl>
          </Card>

          <Card title="3 · AI долоо хоногийн тойм" subtitle="Эцэг эхэд зориулсан энгийн тайлбар">
            <CoachCard>
              <span className="font-medium">{analysis.parentReport.progressSummaryMongolian}</span>
            </CoachCard>
            <div className="mt-4 rounded-xl bg-page/80 p-3.5 text-xs leading-relaxed text-muted">
              <p className="eyebrow mb-1 text-accent">AI зөвлөмж</p>
              {analysis.workloadAnalysis.aiSummaryMongolian}
            </div>
          </Card>
        </div>
      )}
      {node}
    </div>
  );
}
