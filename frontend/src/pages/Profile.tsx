import { useState } from 'react';
import { Link } from 'react-router-dom';
import { updateProfile } from '../store';
import { teamName } from '../logic';
import { Icon } from '../icons';
import { Field, run, toast, useMe } from '../ui';
import { TeamSelect } from './Auth';
import { BoardHead } from './ProjectShell';

export default function Profile() {
  const { db, me } = useMe();
  const [f, setF] = useState({ loginId: me?.loginId ?? '', name: me?.name ?? '', phone: me?.phone ?? '', teamId: me?.teamId ?? null, password: '', password2: '' });
  if (!me) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    if (f.password && f.password !== f.password2) return toast('새 비밀번호가 일치하지 않습니다.', 'err');
    if (run(() => updateProfile(me.id, { ...f, password: f.password || undefined }), '저장했습니다.')) setF({ ...f, password: '', password2: '' });
  };
  return (
    <div className="board profile-board">
      <aside className="lnb">
        <div className="lnb-head"><h2 className="lnb-title">환경설정</h2></div>
        <div className="lnb-group">
          <div className="lnb-group-head"><Icon name="down" size={14} />개인정보 관리</div>
          <ul className="lnb-list"><li><Link to="/me" className="on"><span>개인정보</span></Link></li></ul>
        </div>
        <Link to={me.isSysAdmin ? '/sys' : '/'} className="lnb-back"><Icon name="back" size={14} />메인 화면</Link>
      </aside>
      <div className="board-main">
        <BoardHead title="개인정보" desc="이름, 아이디, 전화번호와 소속 팀을 변경할 수 있습니다." />
        <div className="profile-summary">
          <span className="profile-avatar large">{me.name.slice(0, 1)}</span>
          <dl><div><dt>이름</dt><dd>{me.name}</dd></div><div><dt>아이디</dt><dd>{me.loginId}</dd></div><div><dt>소속 팀</dt><dd>{me.isSysAdmin ? '시스템 관리자' : teamName(db, me.teamId)}</dd></div></dl>
        </div>
        <div className="portal-form profile-form">
          <Field label="이름 (실명)"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="아이디"><input value={f.loginId} onChange={set('loginId')} /></Field>
          <Field label="전화번호"><input inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
          {!me.isSysAdmin && (
            <Field label="회사 팀" hint="이미 입장한 평가룸에는 참여 당시 팀이 그대로 유지됩니다.">
              <TeamSelect value={f.teamId} onChange={teamId => setF({ ...f, teamId })} />
            </Field>
          )}
          <Field label="새 비밀번호" hint="변경할 때만 입력하세요."><input type="password" value={f.password} onChange={set('password')} /></Field>
          <Field label="새 비밀번호 확인"><input type="password" value={f.password2} onChange={set('password2')} /></Field>
        </div>
        <div className="form-actions"><Link to={me.isSysAdmin ? '/sys' : '/'} className="btn">취소</Link><button className="btn primary solid" onClick={save}>저장</button></div>
      </div>
    </div>
  );
}
