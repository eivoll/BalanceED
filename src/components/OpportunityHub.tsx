import { useState } from 'react';
import { M, attempt, type OpportunityDTO } from '../api';
import { Card, DAY_MN, LEVEL_MN, StatusIcon, catIcon, catTag, fmtDate, useToast } from './shared';
import { Icon } from './icons';

/** Match quality is the one number on the card, so it carries the colour, not everything-green. */
function matchTone(score: string): string {
  const n = parseInt(score) || 0;
  return n >= 70
    ? 'bg-ok/15 text-ok'
    : n >= 40
      ? 'bg-warn/15 text-warn'
      : 'bg-muted/15 text-muted';
}

const LEVEL_STYLE: Record<string, string> = {
  School: 'bg-muted/15 text-muted',
  National: 'bg-accent2/15 text-accent2',
  Global: 'bg-accent/15 text-accent',
};

function chip(base: string) {
  return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${base}`;
}

function OpportunityCard({
  opp,
  delay,
  onChanged,
}: {
  opp: OpportunityDTO;
  delay: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { toast, node } = useToast();

  const tag = catTag(`${opp.title} ${opp.requiredSkills.join(' ')} ${opp.organizer}`);
  const full = opp.placesLeft === 0;
  const closed = !!opp.deadline && new Date(`${opp.deadline}T23:59:59`).getTime() < Date.now();

  async function toggle() {
    setBusy(true);
    setError('');
    const problem = await attempt(() =>
      opp.enrolled ? M.unenrollOpportunity(opp.id) : M.enrollOpportunity(opp.id),
    );
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    toast(opp.enrolled ? 'Бүртгэл цуцлагдлаа' : 'Бүртгэл амжилттай боллоо');
    onChanged();
  }

  return (
    <article
      className="animate-rise flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-surface"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden>
          <Icon name={catIcon(`${opp.title} ${opp.requiredSkills.join(' ')}`)} size={18} />
        </span>
        <span className="eyebrow text-muted">{tag || LEVEL_MN[opp.level] || 'Боломж'}</span>
        {opp.matchScore && (
          <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${matchTone(opp.matchScore)}`}>
            <Icon name="target" size={13} /> {opp.matchScore}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <h4 className="text-sm font-bold leading-snug">{opp.title}</h4>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {opp.organizer}
          {opp.location && <> · {opp.location}</>}
        </p>

        {opp.description && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">{opp.description}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={chip(LEVEL_STYLE[opp.level] ?? 'bg-page text-muted')}>{LEVEL_MN[opp.level] ?? opp.level}</span>
          <span className={chip('border border-accent/30 bg-accent/10 text-accent')}>
            <Icon name="calendar" size={12} /> {DAY_MN[opp.day]} {opp.timeSlot}
          </span>
          {opp.deadline && (
            <span className={chip(closed ? 'bg-danger/15 text-danger' : 'bg-page text-muted')}>
              <Icon name="clock" size={12} /> {fmtDate(opp.deadline)} хүртэл
            </span>
          )}
          {opp.placesLeft !== null && (
            <span className={chip(full ? 'bg-warn/15 text-warn' : 'bg-page text-muted')}>
              <Icon name="user" size={12} /> {full ? 'Сул орон дууссан' : `${opp.placesLeft} сул орон`}
            </span>
          )}
          {opp.requiredSkills.slice(0, 2).map((s) => (
            <span key={s} className={chip('bg-page text-muted')}>
              <Icon name="star" size={12} /> {s}
            </span>
          ))}
        </div>

        {opp.matchReasonMongolian && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-page/80 px-3 py-2 text-[11px] leading-relaxed text-muted">
            <Icon name="bulb" size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>{opp.matchReasonMongolian}</span>
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] font-semibold text-danger">
            <StatusIcon level="danger" /> <span>{error}</span>
          </p>
        )}

        <button
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 active:scale-95 disabled:cursor-wait disabled:opacity-70 ${
            opp.enrolled
              ? 'border border-ok/40 bg-ok/10 text-ok hover:border-danger/40 hover:bg-danger/10 hover:text-danger'
              : full
                ? 'border border-warn/40 bg-warn/10 text-warn hover:bg-warn/15'
                : 'border border-line bg-page/60 text-ink hover:border-accent/50 hover:bg-accent/10 hover:text-accent'
          }`}
          onClick={toggle}
          disabled={busy || closed}
          title={closed ? 'Бүртгэлийн хугацаа дууссан' : undefined}
        >
          {busy
            ? 'Бүртгэж байна…'
            : opp.enrolled
              ? (
                  <>
                    <Icon name="check" size={16} /> Бүртгэлтэй · цуцлах
                  </>
                )
              : full
                ? (
                    <>
                      <Icon name="alert" size={16} /> Хүлээлгийн жагсаалт
                    </>
                  )
                : (
                    <>
                      <Icon name="plus" size={16} /> Бүртгүүлэх <Icon name="arrowRight" size={15} />
                    </>
                  )}
        </button>
        {full && !opp.enrolled && !busy && (
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Сул орон дууссан ч бүртгүүлж болно — нэр тань хүлээлгийн жагсаалтад дарааллаар бичигдэнэ.
          </p>
        )}
      </div>
      {node}
    </article>
  );
}

export default function OpportunityHub({
  items,
  onChanged,
}: {
  items: OpportunityDTO[];
  onChanged: () => void;
}) {
  const enrolledCount = items.filter((o) => o.enrolled).length;

  return (
    <Card
      title="Боломжийн сан"
      subtitle="Сонирхол, ур чадвар, чөлөөт цагт тань таарсан боломжуудыг л харуулна"
      actions={
        enrolledCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok">
            <Icon name="check" size={13} /> {enrolledCount} бүртгэл
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o, idx) => (
          <OpportunityCard key={o.id} opp={o} delay={idx * 60} onChanged={onChanged} />
        ))}
        {!items.length && (
          <p className="col-span-full rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Одоогоор чөлөөт цагт тань тохирох боломж олдсонгүй. Танилцуулгаа шинэчилж эсвэл хуваарьтаа чөлөөт цаг нэмж үзээрэй.
          </p>
        )}
      </div>
    </Card>
  );
}
