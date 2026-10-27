import type { AnalysisDTO, StressDriverDTO } from '../api';
import { Icon } from './icons';
import {
  Card,
  CoachCard,
  GaugeDial,
  Pill,
  RISK_MN,
  STATUS_MN,
  StressMeter,
  StatusIcon,
  fmtDate,
  riskLevel,
  scoreLevel,
} from './shared';

/** A single axis of the stress score: what it is, what it cost, and why. */
function DriverRow({ driver }: { driver: StressDriverDTO }) {
  const share = Math.min(100, (driver.impact / 30) * 100);
  const bar =
    driver.tone === 'danger' ? 'bg-danger' : driver.tone === 'warn' ? 'bg-warn' : 'bg-ok';
  return (
    <li className="card p-3.5">
      <div className="flex items-center gap-2">
        <StatusIcon level={driver.tone} />
        <strong className="min-w-0 flex-1 text-sm leading-snug">{driver.labelMongolian}</strong>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">+{driver.impact}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${bar}`} style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{driver.detailMongolian}</p>
    </li>
  );
}

/** One week split three ways: fixed school, chosen activities, genuinely free. */
function HourSplit({ school, activity, free }: { school: number; activity: number; free: number }) {
  const total = Math.max(1, school + activity + free);
  const parts: { label: string; hours: number; cls: string }[] = [
    { label: 'Сургууль', hours: school, cls: 'bg-accent/45' },
    { label: 'Гадуурх ажил', hours: activity, cls: 'bg-accent2/70' },
    { label: 'Чөлөөт', hours: free, cls: 'bg-ok/60' },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line/60">
        {parts.map((p) => (
          <div
            key={p.label}
            className={`${p.cls} transition-all duration-700 ease-out`}
            style={{ width: `${(p.hours / total) * 100}%` }}
            title={`${p.label}: ${p.hours} цаг`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-muted">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${p.cls}`} />
            {p.label} <span className="tabular-nums text-ink">{p.hours}</span> цаг
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisPanel({ analysis }: { analysis: AnalysisDTO }) {
  const wl = analysis.workloadAnalysis;
  const sum = analysis.weeklyScheduleSummary;
  const level = scoreLevel(wl.workloadScore);
  const drivers = wl.stressDrivers;
  const busy = drivers.filter((d) => d.impact > 0);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <div className="grid grid-cols-1 content-start gap-5">
        <Card title="Ачааллын үнэлгээ" subtitle="Ачаалал нь долоо хоног хэр дүүрэн байгааг, стресс нь тэр ачаалал хэр хүнд тусахыг харуулна">
          <div className="flex flex-wrap items-center gap-6">
            <GaugeDial score={wl.workloadScore} />
            <StressMeter score={wl.stressScore} risk={wl.stressRisk} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone={level === 'ok' ? 'good' : level === 'warn' ? 'info' : 'bad'}>
              <StatusIcon level={level} /> {STATUS_MN[wl.status] ?? wl.status}
            </Pill>
            <Pill tone={wl.stressRisk === 'High' ? 'bad' : wl.stressRisk === 'Medium' ? 'info' : 'good'}>
              Стрессийн эрсдэл: {RISK_MN[wl.stressRisk] ?? wl.stressRisk} <StatusIcon level={riskLevel(wl.stressRisk)} />
            </Pill>
            <Pill>
              <Icon name="clipboard" size={14} /> {sum.scheduledItems} үйл ажиллагаа
            </Pill>
            {analysis.academicProgress.overdueAssignments > 0 && (
              <Pill tone="bad">
                <StatusIcon level="danger" /> {analysis.academicProgress.overdueAssignments} даалгавар хоцорсон
              </Pill>
            )}
          </div>
          <div className="mt-5">
            <p className="eyebrow mb-2 text-muted">Долоо хоногийн цаг</p>
            <HourSplit school={sum.schoolHours} activity={sum.totalActivityHours} free={sum.freeHours} />
          </div>
          <div className="mt-5">
            <CoachCard>
              <span className="font-medium">{wl.aiSummaryMongolian}</span>
            </CoachCard>
          </div>
        </Card>

        <Card
          title="Стрессийн шалтгаан"
          subtitle="Оноо тус бүр долоо хоногийн хуваариас шууд гарна — зөвхөн нийлбэр биш"
        >
          <ul className="grid grid-cols-1 gap-2.5">
            {busy.map((d) => (
              <DriverRow key={d.labelMongolian} driver={d} />
            ))}
          </ul>
          {!busy.length && (
            <p className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm font-semibold text-ok">
              <StatusIcon level="ok" /> Стрессийг нэмэгдүүлэх нөхцөл илэрч байхгүй — ачаалал, амралт тэнцүү байна.
            </p>
          )}
        </Card>
      </div>

      <Card title="Давхцал & зөвлөмж" subtitle="Шалгалт, даалгавар их ачаалалтай өдөртэй давхцаж байвал анхааруулна">
        <ul className="grid grid-cols-1 gap-2.5">
          {analysis.academicProgress.scheduleConflicts.map((c, i) => (
            <li
              key={i}
              className="animate-rise rounded-xl border border-danger/30 bg-danger/5 p-3.5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-2">
                <StatusIcon level="warn" />
                <strong className="min-w-0 flex-1 truncate text-sm">{c.examOrAssignment}</strong>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">{fmtDate(c.date)}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.conflictDescriptionMongolian}</p>
            </li>
          ))}
          {!analysis.academicProgress.scheduleConflicts.length && (
            <li className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm font-semibold text-ok">
              <StatusIcon level="ok" /> Хуваарьт давхцал илэрсэнгүй — тэнцвэр сайн байна.
            </li>
          )}
        </ul>

        <div className="mt-5 grid grid-cols-1 gap-3">
          <CoachCard title="Хугацааг зохицуулах зөвлөгөө">
            <span className="font-medium">{analysis.teacherRecommendations.deadlineAdjustments}</span>
          </CoachCard>
          <CoachCard title="Шалгалтад бэлтгэх">
            <span className="font-medium">{analysis.teacherRecommendations.examPrepAdvice}</span>
          </CoachCard>
          <CoachCard title="Эцэг эхэд илгээх тойм">
            <span className="font-medium">{analysis.parentReport.progressSummaryMongolian}</span>
          </CoachCard>
        </div>
      </Card>
    </div>
  );
}
