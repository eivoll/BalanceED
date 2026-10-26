import { useState } from 'react';
import type { OpportunityDTO } from '../api';
import { Card, DAY_MN, LEVEL_MN, useToast } from './shared';
import { Icon, type IconName } from './icons';

function category(opp: OpportunityDTO): { icon: IconName; tag: string } {
  const text = `${opp.title} ${opp.requiredSkills.join(' ')} ${opp.organizer}`.toLowerCase();
  if (/design|art|draw|paint|mural|ux|figma/.test(text)) return { icon: 'palette', tag: '#Design' };
  if (/code|python|robot|stem|computer|app/.test(text)) return { icon: 'code', tag: '#Coding' };
  if (/debate|speech|english|law|policy/.test(text)) return { icon: 'speech', tag: '#Debate' };
  if (/music|piano|choir|concert/.test(text)) return { icon: 'music', tag: '#Music' };
  if (/climate|tree|environment|volunteer|charity|community|reading/.test(text)) return { icon: 'sprout', tag: '#Volunteering' };
  return { icon: 'star', tag: '#Club' };
}

const LEVEL_STYLE: Record<string, string> = {
  School: 'bg-muted/15 text-muted',
  National: 'bg-accent2/15 text-accent2',
  Global: 'bg-accent/15 text-accent',
};

export default function OpportunityHub({ items }: { items: OpportunityDTO[] }) {
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const { toast, node } = useToast();

  return (
    <Card title="Боломжийн сан" subtitle="AI сонирхол, ур чадвар, чөлөөт цагт тань таарсан боломжуудыг л харуулна">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o, idx) => {
          const cat = category(o);
          const isJoined = joined[o.id];
          return (
            <article
              key={o.id}
              className="animate-rise group overflow-hidden rounded-2xl border border-line/80 bg-surface"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden>
                  <Icon name={cat.icon} size={18} />
                </span>
                <span className="eyebrow text-muted">{cat.tag}</span>
              </div>

              <div className="px-4 pb-4 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold leading-snug">{o.title}</h4>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok/15 px-2.5 py-1 text-[11px] font-extrabold text-ok shadow-sm">
                    <Icon name="target" size={13} /> {o.matchScore} нийц
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-muted">{o.organizer}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_STYLE[o.level] ?? ''}`}>{LEVEL_MN[o.level] ?? o.level}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-[10px] font-bold text-ok">
                    <Icon name="calendar" size={12} /> {DAY_MN[o.day]} {o.timeSlot.split('-')[0]}
                  </span>
                  {o.requiredSkills.slice(0, 2).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-page px-2 py-0.5 text-[10px] font-semibold text-muted">
                      <Icon name="star" size={12} /> {s}
                    </span>
                  ))}
                </div>

                {o.matchReasonMongolian && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-page/80 px-3 py-2 text-[11px] leading-relaxed text-muted">
                    <Icon name="cpu" size={14} className="mt-0.5 shrink-0 text-accent" />
                    <span>{o.matchReasonMongolian}</span>
                  </p>
                )}

                <button
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 active:scale-95 ${
                    isJoined
                      ? 'border border-ok/40 bg-ok/10 text-ok'
                      : 'border border-line bg-page/60 text-ink hover:border-accent/50 hover:bg-accent/10 hover:text-accent'
                  }`}
                  onClick={() => {
                    if (isJoined) return;
                    setJoined((j) => ({ ...j, [o.id]: true }));
                    toast(`"${o.title}" — бүртгэл амжилттай`);
                  }}
                >
                  {isJoined ? (
                    <>
                      <Icon name="check" size={16} /> Бүртгэгдсэн
                    </>
                  ) : (
                    <>
                      Нэгдэх / Оролцох <Icon name="arrowRight" size={16} />
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
        {!items.length && (
          <p className="col-span-full rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Одоогоор таны чөлөөт цагт багтах боломж олдсонгүй. About Me-гээ шинэчлэх эсвэл хуваарьтаа чөлөөт цаг нэмж үзээрэй.
          </p>
        )}
      </div>
      {node}
    </Card>
  );
}
