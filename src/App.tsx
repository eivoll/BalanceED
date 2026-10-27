import { useCallback, useEffect, useState } from 'react';
import { A, type AuthUserDTO } from './api';
import { A11yProvider, useA11y } from './accessibility';
import AccountPanel from './components/AccountPanel';
import Landing from './components/Landing';
import StudentView from './components/StudentView';
import ParentView from './components/ParentView';
import TeacherView from './components/TeacherView';
import { BrandMark, Icon } from './components/icons';
import { Pill, StatusIcon } from './components/shared';

const ROLE_MN: Record<string, string> = { student: 'Сурагч', parent: 'Эцэг эх', teacher: 'Багш' };

function Shell() {
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [studentId, setStudentId] = useState('');
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const { theme, setTheme } = useA11y();

  const refresh = useCallback(() => {
    A.me()
      .then((u) => {
        setUser(u);
        setStudentId((cur) => (u && cur && u.students.some((s) => s.id === cur) ? cur : u?.students[0]?.id || ''));
        setBootError('');
        setBooting(false);
      })
      .catch((err) => {
        setBootError(err instanceof Error ? err.message : 'Серверт холбогдсонгүй.');
        setBooting(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const students = user?.students ?? [];
  const student = students.find((s) => s.id === studentId);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="glass sticky top-4 z-40 mb-6 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-tile h-10 w-10">
              <BrandMark size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight">BalanceEd</h1>
              <p className="truncate text-[11px] font-medium text-muted">
                Сурагчийн ачааллыг тэнцвэржүүлэх EdTech платформ
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {user && (
              <>
                <Pill tone="info">{ROLE_MN[user.role] ?? user.role}</Pill>

                {students.length > 1 && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                    <span className="hidden md:inline">{user.role === 'teacher' ? 'Сурагч' : 'Хүүхэд'}</span>
                    <select className="field w-44 py-1.5" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="relative">
                  <button
                    className="btn-soft flex items-center gap-2 px-3 py-1.5 text-xs font-bold"
                    onClick={() => setAccountOpen((o) => !o)}
                    aria-expanded={accountOpen}
                    aria-haspopup="dialog"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-onaccent" aria-hidden>
                      {user.displayName.slice(0, 1)}
                    </span>
                    <span className="max-w-[9rem] truncate">{user.displayName}</span>
                    <Icon name="chevronDown" size={14} className="text-muted" />
                  </button>
                  {accountOpen && (
                    <AccountPanel
                      user={user}
                      onClose={() => setAccountOpen(false)}
                      onSignedOut={() => {
                        setUser(null);
                        setStudentId('');
                      }}
                    />
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              className="icon-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? 'Гэрлийн горим руу шилжих' : 'Харанхуй горим руу шилжих'}
              aria-label={theme === 'dark' ? 'Гэрлийн горим руу шилжих' : 'Харанхуй горим руу шилжих'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </div>
      </header>

      {booting && (
        <div className="glass p-10 text-center text-muted">
          <p>Ачаалж байна…</p>
        </div>
      )}

      {!booting && bootError && (
        <div className="glass p-10 text-center text-muted">
          <div className="grid grid-cols-1 gap-4">
            <p className="text-lg font-bold text-danger"><StatusIcon level="danger" /> Серверт холбогдоход асуудал гарлаа</p>
            <p className="mx-auto max-w-md text-sm leading-relaxed">{bootError}</p>
            <p className="mx-auto max-w-md text-xs">
              Сервер ажиллаж байгаа эсэхийг шалгаад (<code className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px]">npm run dev</code>) дахин оролдоно уу.
            </p>
            <div>
              <button className="btn-grad" onClick={refresh}>
                <Icon name="refresh" size={16} /> Дахин оролдох
              </button>
            </div>
          </div>
        </div>
      )}

      {!booting && !bootError && !user && <Landing onSignedIn={(u) => { setUser(u); setStudentId(u.students[0]?.id || ''); }} />}

      {!booting && !bootError && user && (
        <main key={`${user.role}-${studentId}`} className="animate-rise">
          {user.role === 'student' && student && <StudentView student={student} onStudentsChanged={refresh} />}
          {user.role === 'parent' && student && <ParentView student={student} onStudentsChanged={refresh} />}
          {user.role === 'teacher' && (
            <TeacherView students={students} initialStudentId={studentId} onChanged={refresh} />
          )}
          {user.role === 'parent' && !students.length && (
            <div className="glass p-8 text-center text-sm text-muted">
              Таны хүүхэд хараахан аль нэг багштай холбогдоогүй байна. Багшаасаа и-мэйл урилга авна уу.
            </div>
          )}
        </main>
      )}

      <footer className="mt-10 border-t border-line/70 pt-5 text-center text-xs leading-relaxed text-muted">
        <p className="font-bold text-ink">BalanceEd</p>
        <p className="mx-auto mt-1.5 max-w-md">
          Ачааллын оноо нь хуваарь, даалгавар, шалгалтаас автоматаар тооцогддог бөгөөд энэ нь зөвхөн зөвлөгөө юм.
          Эцэг эх, багш, сурагч хамтдаа шийдвэрлэнэ.
        </p>
        <p className="mt-2">© 2026 BalanceEd · Сурагчийн мэдээлэл таны серверт л хадгалагдана</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <A11yProvider>
      <Shell />
    </A11yProvider>
  );
}
