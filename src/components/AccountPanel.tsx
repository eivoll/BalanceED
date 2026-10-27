import { useEffect, useRef, useState } from 'react';
import { A, attempt, M, type AuthUserDTO } from '../api';
import { Icon } from './icons';
import { StatusIcon } from './shared';

const ROLE_MN: Record<string, string> = { student: 'Сурагч', parent: 'Эцэг эх', teacher: 'Багш' };

export default function AccountPanel({
  user,
  onClose,
  onSignedOut,
}: {
  user: AuthUserDTO;
  onClose: () => void;
  onSignedOut: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function changePassword(e: { preventDefault(): void }) {
    e.preventDefault();
    setFeedback(null);
    if (next.length < 8) return setFeedback({ text: 'Шинэ нууц үг дор хаяж 8 тэмдэгт байх.', ok: false });
    setBusy(true);
    const problem = await attempt(() => A.changePassword(current, next));
    setBusy(false);
    if (problem) return setFeedback({ text: problem, ok: false });
    setCurrent('');
    setNext('');
    setFeedback({ text: 'Нууц үг солигдлоо. Бусад төхөөрөмжөөс дахин нэвтрэх шаардлагатай.', ok: true });
  }

  async function signOut() {
    const problem = await attempt(() => A.logout());
    onClose();
    if (problem) setFeedback({ text: problem, ok: false });
    else onSignedOut();
  }

  async function deleteAccount() {
    setBusy(true);
    // The server drops every session of this account, so the cookie dies with it.
    const problem = await attempt(() => M.removeStudent(user.students[0].id));
    setBusy(false);
    if (problem) return setFeedback({ text: problem, ok: false });
    onClose();
    onSignedOut();
  }

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Бүртгэлийн тохиргоо"
      className="animate-pop absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur"
    >
      <p className="text-sm font-bold">{user.displayName}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
      <p className="eyebrow mt-1 text-accent">
        {ROLE_MN[user.role] ?? user.role}
      </p>

      <form className="mt-4 border-t border-line/70 pt-3" onSubmit={changePassword}>
        <p className="mb-2 text-xs font-bold">Нууц үг солих</p>
        <span className="label">Одоогийн нууц үг</span>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <span className="label mt-2 block">Шинэ нууц үг</span>
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="дор хаяж 8 тэмдэгт"
        />
        {feedback && (
          <p
            className={`mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
              feedback.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            <StatusIcon level={feedback.ok ? 'ok' : 'danger'} /> {feedback.text}
          </p>
        )}
        <button type="submit" className="btn-soft mt-3 w-full py-2 text-xs" disabled={busy || !current || !next}>
          {busy ? 'Шалгаж байна…' : 'Хадгалах'}
        </button>
      </form>

      <button
        type="button"
        onClick={signOut}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 py-2 text-xs font-bold text-danger transition-all duration-150 hover:bg-danger/10"
      >
        <Icon name="logout" size={15} /> Гарах
      </button>

      {user.role === 'student' && user.students[0] && (
        <div className="mt-3 border-t border-line/70 pt-3">
          {confirmDelete ? (
            <>
              <p className="text-[11px] leading-relaxed text-muted">
                Хуваарь, даалгавар, эцэг эхийн холбоос хамт устана — энэ үйлдэл буцахгүй.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteAccount}
                  className="btn-danger flex-1 py-1.5 text-xs"
                >
                  {busy ? 'Устгаж байна…' : 'Тийм, устгах'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-soft px-3 py-1.5 text-xs">
                  Үгүй
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-xs font-bold text-muted transition-all duration-150 hover:border-danger/40 hover:text-danger"
            >
              <Icon name="trash" size={15} /> Бүртгэл устгах
            </button>
          )}
        </div>
      )}
    </div>
  );
}
