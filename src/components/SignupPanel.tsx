import { useState, type ReactNode } from 'react';
import { type Day } from '../../shared/types';
import { A, type AuthUserDTO, type SignupInput } from '../api';
import { SchoolHoursFields, toEntries, weekdayPreset, type DayRow } from './SchoolHoursEditor';
import { Icon } from './icons';
import { StatusIcon } from './shared';

const GRADE_RE = /^([1-9]|1[0-2])(-[А-ЯЁа-яёA-Za-z]{1,2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: 'user' | 'heart' | 'bulb' | 'school'; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-b border-line/70 pb-2 pt-1 text-xs font-extrabold uppercase tracking-wide text-muted">
      <Icon name={icon} size={14} className="text-accent" /> {children}
    </p>
  );
}

const list = (raw: string) => raw.split(',').map((t) => t.trim()).filter(Boolean);

export default function SignupPanel({ onSignedIn }: { onSignedIn: (user: AuthUserDTO) => void }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [interests, setInterests] = useState('');
  const [skills, setSkills] = useState('');
  const [goals, setGoals] = useState('');
  const [rows, setRows] = useState<Record<Day, DayRow>>(weekdayPreset);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Сурагчийн нэрийг оруулна уу.');
    if (!GRADE_RE.test(grade.trim())) return setError('Ангиа 10 эсвэл 11-Б хэлбэрээр бичнэ үү.');
    if (!school.trim()) return setError('Сургуулийнхээ нэрийг оруулна уу.');
    if (!EMAIL_RE.test(email.trim())) return setError('Сурагчийн и-мэйл хаяг буруу байна.');
    if (password.length < 8) return setError('Нууц үг дор хаяж 8 тэмдэгт байх ёстой.');
    if (password !== confirm) return setError('Нууц үг хоёроо тохирохгүй байна.');

    const hasParent = !!parentEmail.trim() || !!parentName.trim() || !!parentPassword.trim();
    if (hasParent) {
      if (!EMAIL_RE.test(parentEmail.trim())) return setError('Эцэг эхийн и-мэйл хаяг буруу байна.');
      if (parentEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
        return setError('Эцэг эх, сурагчийн и-мэйл хаяг ижил байж болохгүй.');
      }
      if (parentPassword.length < 8) return setError('Эцэг эхийн нууц үг дор хаяж 8 тэмдэгт байх ёстой.');
    }

    const schoolHours = toEntries(rows);
    if (!schoolHours.length) return setError('Дор хаяж нэг өдрийн хичээлийн цагаа заана уу.');

    const input: SignupInput = {
      name: name.trim(),
      grade: grade.trim(),
      school: school.trim(),
      email: email.trim(),
      password,
      parentName: hasParent ? parentName.trim() : undefined,
      parentEmail: hasParent ? parentEmail.trim() : undefined,
      parentPassword: hasParent ? parentPassword : undefined,
      interests: list(interests),
      skills: list(skills),
      careerGoals: list(goals),
      schoolHours,
    };

    setBusy(true);
    try {
      onSignedIn(await A.signup(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Бүртгэл амжилтгүй боллоо.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-5 grid grid-cols-1 gap-4" onSubmit={submit}>
      <SectionTitle icon="user">Сурагчийн мэдээлэл</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Нэр" htmlFor="su-name">
          <input id="su-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Оргилмаа Бат" autoComplete="name" />
        </Field>
        <Field label="Анги" htmlFor="su-grade" hint="Жишээ: 11-Б · ангиа хамт бичнэ үү.">
          <input id="su-grade" className="field" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="11-Б" />
        </Field>
        <Field label="Сургууль" htmlFor="su-school">
          <input id="su-school" className="field" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Билим Эрдүн цогцолбор сургууль" />
        </Field>
        <Field label="И-мэйл" htmlFor="su-email" hint="Нэвтрэх хаяг болно — бусдад харагдана.">
          <input id="su-email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="saraa@mail.mn" autoComplete="username" />
        </Field>
        <Field label="Нууц үг" htmlFor="su-pass" hint="Дор хаяж 8 тэмдэгт.">
          <input id="su-pass" className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Нууц үг давтах" htmlFor="su-pass2">
          <input id="su-pass2" className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>

      <SectionTitle icon="school">Долоо хоногийн хичээлийн хуваарь</SectionTitle>
      <SchoolHoursFields
        value={rows}
        onChange={setRows}
        hint="Энэ цаг чөлөөт цагт тооцогдохгүй — хичээлээс гадуурх ажил, даалгавар зөвхөн үлдсэн цагт багтана."
      />

      <SectionTitle icon="bulb">Сонирхол, ур чадвар, зорилго</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Сонирхол" htmlFor="su-int" hint="Таслалаар тусгайлна уу.">
          <input id="su-int" className="field" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="зураг, хөгжим" />
        </Field>
        <Field label="Ур чадвар" htmlFor="su-skill">
          <input id="su-skill" className="field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="багийн ажил, дизайн" />
        </Field>
        <Field label="Мэргэжлийн зорилго" htmlFor="su-goal">
          <input id="su-goal" className="field" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="дизайнер, инженер" />
        </Field>
      </div>
      <p className="-mt-2 text-[11px] leading-relaxed text-muted">
        Эдгээрийг дараа нь «Танилцуулга» хэсгээс засаж болно. AI боломж сонгохдоо энд бичсэн зүйлсийг харна.
      </p>

      <SectionTitle icon="heart">Эцэг эхийн мэдээлэл</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Эцэг эхийн нэр" htmlFor="su-pname">
          <input id="su-pname" className="field" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Бат-Эрдэнэ" />
        </Field>
        <Field label="Эцэг эхийн и-мэйл" htmlFor="su-pemail">
          <input id="su-pemail" className="field" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="bat-erdene@mail.mn" autoComplete="email" />
        </Field>
        <Field label="Эцэг эхийн нууц үг" htmlFor="su-ppass">
          <input id="su-ppass" className="field" type="password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <p className="-mt-2 text-[11px] leading-relaxed text-muted">
        Бөглөвэл эцэг эх тань тусдаа нэвтэрч, долоо хоногийн хуваарийг баталгаажуулна. Оруулаагүй үлдээвэл хуваарь баталгаажуулаагүй төлөвтэй байна.
      </p>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <StatusIcon level="danger" /> {error}
        </p>
      )}

      <button type="submit" className="btn-grad" disabled={busy}>
        {busy ? 'Бүртгэж байна…' : <><Icon name="plus" size={16} /> Бүртгүүлэх</>}
      </button>
      <p className="text-[11px] leading-relaxed text-muted">
        Оруулсан мэдээлэл зөвхөн энэ серверт хадгалагдана — AI тойм үүсгэхэд нэр, и-мэйл зэрэг хувийн мэдээлэл гадаад үйлчилгээнд очдоггүй.
      </p>
    </form>
  );
}
