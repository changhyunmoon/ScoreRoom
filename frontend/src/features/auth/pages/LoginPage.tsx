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
        <p className="auth-links left muted small">비밀번호를 잊었다면 시스템 관리자에게 재설정을 요청해 주세요.</p>
        <button className="btn dark block auth-btn" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        {signupEnabled && <Link to="/signup" className="btn block auth-btn sub">회원가입</Link>}
      </form>
      {import.meta.env.DEV && <DevAccountsHint />}
    </AuthShell>
  );
}

/** 로컬 개발 서버에서만 보이는 가상 계정 안내 (backend local 프로필의 시드 데이터) */
function DevAccountsHint() {
  return (
    <div className="demo-box small">
      <div className="demo-title">로컬 개발용 가상 계정</div>
      <span className="muted">룸 운영자: seojun.lee@example.com · 참여자: jiwoo.park@example.com · 전체 열람: sua.bae@example.com (비밀번호 password1!)</span>
      <span className="muted">시스템 관리자: admin@example.com (비밀번호 admin1234!)</span>
    </div>
  );
}
