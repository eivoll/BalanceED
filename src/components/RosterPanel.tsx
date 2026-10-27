import { useState } from 'react';
import { type Day } from '../../shared/types';
import { M, attempt, type StudentDTO } from '../api';
import { SchoolHoursFields, toEntries, weekdayPreset, type DayRow } from './SchoolHoursEditor';
import { Icon } from './icons';
import { Card, CodeLinkForm, Pill, useToast } from './shared';

const GRADES = ['6', '7', '8', '9', '10', '11', '12'];

/** Teacher-only roster management: the server accepts these mutations only for the student's own teacher. */
export default function RosterPanel({
  students,
  onChanged,
}: {
  students: StudentDTO[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('10');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [rows, setRows] = useState<Record<Day, DayRow>>(weekdayPreset);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState('');
  const { toast, toastError, node } = useToast();

  async function add(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim() || !school.trim() || !email.trim()) {
      return toastError('Нэр, сургууль, и-мэйл заавал бөглөнө үү.');
    }
    if (password.length < 8) return toastError('Сурагчийн нууц үг дор хаяж 8 тэмдэгт байх.');
    if (parentEmail.trim() && parentPassword.length < 8) {
      return toastError('Эцэг эхийн и-мэйл заасан бол нууц үг нь мөн 8+ тэмдэгт байх ёстой.');
    }
    const schoolHours = toEntries(rows);
    if (!schoolHours.length) return toastError('Долоо хоногийн хичээлийн цагийг дор хаяж нэг өдрөөр заана уу.');
    setBusy(true);
    const problem = await attempt(() =>
      M.createStudent({
        name: name.trim(),
        grade,
        school: school.trim(),
        email: email.trim(),
        password,
        parentEmail: parentEmail.trim() || undefined,
        parentName: parentName.trim() || undefined,
        parentPassword: parentEmail.trim() ? parentPassword : undefined,
        schoolHours,
      }),
    );
    setBusy(false);
    if (problem) return toastError(problem);
    setName(''); setEmail(''); setPassword(''); setParentEmail(''); setParentName(''); setParentPassword('');
    toast('Сурагч болон түүний бүртгэл үүслээ');
    onChanged();
  }

  async function remove(id: string) {
    const problem = await attempt(() => M.removeStudent(id));
    setConfirmRemove('');
    if (problem) return toastError(problem);
    toast('Сурагчийг хаслаа');
    onChanged();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Сурагч нэмэх"
          subtitle="Сурагчийн мэдээлэл, нэвтрэх бүртгэл, хичээлийн цаг, эцэг эхийн холболт үүснэ"
        >
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={add}>
            <div className="sm:col-span-2">
              <span className="label">Нэр</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Т. Наран" />
            </div>
            <div>
              <span className="label">Анги</span>
              <select className="field" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {GRADES.map((g) => <option key={g} value={g}>{g}-р анги</option>)}
              </select>
            </div>
            <div>
              <span className="label">Сургууль</span>
              <input className="field" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Сургууль №5" />
            </div>
            <div>
              <span className="label">Сурагчийн и-мэйл</span>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naran@school5.mn" />
            </div>
            <div>
              <span className="label">Сурагчийн нууц үг</span>
              <input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ тэмдэгт" />
            </div>
            <div>
              <span className="label">Эцэг эхийн и-мэйл <span className="font-normal text-muted">(сонголттой)</span></span>
              <input className="field" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="oyun@mail.mn" />
            </div>
            <div>
              <span className="label">Эцэг эхийн нэр <span className="font-normal text-muted">(сонголттой)</span></span>
              <input className="field" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Т. Оюун" />
            </div>
            <div className="sm:col-span-2">
              <span className="label">Эцэг эхийн нууц үг <span className="font-normal text-muted">(зөвхөн и-мэйл бөглөсөн бол)</span></span>
              <input className="field" type="text" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} placeholder="8+ тэмдэгт" />
            </div>

            <div className="sm:col-span-2 mt-1">
              <span className="label">Долоо хоногийн хичээлийн цаг</span>
              <SchoolHoursFields
                value={rows}
                onChange={setRows}
                hint="Сургуулийн цагийг чөлөөт цагт тооцохгүй — ачааллын индекс үүн дээр үндэслэнэ."
              />
            </div>

            <div className="sm:col-span-2">
              <button type="submit" className="btn-grad" disabled={busy}>
                {busy ? 'Үүсгэж байна…' : <><Icon name="plus" size={16} /> Сурагч нэмэх</>}
              </button>
            </div>
          </form>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Эцэг эхийн и-мэйл бөглөвөл тухайн хаягаар «Эцэг эх» бүртгэл үүсч, энэ сурагчтай холбогдоно.
            Холболттой эцэг эх л хуваарийг зөвшөөрч болно.
          </p>
        </Card>

        <Card title="Миний анги" subtitle={`${students.length} сурагч · жагсаалтаас устгавал хуваарь, даалгавар, бүртгэл хамт устана`}
          actions={<Pill tone="info">Багшийн жагсаалт</Pill>}
        >
          <div className="mb-4 rounded-xl border border-line bg-surface/60 p-3">
            <p className="mb-2 text-xs font-bold">Сурагч холбох</p>
            <CodeLinkForm
              hint="Өөрөө бүртгүүлсэн сурагчаас холбох кодыг нь авч энд оруулна уу."
              button="Холбох"
              submit={(code) => attempt(() => M.joinTeacher(code))}
              onDone={() => {
                toast('Сурагч таны жагсаалтад нэмэгдлээ');
                onChanged();
              }}
            />
          </div>
          {students.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-xs text-muted">
              Одоогоор танд сурагч байхгүй. Маягтыг бөглөж шинэ сурагч нэмээрэй.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {students.map((s) => (
                <li key={s.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <p className="truncate text-[11px] font-medium text-muted">
                        {s.grade} анги · {s.school} · {s.parentVerification.isScheduleApproved ? 'хуваарь баталгаажсан' : 'хуваарь баталгаажаагүй'}
                      </p>
                    </div>
                    {confirmRemove === s.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger"
                          onClick={() => remove(s.id)}
                        >
                          Устгах уу? Тийм
                        </button>
                        <button
                          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-muted"
                          onClick={() => setConfirmRemove('')}
                        >
                          Үгүй
                        </button>
                      </span>
                    ) : (
                      <button
                        className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-muted transition-all duration-150 hover:border-danger/40 hover:text-danger"
                        onClick={() => setConfirmRemove(s.id)}
                      >
                        Хасах
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {node}
    </>
  );
}
