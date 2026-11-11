import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { ID } from '../../../shared/lib/types';
import { Field, run, toast } from '../../../shared/ui';
import { fetchTeams, TeamSelect, type Team } from '../../organization';
import { fetchAuthOptions, signup } from '../api/auth.api';
import { AuthShell } from '../components/AuthShell';

/** 회원가입. 서버에서 가입을 허용할 때만 쓸 수 있다 (운영 정책 확정 전에는 시스템 관리자가 계정을 만든다) */
export default function SignupPage() {
  const nav = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ loginId: '', password: '', password2: '', name: '', phone: '', teamId: null as ID | null, position: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    fetchAuthOptions().then(o => setEnabled(o.signupEnabled)).catch(() => setEnabled(false));
    fetchTeams().then(setTeams).catch(() => toast('팀 목록을 불러오지 못했어요.', 'err'));
  }, []);
  if (enabled === false) return <Navigate to="/login" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) return toast('비밀번호가 일치하지 않아요.', 'err');
    const { password2: _skip, ...form } = f;
    setBusy(true);
    const ok = await run(() => signup(form), '가입이 완료됐어요.');
    setBusy(false);
    if (ok) nav('/');
  };
  return (
    <AuthShell title="회원가입">
      <form onSubmit={submit} className="stack">
        <Field label="이메일"><input type="email" placeholder="name@company.com" value={f.loginId} onChange={set('loginId')} required /></Field>
        <Field label="비밀번호" hint="8자 이상"><input type="password" minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" required /></Field>
        <Field label="비밀번호 확인"><input type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" required /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} required /></Field>
        <Field label="회사 팀"><TeamSelect teams={teams} value={f.teamId} onChange={teamId => setF({ ...f, teamId })} /></Field>
        <Field label="직위 (선택)"><input placeholder="예: 팀장, 선임" value={f.position} onChange={set('position')} /></Field>
        <button className="btn primary solid block" disabled={busy}>{busy ? '가입 중…' : '가입하기'}</button>
      </form>
      <div className="auth-links"><Link to="/login">로그인으로 돌아가기</Link></div>
    </AuthShell>
  );
}
