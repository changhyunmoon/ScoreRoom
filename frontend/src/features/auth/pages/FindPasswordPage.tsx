import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, run, toast } from '../../../shared/ui';
import { resetPassword } from '../api/auth.api';
import { AuthShell } from '../components/AuthShell';

/** 비밀번호 찾기: 이메일·이름·전화번호가 모두 맞으면 새 비밀번호로 바꾼다 */
export default function FindPasswordPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ loginId: '', name: '', phone: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const mismatch = f.password2 !== '' && f.password !== f.password2;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) return toast('새 비밀번호가 일치하지 않아요.', 'err');
    setBusy(true);
    const ok = await run(() => resetPassword(f.loginId, f.name, f.phone, f.password), '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');
    setBusy(false);
    if (ok) nav('/login');
  };
  return (
    <AuthShell title="비밀번호 찾기">
      <form className="stack" onSubmit={submit}>
        <Field label="이메일"><input type="email" value={f.loginId} onChange={set('loginId')} autoComplete="username" required /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} required /></Field>
        <Field label="새 비밀번호" hint="8자 이상"><input type="password" minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" required /></Field>
        <Field label="새 비밀번호 확인" hint={mismatch ? <span className="err-text">새 비밀번호와 일치하지 않아요.</span> : undefined}>
          <input type="password" className={mismatch ? 'invalid' : ''} value={f.password2} onChange={set('password2')} autoComplete="new-password" required />
        </Field>
        <button className="btn primary solid block" disabled={busy || mismatch}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</button>
      </form>
      <div className="auth-links"><Link to="/login">로그인</Link><span>·</span><Link to="/find-id">이메일 찾기</Link></div>
    </AuthShell>
  );
}
