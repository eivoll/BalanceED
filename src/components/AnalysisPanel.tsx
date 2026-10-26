import type { AnalysisDTO } from '../api';
import { Icon } from './icons';
import { Card, CoachCard, GaugeDial, Pill, RISK_MN, STATUS_MN, StatusIcon, fmtDate, riskLevel, scoreLevel, useToast } from './shared';

export default function AnalysisPanel({ analysis }: { analysis: AnalysisDTO }) {
  const { toast, node } = useToast();
  const wl = analysis.workloadAnalysis;
  const level = scoreLevel(wl.workloadScore);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="Ачааллын үнэлгээ" subtitle="AI-ийн долоо хоногийн үнэлгээ">
        <div className="flex flex-wrap items-center gap-6">
          <GaugeDial score={wl.workloadScore} />
          <div className="grid grid-cols-1 gap-2">
            <Pill tone={level === 'ok' ? 'good' : level === 'warn' ? 'info' : 'bad'}>
              <StatusIcon level={level} /> {STATUS_MN[wl.status] ?? wl.status}
            </Pill>
            <Pill tone={wl.stressRisk === 'High' ? 'bad' : wl.stressRisk === 'Medium' ? 'info' : 'good'}>
              Стрессийн эрсдэл: {RISK_MN[wl.stressRisk] ?? wl.stressRisk} <StatusIcon level={riskLevel(wl.stressRisk)} />
            </Pill>
            <Pill>
              <Icon name="clock" size={14} /> Нийт {analysis.weeklyScheduleSummary.totalActivityHours} цаг · {analysis.weeklyScheduleSummary.scheduledItems} үйл ажиллагаа
            </Pill>
          </div>
        </div>
        <div className="mt-5">
          <CoachCard>
            <span className="font-medium">{wl.aiSummaryMongolian}</span>
          </CoachCard>
        </div>
      </Card>

      <Card title="Давхцал & зөвлөмж" subtitle="Шалгалт / даалгавар хүнд өдөртэй давхцаж байвал AI анхааруулна">
        <ul className="grid grid-cols-1 gap-2.5">
          {analysis.academicProgress.scheduleConflicts.map((c, i) => (
            <li
              key={i}
              className="animate-rise rounded-xl border border-danger/30 bg-danger/5 p-3.5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-2">
                <StatusIcon level="warn" />
                <strong className="text-sm">{c.examOrAssignment}</strong>
                <span className="ml-auto text-xs font-semibold tabular-nums text-muted">{fmtDate(c.date)}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.conflictDescriptionMongolian}</p>
              <button
                className="btn-soft mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                onClick={() => toast('Хүсэлт багшид илгээгдлээ')}
              >
                <Icon name="send" size={14} /> Багшид хүсэлт илгээх
              </button>
            </li>
          ))}
          {!analysis.academicProgress.scheduleConflicts.length && (
            <li className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm font-semibold text-ok">
              <StatusIcon level="ok" /> Хуваарьт давхцал илэрсэнгүй — тэнцвэр сайн байна!
            </li>
          )}
        </ul>

        <div className="mt-5">
          <CoachCard title="Эцэг эхэд илгээх тойм">
            <span className="font-medium">{analysis.parentReport.progressSummaryMongolian}</span>
          </CoachCard>
        </div>
      </Card>
      {node}
    </div>
  );
}
