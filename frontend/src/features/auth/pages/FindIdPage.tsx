import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field, run } from '../../../shared/ui';
import { findLoginIds } from '../api/auth.api';
import { AuthShell } from '../components/AuthShell';

/** 이메일 찾기: 이름과 전화번호로 찾고, 이메일은 일부를 가려서 보여준다 */
export default function FindIdPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await run(async () => setResult(await findLoginIds(name, phone)));
    setBusy(false);
  };
  return (
    <AuthShell title="이메일 찾기">
      <form className="stack" onSubmit={submit}>
        <Field label="이름 (실명)"><input value={name} onChange={e => setName(e.target.value)} required /></Field>
        <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={phone} onChange={e => setPhone(e.target.value)} required /></Field>
        <button className="btn primary solid block" disabled={busy}>{busy ? '찾는 중…' : '찾기'}</button>
      </form>
      {result && (
        <div className="result-box" role="status">
          {result.length ? <>가입된 이메일: {result.map(r => <b key={r} className="mono"> {r}</b>)}</> : '일치하는 계정이 없어요.'}
        </div>
      )}
      <div className="auth-links"><Link to="/login">로그인</Link><span>·</span><Link to="/find-pw">비밀번호 찾기</Link></div>
    </AuthShell>
  );
}
