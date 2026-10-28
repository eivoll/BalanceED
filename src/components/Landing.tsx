import { useState } from 'react';
import { A, type AuthUserDTO } from '../api';
import SignupPanel from './SignupPanel';
import { Icon, type IconName } from './icons';
import { StatusIcon } from './shared';

const DEMO_ACCOUNTS: { email: string; role: string; who: string; icon: IconName }[] = [
  { email: 'teacher@demo.mn', role: 'Багш', who: 'ангийн ачаалал, даалгавар, сурагч нэмэх', icon: 'clipboard' },
  { email: 'student@demo.mn', role: 'Сурагч', who: 'хуваарь, даалгавар, танилцуулга', icon: 'book' },
  { email: 'parent@demo.mn', role: 'Эцэг эх', who: 'хуваарь баталгаажуулах, дэвшил', icon: 'heart' },
  { email: 'admin@demo.mn', role: 'Админ', who: 'бүртгэлийн жагсаалт, эрх тохируулах', icon: 'shield' },
];

const SIGNUP_STEPS: { title: string; body: string; icon: IconName }[] = [
  { title: 'Хичээлийн цаг', body: 'Анхны долоо хоногийн хуваариа заана — үлдсэн цаг чөлөөт цаг болж тооцогдоно.', icon: 'school' },
  { title: 'Эцэг эхийн данс', body: 'Эцэг эх тусдаа нэвтэрч, хуваарийг чинь баталгаажуулна. Бөглөхгүй байж болно.', icon: 'heart' },
  { title: 'Сонирхол, зорилго', body: 'Хэдхэн үг бичвэл боломжийн сан түүгээр чинь шүүгдэнэ. Дараа засна.', icon: 'bulb' },
];

export default function Landing({ onSignedIn }: { onSignedIn: (user: AuthUserDTO) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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
    <div className={`grid grid-cols-1 items-start gap-8 ${mode === 'signup' ? 'lg:grid-cols-[0.85fr_1.15fr]' : 'lg:grid-cols-[1.15fr_0.85fr]'} lg:gap-12`}>
      <section className="px-1 py-2">
        <p className="eyebrow text-accent">Тэнцвэртэй сургалт</p>
        <h2 className="mt-3 max-w-[16ch] text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl">
          Сурагчийн долоо хоног тэнцвэртэй байна уу?
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
          BalanceEd хичээл, спорт, ажил, ур чадварын боломжуудыг нэг долоо хоногийн
          хуваарьт цуглуулж, ачааллын индекс, давхцал, эцэг эхийн зөвшөөрлийг нэг дор харуулна.
        </p>

        {mode === 'login' ? (
          <>
            <ul className="mt-8 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    className="card group flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:border-accent/60 hover:bg-accent/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword('Demo!2026');
                      setError('');
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden>
                      <Icon name={a.icon} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{a.role}</span>
                      <span className="block truncate text-xs text-muted">{a.who}</span>
                    </span>
                    <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">{a.email}</span>
                    <Icon name="arrowRight" size={15} className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Эдгээр нь зөвхөн демо бүртгэл — дээр нь дарбал талбарууд автоматаар бөглөгдөнө.
            </p>
          </>
        ) : (
          <ul className="mt-8 grid gap-2">
            {SIGNUP_STEPS.map((s) => (
              <li key={s.title} className="card flex items-start gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden>
                  <Icon name={s.icon} size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.title}</span>
                  <span className="block text-xs leading-relaxed text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6 sm:p-8">
        <div className="seg mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <span className="seg-indicator" style={{ width: 'calc((100% - 0.5rem)/2)', transform: `translateX(${mode === 'login' ? 0 : 100}%)` }} aria-hidden />
          <button type="button" className={`seg-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>
            Нэвтрэх
          </button>
          <button type="button" className={`seg-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>
            Бүртгүүлэх
          </button>
        </div>

        {mode === 'login' ? (
          <>
            <p className="text-xs text-muted">И-мэйл болон нууц үгээрээ нэвтэрнэ үү.</p>
            <form className="mt-4 grid grid-cols-1 gap-3" onSubmit={submit}>
              <div>
                <label className="label" htmlFor="login-email">И-мэйл</label>
                <input
                  id="login-email"
                  className="field"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@demo.mn"
                />
              </div>
              <div>
                <label className="label" htmlFor="login-password">Нууц үг</label>
                <input
                  id="login-password"
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
            <p className="mt-4 border-t border-line/70 pt-3 text-[11px] text-muted">
              Демо бүртгэлийн нууц үг: <code className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px]">Demo!2026</code>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-extrabold tracking-tight">Шинэ сурагчийн бүртгэл</h2>
            <p className="mt-1 text-xs text-muted">Дуусахад шууд нэвтэрч орно.</p>
            <SignupPanel onSignedIn={onSignedIn} />
          </>
        )}
      </section>
    </div>
  );
}
