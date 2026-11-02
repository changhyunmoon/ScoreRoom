// 개인정보 수정 팝업. 오른쪽 위 계정 메뉴에서 연다 (회사 팀 구조도처럼).
import { useState } from 'react';
import { updateProfile } from '../store';
import { teamName } from '../logic';
import { Field, Popup, run, toast, useMe } from '../ui';
import { TeamSelect } from './Auth';

export default function ProfilePopup({ onClose }: { onClose: () => void }) {
  const { db, me } = useMe();
  const [f, setF] = useState({ loginId: me?.loginId ?? '', name: me?.name ?? '', phone: me?.phone ?? '', teamId: me?.teamId ?? null, position: me?.position ?? '', password: '', password2: '' });
  if (!me) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const mismatch = f.password2 !== '' && f.password !== f.password2;
  const save = () => {
    if ((f.password || f.password2) && f.password !== f.password2) return toast('새 비밀번호가 일치하지 않습니다.', 'err');
    const { password2: _skip, ...form } = f;
    run(() => updateProfile(me.id, { ...form, password: f.password || undefined }), '저장했습니다.').then(ok => ok && onClose());
  };
  return (
    <Popup label="개인정보 수정" onClose={onClose}
      head={<div className="profile-popup-head">
        <span className="profile-avatar">{me.name.slice(0, 1)}</span>
        <div>
          <h2>개인정보 수정</h2>
          <span className="muted small">{me.loginId} · {me.isSysAdmin ? '시스템 관리자' : teamName(db, me.teamId)}{me.position && ` · ${me.position}`}</span>
        </div>
      </div>}
      foot={<>
        <button type="button" className="btn" onClick={onClose}>취소</button>
        <button type="button" className="btn primary solid" disabled={mismatch} onClick={save}>저장</button>
      </>}>
      <section className="profile-section">
        <h3>기본 정보</h3>
        <div className="portal-form">
          <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="이메일" hint="로그인할 때 쓰는 주소예요."><input type="email" value={f.loginId} onChange={set('loginId')} /></Field>
          <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} /></Field>
          {!me.isSysAdmin && (
            <Field label="회사 팀">
              <TeamSelect value={f.teamId} onChange={teamId => setF({ ...f, teamId })} />
            </Field>
          )}
          {!me.isSysAdmin && <Field label="직위"><input placeholder="예: 팀장, 선임" value={f.position} onChange={set('position')} /></Field>}
        </div>
      </section>
      <section className="profile-section">
        <h3>비밀번호 변경 <small className="muted">바꿀 때만 입력하세요</small></h3>
        <div className="portal-form">
          <Field label="새 비밀번호"><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
          <Field label="새 비밀번호 확인" hint={mismatch ? <span className="err-text">새 비밀번호와 일치하지 않아요.</span> : f.password2 && f.password === f.password2 ? <span className="ok-text">일치해요.</span> : undefined}>
            <input type="password" autoComplete="new-password" className={mismatch ? 'invalid' : ''} value={f.password2} onChange={set('password2')} />
          </Field>
        </div>
      </section>
    </Popup>
  );
}
