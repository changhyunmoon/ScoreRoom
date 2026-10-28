import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { findIds, login, loginAs, resetMock, resetPassword, signup, type DB, type ID } from '../store';
import { Field, run, toast, useMe } from '../ui';
import { teamName } from '../logic';
import { Icon } from '../icons';

/** 상하 관계를 들여쓰기로 보여주는 팀 선택 */
export function teamOptions(db: DB) {
  const out: { id: ID; label: string }[] = [];
  const walk = (parent: ID | null, depth: number) =>
    db.teams.filter(t => t.parentId === parent).forEach(t => { out.push({ id: t.id, label: `${'　'.repeat(depth)}${depth ? '└ ' : ''}${t.name}` }); walk(t.id, depth + 1); });
  walk(null, 0);
  return out;
}
export function TeamSelect({ value, onChange, allowEmpty }: { value: ID | null; onChange: (v: ID | null) => void; allowEmpty?: boolean }) {
  const { db } = useMe();
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      <option value="" disabled={!allowEmpty}>{allowEmpty ? '소속 없음' : '팀을 선택하세요'}</option>
      {teamOptions(db).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

/** 왼쪽 소개 영역 + 오른쪽 폼 영역으로 나뉜 계정 화면 (모바일은 폼만) */
function AuthShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-visual">
        <div className="av-brand">Score<b>Room</b></div>
        <div className="av-copy">
          <h2>발표는 집중해서,<br />평가는 간편하게.</h2>
          <p>사내 발표를 실시간으로 평가하고<br />결과를 한눈에 확인하세요.</p>
        </div>
        <div className="av-cards" aria-hidden="true">
          <div className="av-card live"><span className="live-dot" />지금 발표 중 · 디자인 시스템 2.0</div>
          <div className="av-card"><Icon name="star" size={18} /> 내 점수 <b>81</b> / 100</div>
          <div className="av-card"><Icon name="chart" size={18} /> 평균 <b>72.75</b> · 평가 4명</div>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-inner">
          <div className="brand big center">Score<b>Room</b></div>
          {title && <h1 className="auth-title">{title}</h1>}
          {children}
        </div>
        <p className="auth-foot">사내 발표 평가 서비스 · 문의는 시스템 관리자에게</p>
      </section>
    </div>
  );
}

export function Login() {
  const { db, me } = useMe();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  if (me) return <Navigate to="/" replace />;
  const submit = (e: FormEvent) => { e.preventDefault(); if (run(() => login(id, pw))) nav('/'); };
  return (
    <AuthShell>
      <form onSubmit={submit} className="stack auth-form">
        <input className="auth-input" placeholder="아이디" aria-label="아이디" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
        <input className="auth-input" type="password" placeholder="비밀번호" aria-label="비밀번호" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        <div className="auth-links left">
          <Link to="/find-id">[아이디 찾기]</Link><span className="sep" /><Link to="/find-pw">[비밀번호 찾기]</Link>
        </div>
        <button className="btn dark block auth-btn">로그인</button>
        <Link to="/signup" className="btn block auth-btn sub">회원가입</Link>
      </form>
      <div className="demo-box">
        <div className="demo-title">시안 체험용 빠른 로그인 <small>(비밀번호 모두 1234)</small></div>
        <div className="demo-users">
          {db.users.map(u => (
            <button key={u.id} className="demo-user" onClick={() => { loginAs(u.id); nav('/'); }}>
              <b>{u.name}</b><small>{u.isSysAdmin ? '시스템 관리자' : teamName(db, u.teamId)}</small>
            </button>
          ))}
        </div>
        <p className="hint">탭마다 다른 계정으로 로그인할 수 있어요. 룸 운영자 결과 화면을 한 탭에 열어두고 다른 탭에서 평가하면 실시간으로 반영됩니다.</p>
        <button className="btn ghost sm" onClick={() => { resetMock(); toast('목업 데이터를 초기화했습니다.'); }}>목업 데이터 초기화</button>
      </div>
    </AuthShell>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [f, setF] = useState({ loginId: '', password: '', password2: '', name: '', phone: '', teamId: null as ID | null });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) return toast('비밀번호가 일치하지 않습니다.', 'err');
    if (run(() => signup(f), '가입이 완료되었습니다.')) nav('/');
  };
  return (
    <AuthShell title="회원가입">
      <form onSubmit={submit} className="stack">
        <Field label="아이디"><input value={f.loginId} onChange={set('loginId')} /></Field>
        <Field label="비밀번호"><input type="password" value={f.password} onChange={set('password')} /></Field>
        <Field label="비밀번호 확인"><input type="password" value={f.password2} onChange={set('password2')} /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="회사 팀" hint="평가룸에 입장하면 이 팀이 자동으로 적용됩니다."><TeamSelect value={f.teamId} onChange={teamId => setF({ ...f, teamId })} /></Field>
        <button className="btn primary solid block">가입하기</button>
      </form>
      <div className="auth-links"><Link to="/login">로그인으로 돌아가기</Link></div>
    </AuthShell>
  );
}

export function FindId() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<string[] | null>(null);
  return (
    <AuthShell title="아이디 찾기">
      <form className="stack" onSubmit={e => { e.preventDefault(); setResult(findIds(name, phone)); }}>
        <Field label="이름 (실명)"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="전화번호"><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <button className="btn primary solid block">찾기</button>
      </form>
      {result && (
        <div className="result-box">
          {result.length ? <>가입된 아이디: {result.map(r => <b key={r} className="mono"> {r}</b>)}</> : '일치하는 계정이 없습니다.'}
        </div>
      )}
      <div className="auth-links"><Link to="/login">로그인</Link><span>·</span><Link to="/find-pw">비밀번호 찾기</Link></div>
    </AuthShell>
  );
}

export function FindPw() {
  const nav = useNavigate();
  const [f, setF] = useState({ loginId: '', name: '', phone: '', pw: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthShell title="비밀번호 재설정">
      <form className="stack" onSubmit={e => { e.preventDefault(); if (run(() => resetPassword(f.loginId, f.name, f.phone, f.pw), '비밀번호를 변경했습니다.')) nav('/login'); }}>
        <Field label="아이디"><input value={f.loginId} onChange={set('loginId')} /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="전화번호"><input inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="새 비밀번호" hint="기존 비밀번호는 보여주지 않고 새로 설정합니다."><input type="password" value={f.pw} onChange={set('pw')} /></Field>
        <button className="btn primary solid block">재설정</button>
      </form>
      <div className="auth-links"><Link to="/login">로그인</Link><span>·</span><Link to="/find-id">아이디 찾기</Link></div>
    </AuthShell>
  );
}
