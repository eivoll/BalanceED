import { useState } from 'react';
import { DAYS } from '../../shared/types';
import { attempt, M, type StudentDTO } from '../api';
import { useVoiceInput } from '../voice';
import { TimeRangeFields } from './DateTimeField';
import { Card, DAY_MN, useToast } from './shared';
import { Icon, type IconName } from './icons';

function TagEditor({
  label,
  placeholder,
  icon,
  tone,
  initial,
  onChange,
}: {
  label: string;
  placeholder: string;
  icon: IconName;
  tone: 'interest' | 'skill' | 'goal';
  initial: string[];
  onChange: (next: string[]) => void;
}) {
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState('');
  const voice = useVoiceInput((text) => add(text.trim()));

  // The icon and the heading above already say which group a chip belongs to.
  const toneCls = 'border-accent/40 bg-accent/10 text-accent';

  function add(raw: string) {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value || tags.includes(value)) return;
    const next = [...tags, value];
    setTags(next);
    onChange(next);
    setDraft('');
  }

  function remove(value: string) {
    const next = tags.filter((t) => t !== value);
    setTags(next);
    onChange(next);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
        {tags.map((t) => (
          <span
            key={t}
            className={`animate-pop inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-150 hover:shadow-sm ${toneCls}`}
          >
            <Icon name={icon} size={12} />
            {t}
            <button
              className="ml-0.5 rounded-full p-0.5 leading-none opacity-60 transition-all hover:bg-ink/10 hover:opacity-100"
              onClick={() => remove(t)}
              aria-label={`${t} хасах`}
            >
              <Icon name="close" size={11} strokeWidth={2.2} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[10rem] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted/60"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft.trim());
            }
          }}
        />
        {tone === 'interest' && voice.supported && (
          <button type="button" className="icon-toggle border border-line" onClick={voice.start} title="Дуугаар оруулах" aria-label="Дуугаар оруулах">
            <Icon name="mic" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AboutMeEditor({ student, onSaved }: { student: StudentDTO; onSaved: () => void }) {
  const [interests, setInterests] = useState(student.aboutMe.interests);
  const [skills, setSkills] = useState(student.aboutMe.skills);
  const [goals, setGoals] = useState(student.aboutMe.careerGoals);
  const [saving, setSaving] = useState(false);
  const { toast, toastError, node } = useToast();

  async function save() {
    setSaving(true);
    try {
      const problem = await attempt(() => M.updateAboutMe(student.id, interests, skills, goals));
      if (problem) return toastError(problem);
      toast('Танилцуулга хадгалагдлаа');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Миний танилцуулга" subtitle="Сонирхол · ур чадвар · зорилго — AI эдгээрт үндэслэн боломж санал болгоно">
      <div className="grid grid-cols-1 gap-4">
        <TagEditor label="Сонирхол" placeholder="Дизайн гэж бичээд Enter" icon="heart" tone="interest" initial={student.aboutMe.interests} onChange={setInterests} />
        <TagEditor label="Ур чадвар" placeholder="График дизайн, багийн ажил…" icon="star" tone="skill" initial={student.aboutMe.skills} onChange={setSkills} />
        <TagEditor label="Мэргэжлийн зорилго" placeholder="Дизайнер, инженер…" icon="target" tone="goal" initial={student.aboutMe.careerGoals} onChange={setGoals} />
      </div>
      <div className="mt-5">
        <button className="btn-grad" disabled={saving} onClick={save}>
          {saving ? 'Хадгалж байна…' : <><Icon name="save" size={16} /> Хадгалах</>}
        </button>
      </div>
      {node}
    </Card>
  );
}

export function AddScheduleForm({ studentId, onAdded }: { studentId: string; onAdded: () => void }) {
  const [day, setDay] = useState<string>('Monday');
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('17:30');
  const [activity, setActivity] = useState('');
  const [error, setError] = useState('');
  const voice = useVoiceInput((text) => setActivity(text.trim()));
  const { toast, node } = useToast();

  async function add() {
    setError('');
    if (!activity.trim()) return setError('Үйл ажиллагааны нэрээ оруулна уу.');
    if (start >= end) return setError('Эхлэх цаг дуусах цагаас өмнө байх ёстой.');
    const problem = await attempt(() => M.addScheduleItem(studentId, day, `${start}-${end}`, activity.trim()));
    if (problem) return setError(problem);
    setActivity('');
    toast('Хуваарьт нэмэгдлээ — эцэг эхийн баталгаажуулалт шинэчлэгдэнэ');
    onAdded();
  }

  return (
    <Card title="Үйл ажиллагаа нэмэх" subtitle="Үлдсэн чөлөөт цагийг систем автоматаар тооцоолж тэмдэглэнэ">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="label">Өдөр</span>
          <select className="field" value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>{DAY_MN[d]}</option>
            ))}
          </select>
        </div>
        <TimeRangeFields
          start={start}
          end={end}
          onChange={(next) => { setStart(next.start); setEnd(next.end); }}
        />
        <div>
          <span className="label">Үйл ажиллагаа</span>
          <div className="flex gap-2">
            <input className="field" value={activity} placeholder="Жүдо бэлтгэл…" onChange={(e) => setActivity(e.target.value)} />
            {voice.supported && (
              <button type="button" className="icon-toggle shrink-0 border border-line" onClick={voice.start} title="Дуугаар оруулах" aria-label="Дуугаар оруулах">
                <Icon name="mic" size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="mt-4">
        <button className="btn-grad" onClick={add}>
          <Icon name="plus" size={16} /> Хуваарьт нэмэх
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Хуваарь өөрчлөгдвөл эцэг эхийн өмнөх зөвшөөрөл автоматаар цуцлагдана.
      </p>
      {node}
    </Card>
  );
}
