// 로그인 후 공통 틀: 상단 메뉴(알림, 계정 메뉴), 본문, 바닥글
import { useState } from 'react';
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDismiss } from '../../shared/hooks/useDismiss';
import { Icon } from '../../shared/icons/Icon';
import { run } from '../../shared/ui';
import { logout } from '../../features/auth';
import { NotificationBell } from '../../features/notifications';
import { OrgDirectory, teamName } from '../../features/organization';
import { ProfilePopup } from '../../features/profile';
import { useSession } from '../../features/session';

export function AppLayout() {
  const { db, me } = useSession();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  if (!me) return null;

  const inProject = !!matchPath('/p/:pid/*', pathname);
  const team = me.isSysAdmin ? '시스템 관리자' : teamName(db, me.teamId);
  const home = me.isSysAdmin ? '/sys' : '/';

  return (
    <div className="app">
      <header className="gnb">
        <div className="gnb-top">
          <Link to={home} className="brand"><span className="brand-mark" aria-hidden="true" />Score<b>Room</b></Link>
          <div className="gnb-right">
            {!me.isSysAdmin && <NotificationBell />}
            <div className="menu-wrap" ref={menuRef}>
              <button className="avatar-btn" onClick={() => setOpen(o => !o)} aria-label="계정 메뉴" aria-expanded={open}>
                <span className="avatar">{me.name.slice(0, 1)}</span>
                <span className="user-label"><b>{me.name}</b><span className="hide-sm">({team})</span></span>
                <Icon name="down" size={14} />
              </button>
              {open && (
                <div className="menu" onClick={() => setOpen(false)}>
                  <div className="menu-head"><b>{me.name}</b><small>{me.loginId} · {team}</small></div>
                  <button onClick={() => setProfileOpen(true)}><Icon name="user" size={16} />개인정보 수정</button>
                  <button onClick={() => setDirectoryOpen(true)}><Icon name="tree" size={16} />회사 팀 구조도</button>
                  <button onClick={() => { run(logout).then(ok => ok && nav('/login')); }}><Icon name="logout" size={16} />로그아웃</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="gnb-menu">
          <Link to={home} className="portal-home-link" aria-label="메인 화면"><span className="app-grid" aria-hidden="true"><i /><i /><i /><i /></span></Link>
          {me.isSysAdmin
            ? <><NavLink to="/sys" end>회사 팀 구조도</NavLink><NavLink to="/sys/viewers">전체 열람 권한</NavLink><NavLink to="/sys/creators">평가룸 생성 권한</NavLink><NavLink to="/sys/rooms">평가룸 관리</NavLink></>
            : <NavLink to="/" className={() => (pathname === '/' || inProject ? 'active' : '')}>발표 평가</NavLink>}
          <span className="gnb-caption">사내 발표 평가</span>
        </nav>
      </header>
      <main className="container"><Outlet /></main>
      <footer className="portal-footer"><span><Icon name="mic" size={13} /><b>ScoreRoom</b><span className="hide-sm">사내 발표 평가 서비스</span></span><span>{me.name}<span className="hide-sm"> · {team}</span></span></footer>
      {directoryOpen && <OrgDirectory onClose={() => setDirectoryOpen(false)} />}
      {profileOpen && <ProfilePopup onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
