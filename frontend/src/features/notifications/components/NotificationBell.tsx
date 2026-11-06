// 우측 상단 알림: 평가룸에 초대됨 등. 수락·거절 없이 확인만 하고, 누르면 그 평가룸으로 간다
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import { mutate, useSession } from '../../session';
import { markAllNotificationsRead } from '../api/notifications.api';
import type { Notification } from '../model/types';

function message(n: Notification) {
  return <><b>{n.actorName || '룸 운영자'}</b>님이 <b>{n.projectName}</b> 평가룸에 초대했어요.</>;
}

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
          <div className="menu-head"><b>알림</b><small>평가룸 초대</small></div>
          {list.length === 0 && <p className="notice-empty muted small">새 알림이 없어요.</p>}
          {list.map(n => (
            <button key={n.id} className={`notice-item ${n.readAt === null ? 'unread' : ''}`}
              onClick={() => { setOpen(false); nav(`/p/${n.projectId}`); }}>
              <span>{message(n)}</span>
              <small className="muted">{timeText(n.createdAt)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
