import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { demoAccounts, findIds, loadPublicTeams, login, loginAs, resetDemo, resetPassword, signup, type DB, type DemoAccount, type ID } from '../store';
import { Field, run, toast, useMe } from '../ui';
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
          <p>사내 발표를 바로 평가하고<br />결과를 한눈에 확인하세요.</p>
        </div>
        <div className="av-cards" aria-hidden="true">
          <div className="av-card"><Icon name="paperclip" size={18} /> 디자인 시스템 2.0 · 발표 자료</div>
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
  const { me } = useMe();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  if (me) return <Navigate to="/" replace />;
  const submit = (e: FormEvent) => { e.preventDefault(); run(() => login(id, pw)).then(ok => ok && nav('/')); };
  return (
    <AuthShell>
      <form onSubmit={submit} className="stack auth-form">
        <input className="auth-input" type="email" placeholder="이메일" aria-label="이메일" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
        <input className="auth-input" type="password" placeholder="비밀번호" aria-label="비밀번호" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        <div className="auth-links left">
          <Link to="/find-id">[이메일 찾기]</Link><span className="sep" /><Link to="/find-pw">[비밀번호 찾기]</Link>
        </div>
        <button className="btn dark block auth-btn">로그인</button>
        <Link to="/signup" className="btn block auth-btn sub">회원가입</Link>
      </form>
      <MockLogin />
    </AuthShell>
  );
}

/** 계정 빠른 전환과 브라우저 목업 데이터 초기화 */
function MockLogin() {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  useEffect(() => { demoAccounts().then(setAccounts).catch(() => setAccounts([])); }, []);
  return (
    <div className="demo-box">
      <div className="demo-title">목업 모드 빠른 로그인 <small>(비밀번호 모두 1234)</small></div>
      <div className="demo-users">
        {accounts.map(u => (
          <button key={u.id} className="demo-user" onClick={() => { run(() => loginAs(u.id)).then(ok => ok && nav('/')); }}>
            <b>{u.name}</b><small>{u.isSysAdmin ? '시스템 관리자' : u.teamName ?? '소속 없음'}</small>
          </button>
        ))}
      </div>
      <button className="btn ghost sm" onClick={() => { run(resetDemo, '목업 데이터를 처음 상태로 되돌렸습니다.').then(() => demoAccounts().then(setAccounts)); }}>목업 데이터 초기화</button>
    </div>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [f, setF] = useState({ loginId: '', password: '', password2: '', name: '', phone: '', teamId: null as ID | null, position: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  useEffect(() => { loadPublicTeams().catch(() => toast('팀 목록을 불러오지 못했습니다.', 'err')); }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) return toast('비밀번호가 일치하지 않습니다.', 'err');
    const { password2: _skip, ...form } = f;
    run(() => signup(form), '가입이 완료되었습니다.').then(ok => ok && nav('/'));
  };
  return (
    <AuthShell title="회원가입">
      <form onSubmit={submit} className="stack">
        <Field label="이메일"><input type="email" placeholder="name@company.com" value={f.loginId} onChange={set('loginId')} /></Field>
        <Field label="비밀번호"><input type="password" value={f.password} onChange={set('password')} /></Field>
        <Field label="비밀번호 확인"><input type="password" value={f.password2} onChange={set('password2')} /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="회사 팀"><TeamSelect value={f.teamId} onChange={teamId => setF({ ...f, teamId })} /></Field>
        <Field label="직위 (선택)"><input placeholder="예: 팀장, 선임" value={f.position} onChange={set('position')} /></Field>
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
    <AuthShell title="이메일 찾기">
      <form className="stack" onSubmit={e => { e.preventDefault(); run(async () => setResult(await findIds(name, phone))); }}>
        <Field label="이름 (실명)"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="전화번호"><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <button className="btn primary solid block">찾기</button>
      </form>
      {result && (
        <div className="result-box">
          {result.length ? <>가입된 이메일: {result.map(r => <b key={r} className="mono"> {r}</b>)}</> : '일치하는 계정이 없습니다.'}
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
      <form className="stack" onSubmit={e => { e.preventDefault(); run(() => resetPassword(f.loginId, f.name, f.phone, f.pw), '비밀번호를 변경했습니다.').then(ok => ok && nav('/login')); }}>
        <Field label="이메일"><input type="email" value={f.loginId} onChange={set('loginId')} /></Field>
        <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="전화번호"><input inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="새 비밀번호"><input type="password" value={f.pw} onChange={set('pw')} /></Field>
        <button className="btn primary solid block">재설정</button>
      </form>
      <div className="auth-links"><Link to="/login">로그인</Link><span>·</span><Link to="/find-id">이메일 찾기</Link></div>
    </AuthShell>
  );
}
