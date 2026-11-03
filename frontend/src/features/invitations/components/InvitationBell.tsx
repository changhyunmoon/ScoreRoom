// 우측 상단 알림: 받은 평가룸 초대. 참여하면 그 평가룸으로 바로 간다
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import { run } from '../../../shared/ui';
import { mutate, useSession } from '../../session';
import { acceptInvitation, declineInvitation } from '../api/invitations.api';

export function InvitationBell() {
  const { db, me } = useSession();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const mine = db.invitations.filter(i => i.inviteeId === me!.id).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button className="bell-btn" onClick={() => setOpen(o => !o)} aria-label={`알림 ${mine.length}개`} aria-expanded={open}>
        <Icon name="bell" size={18} />
        {mine.length > 0 && <span className="bell-badge">{mine.length}</span>}
      </button>
      {open && (
        <div className="menu notice-menu">
          <div className="menu-head"><b>알림</b><small>평가룸 초대</small></div>
          {mine.length === 0 && <p className="notice-empty muted small">새 알림이 없어요.</p>}
          {mine.map(i => (
            <div key={i.id} className="notice-item">
              <div><b>{i.inviterName}</b>님이 <b>{i.projectName}</b>에 초대했어요.</div>
              <small className="muted">{timeText(i.createdAt)}</small>
              <div className="row gap-sm">
                <button className="btn sm primary solid" onClick={() => {
                  let pid = '';
                  run(async () => { pid = await mutate(acceptInvitation(i.id)); }, `'${i.projectName}'에 참여했습니다.`)
                    .then(ok => { if (ok) { setOpen(false); nav(`/p/${pid}`); } });
                }}>참여</button>
                <button className="btn sm ghost" onClick={() => run(() => mutate(declineInvitation(i.id)), '초대를 거절했습니다.')}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
