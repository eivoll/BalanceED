import { useState } from 'react';
import { A, type AuthUserDTO } from '../api';
import { Icon } from './icons';
import { StatusIcon } from './shared';

const DEMO_ACCOUNTS: { email: string; role: string; who: string }[] = [
  { email: 'teacher@demo.mn', role: 'Багш', who: 'ангийн ачаалал, даалгавар, сурагч нэмэх' },
  { email: 'student@demo.mn', role: 'Сурагч', who: 'хуваарь, даалгавар, About Me' },
  { email: 'parent@demo.mn', role: 'Эцэг эх', who: 'хуваарь баталгаажуулах, дэвшил' },
];

export default function Landing({ onSignedIn }: { onSignedIn: (user: AuthUserDTO) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('И-мэйл болон нууц үгээ оруулна уу.');
    setBusy(true);
    try {
      const user = await A.login(email.trim(), password);
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Нэвтрэхэд алдаа гарлаа.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
      <section className="glass p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Тэнцвэртэй сургалт</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          Сурагчийн долоо хоногийг хэн хянаж байна вэ?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          BalanceEd хичээл, спорт, ажил хөдөлмөр, ур чадварын боломжуудыг нэг долоо хоногийн
          хуваарьт цуглуулж, ачааллын индекс, давхцал, эцэг эхийн зөвшөөрлийг нэг дор харуулна.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-3">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} className="rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-sm font-bold">{a.role}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.who}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass h-fit p-6 sm:p-8">
        <h2 className="text-lg font-extrabold tracking-tight">Нэвтрэх</h2>
        <p className="mt-1 text-xs text-muted">И-мэйл болон нууц үгээрээ нэвтэрнэ үү.</p>
        <form className="mt-5 grid grid-cols-1 gap-3" onSubmit={submit}>
          <div>
            <span className="label">И-мэйл</span>
            <input
              className="field"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@demo.mn"
            />
          </div>
          <div>
            <span className="label">Нууц үг</span>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
              <StatusIcon level="danger" /> {error}
            </p>
          )}
          <button type="submit" className="btn-grad mt-1" disabled={busy}>
            {busy ? 'Шалгаж байна…' : <><Icon name="arrowRight" size={16} /> Нэвтрэх</>}
          </button>
        </form>

        <div className="mt-6 border-t border-line/70 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
            Туршилтын бүртгэл · нууц үг <code className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px] normal-case tracking-normal">Demo!2026</code>
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-line bg-surface/60 px-3 py-2 text-left text-xs font-semibold transition-all duration-150 hover:border-accent hover:shadow-sm"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('Demo!2026');
                    setError('');
                  }}
                >
                  {a.role} — <span className="font-mono font-normal text-muted">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Эдгээр нь зөвхөн демо бөгөөд нэвтэрсний дараа нууц үгээ солиорой.
          </p>
        </div>
      </section>
    </div>
  );
}
