import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { run } from '../../../shared/ui';
import { useSession } from '../../session';
import { fetchAuthOptions, login } from '../api/auth.api';
import { AuthShell } from '../components/AuthShell';

export default function LoginPage() {
  const { me, status } = useSession();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(false);
  useEffect(() => { fetchAuthOptions().then(o => setSignupEnabled(o.signupEnabled)).catch(() => setSignupEnabled(false)); }, []);
  if (status === 'loading') return <div className="boot-loading">불러오는 중…</div>;
  if (me) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await run(() => login(id, pw));
    setBusy(false);
    if (ok) nav('/');
  };
  return (
    <AuthShell>
      <form onSubmit={submit} className="stack auth-form">
        <input className="auth-input" type="email" placeholder="이메일" aria-label="이메일" value={id} onChange={e => setId(e.target.value)} autoComplete="username" required />
        <input className="auth-input" type="password" placeholder="비밀번호" aria-label="비밀번호" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required />
        <div className="auth-links left">
          <Link to="/find-id">[이메일 찾기]</Link><span className="sep" /><Link to="/find-pw">[비밀번호 찾기]</Link>
        </div>
        <button className="btn dark block auth-btn" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        {signupEnabled && <Link to="/signup" className="btn block auth-btn sub">회원가입</Link>}
      </form>
    </AuthShell>
  );
}
