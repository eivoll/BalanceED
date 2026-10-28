import { useCallback, useEffect, useState } from 'react';
import { attempt, M, Q, type AdminUserDTO, type AuthUserDTO, type RoleDTO } from '../api';
import { Icon } from './icons';
import { Card, fmtDate, useToast } from './shared';

const ROLE_MN: Record<RoleDTO, string> = { student: 'Сурагч', parent: 'Эцэг эх', teacher: 'Багш', admin: 'Админ' };
const ROLE_ORDER: RoleDTO[] = ['student', 'parent', 'teacher', 'admin'];
/** What the number behind each account is called — an admin reaches no profile at all. */
const REACH: Record<RoleDTO, string> = { student: 'профайл', parent: 'хүүхэд', teacher: 'сурагч', admin: '' };

export default function AdminView({ me }: { me: AuthUserDTO }) {
  const [rows, setRows] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast, toastError, node } = useToast();

  const load = useCallback(() => {
    Q.adminUsers()
      .then((d) => {
        setRows([...d.adminUsers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      })
      .catch((err) => {
        toastError(err instanceof Error ? err.message : 'Хэрэглэгчдийг татаж чадсангүй.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(row: AdminUserDTO, role: RoleDTO) {
    setBusyId(row.id);
    const problem = await attempt(() => M.adminSetRole(row.id, role));
    setBusyId('');
    if (problem) return toastError(problem);
    toast(`${row.displayName} — ${ROLE_MN[role]} болов`);
    load();
  }

  async function createTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return toastError('Нэр, и-мэйл, нууц үгийг бөглөнө үү.');
    setCreating(true);
    const problem = await attempt(() => M.adminCreateTeacher(name.trim(), email.trim(), password));
    setCreating(false);
    if (problem) return toastError(problem);
    setName(''); setEmail(''); setPassword('');
    toast('Шинэ багшийн бүртгэл үүслээ');
    load();
  }

  const count = (role: RoleDTO) => rows.filter((r) => r.role === role).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card
        title="Хэрэглэгчид"
        subtitle={`Нийт ${rows.length} бүртгэл · Багш ${count('teacher')} · Сурагч ${count('student')} · Эцэг эх ${count('parent')} · Админ ${count('admin')}`}
      >
        {loading ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-xs text-muted">Ачаалж байна…</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {row.displayName}
                      {row.id === me.id && <span className="ml-2 text-[10px] font-semibold text-muted">(та)</span>}
                    </p>
                    <p className="truncate text-[11px] font-medium text-muted">
                      {row.email} · {fmtDate(row.createdAt)}
                      {REACH[row.role] && ` · ${row.linkedStudents} ${REACH[row.role]}`}
                    </p>
                  </div>
                  <select
                    className="field w-32 py-1.5 text-xs"
                    aria-label={`Эрх: ${row.displayName}`}
                    value={row.role}
                    disabled={row.id === me.id || busyId === row.id}
                    onChange={(e) => changeRole(row, e.target.value as RoleDTO)}
                    title={row.id === me.id ? 'Та өөрийнхөө эрхийг өөрчлөх боломжгүй' : undefined}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>{ROLE_MN[r]}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Сурагчийг багш болговол тэр өөрийн хуучин сурагчийн профайлд нэвтрэхгүй — профайлыг өөр багш
          холбох кодоор авах боломжтой. Профайлгүй бүртгэлийг сурагч болгож болохгүй.
        </p>
      </Card>

      <Card title="Багшийн бүртгэл үүсгэх" subtitle="Сурагчийн профайл шаардахгүйгээр багшийн нэвтрэх хаяг үүсгэнэ">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={createTeacher}>
          <div className="sm:col-span-2">
            <span className="label">Нэр</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Д. Ганхуяг" />
          </div>
          <div>
            <span className="label">И-мэйл</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ganhuu@school5.mn" />
          </div>
          <div>
            <span className="label">Нууц үг</span>
            <input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ тэмдэгт" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-grad" disabled={creating}>
              {creating ? 'Үүсгэж байна…' : <><Icon name="plus" size={16} /> Багш нэмэх</>}
            </button>
          </div>
        </form>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Шинэ багш эхлээд «Сурагч холбох» хэсгээс сурагчдын холбох кодыг оруулж ангаа бүрдүүлнэ.
        </p>
      </Card>
      {node}
    </div>
  );
}
