// 개인정보 수정 팝업. 오른쪽 위 계정 메뉴에서 연다
import { useState } from 'react';
import { Field, Popup, run, toast } from '../../../shared/ui';
import { teamName, TeamSelect } from '../../organization';
import { mutate, useSession } from '../../session';
import { updateProfile } from '../api/profile.api';

export function ProfilePopup({ onClose }: { onClose: () => void }) {
  const { db, me } = useSession();
  const [f, setF] = useState({
    loginId: me?.loginId ?? '', name: me?.name ?? '', phone: me?.phone ?? '', teamId: me?.teamId ?? null, position: me?.position ?? '',
    currentPassword: '', password: '', password2: '',
  });
  const [saving, setSaving] = useState(false);
  if (!me) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const changingPassword = f.password !== '' || f.password2 !== '';
  const mismatch = f.password2 !== '' && f.password !== f.password2;
  const save = async () => {
    if (changingPassword && f.password !== f.password2) return toast('새 비밀번호가 일치하지 않습니다.', 'err');
    if (changingPassword && !f.currentPassword) return toast('현재 비밀번호를 입력해 주세요.', 'err');
    setSaving(true);
    const ok = await run(() => mutate(updateProfile({
      loginId: f.loginId, name: f.name, phone: f.phone, teamId: f.teamId, position: f.position,
      ...(changingPassword ? { currentPassword: f.currentPassword, newPassword: f.password } : {}),
    })), changingPassword ? '저장했습니다. 다른 기기의 로그인은 끊겼어요.' : '저장했습니다.');
    setSaving(false);
    if (ok) onClose();
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
        <button type="button" className="btn primary solid" disabled={mismatch || saving} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
      </>}>
      <section className="profile-section">
        <h3>기본 정보</h3>
        <div className="portal-form">
          <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="이메일" hint="로그인할 때 쓰는 주소예요."><input type="email" value={f.loginId} onChange={set('loginId')} /></Field>
          <Field label="전화번호"><input inputMode="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} /></Field>
          {!me.isSysAdmin && (
            <Field label="회사 팀" hint="이미 참여한 평가룸의 소속은 참여 당시 팀으로 유지돼요.">
              <TeamSelect teams={db.teams} value={f.teamId} onChange={teamId => setF({ ...f, teamId })} />
            </Field>
          )}
          {!me.isSysAdmin && <Field label="직위"><input placeholder="예: 팀장, 선임" value={f.position} onChange={set('position')} /></Field>}
        </div>
      </section>
      <section className="profile-section">
        <h3>비밀번호 변경 <small className="muted">바꿀 때만 입력하세요</small></h3>
        <div className="portal-form">
          <Field label="현재 비밀번호"><input type="password" autoComplete="current-password" value={f.currentPassword} onChange={set('currentPassword')} /></Field>
          <Field label="새 비밀번호" hint="8자 이상"><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
          <Field label="새 비밀번호 확인" hint={mismatch ? <span className="err-text">새 비밀번호와 일치하지 않아요.</span> : f.password2 && f.password === f.password2 ? <span className="ok-text">일치해요.</span> : undefined}>
            <input type="password" autoComplete="new-password" className={mismatch ? 'invalid' : ''} value={f.password2} onChange={set('password2')} />
          </Field>
        </div>
      </section>
    </Popup>
  );
}
