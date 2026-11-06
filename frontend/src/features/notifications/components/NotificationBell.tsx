// 우측 상단 알림: 평가룸 초대, 발표 등록 요청. 수락·거절 없이 확인만 하고, 누르면 관련 화면으로 간다
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import { mutate, useSession } from '../../session';
import { markAllNotificationsRead } from '../api/notifications.api';
import type { Notification } from '../model/types';

function message(n: Notification) {
  const who = <b>{n.actorName || '룸 관리자'}</b>;
  if (n.type === 'PRESENTATION_REQUESTED') return <>{who}님이 <b>{n.projectName}</b> 평가룸에 발표를 등록해 달라고 요청했어요.</>;
  return <>{who}님이 <b>{n.projectName}</b> 평가룸에 초대했어요.</>;
}

/** 알림을 누르면 갈 곳: 발표 등록 요청은 발표 등록 화면, 초대는 그 평가룸 */
const targetOf = (n: Notification) => (n.type === 'PRESENTATION_REQUESTED' ? `/p/${n.projectId}/pres/new` : `/p/${n.projectId}`);

export function NotificationBell() {
  const { db } = useSession();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const list = db.notifications;
  const unread = list.filter(n => n.readAt === null).length;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    // 목록을 열면 모두 읽음으로 표시한다. 열려 있는 동안은 안 읽음 강조를 그대로 둔다 (다시 받은 데이터로 바뀜)
    if (next && unread > 0) mutate(markAllNotificationsRead()).catch(() => undefined);
  };
  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button className="bell-btn" onClick={toggle} aria-label={`알림 ${unread}개 안 읽음`} aria-expanded={open}>
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      {open && (
        <div className="menu notice-menu">
          <div className="menu-head"><b>알림</b><small>초대 · 발표 등록 요청</small></div>
          {list.length === 0 && <p className="notice-empty muted small">새 알림이 없어요.</p>}
          {list.map(n => (
            <button key={n.id} className={`notice-item ${n.readAt === null ? 'unread' : ''}`}
              onClick={() => { setOpen(false); nav(targetOf(n)); }}>
              <span>{message(n)}</span>
              <small className="muted">{timeText(n.createdAt)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
