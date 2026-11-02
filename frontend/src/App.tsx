import { useState } from 'react';
import { HashRouter, Link, matchPath, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { acceptInvitation, declineInvitation, logout } from './store';
import { teamName, timeText } from './logic';
import { run, Toaster, useMe } from './ui';
import { Icon } from './icons';
import { FindId, FindPw, Login, Signup } from './pages/Auth';
import ProjectList from './pages/ProjectList';
import ProfilePopup from './pages/Profile';
import SysAdmin from './pages/SysAdmin';
import OrgDirectory from './pages/OrgDirectory';
import ProjectHome from './pages/ProjectHome';
import PresentationForm from './pages/PresentationForm';
import AdminPage from './pages/Admin';
import ResultsPage from './pages/Results';
import SysViewers from './pages/SysViewers';

/** 우측 상단 알림: 받은 평가룸 초대. 참여하면 그 평가룸으로 바로 간다 */
function Notifications() {
  const { db, me } = useMe();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = db.invitations.filter(i => i.inviteeId === me!.id).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="menu-wrap">
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
                  run(async () => { pid = await acceptInvitation(i.id); }, `'${i.projectName}'에 참여했습니다.`)
                    .then(ok => { if (ok) { setOpen(false); nav(`/p/${pid}`); } });
                }}>참여</button>
                <button className="btn sm ghost" onClick={() => run(() => declineInvitation(i.id), '초대를 거절했습니다.')}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Layout() {
  const { db, me, status } = useMe();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  if (status === 'loading') return <div className="boot-loading">불러오는 중…</div>;
  if (!me) return <Navigate to="/login" replace />;
  // 시스템 관리자는 시스템 관리(/sys, /sys/viewers) 화면만 사용한다 (개인정보는 팝업)
  if (me.isSysAdmin && !pathname.startsWith('/sys')) return <Navigate to="/sys" replace />;

  const inProject = !!matchPath('/p/:pid/*', pathname);
  const team = me.isSysAdmin ? '시스템 관리자' : teamName(db, me.teamId);

  return (
    <div className="app">
      <header className="gnb">
        <div className="gnb-top">
          <Link to={me.isSysAdmin ? '/sys' : '/'} className="brand"><span className="brand-mark" aria-hidden="true" />Score<b>Room</b></Link>
          <div className="gnb-right">
          {!me.isSysAdmin && <Notifications />}
          <div className="menu-wrap">
            <button className="avatar-btn" onClick={() => setOpen(o => !o)} aria-label="계정 메뉴">
              <span className="avatar">{me.name.slice(0, 1)}</span>
              <span className="user-label"><b>{me.name}</b><span className="hide-sm">({team})</span></span>
              <Icon name="down" size={14} />
            </button>
            {open && (
              <div className="menu" onClick={() => setOpen(false)}>
                <div className="menu-head"><b>{me.name}</b><small>{me.loginId} · {team}</small></div>
                <button onClick={() => setProfileOpen(true)}><Icon name="user" size={16} />개인정보 수정</button>
                <button onClick={() => setDirectoryOpen(true)}><Icon name="tree" size={16} />회사 팀 구조도</button>
                <button onClick={() => { logout().then(() => nav('/login')); }}><Icon name="logout" size={16} />로그아웃</button>
              </div>
            )}
          </div>
          </div>
        </div>
        <nav className="gnb-menu">
          <Link to={me.isSysAdmin ? '/sys' : '/'} className="portal-home-link" aria-label="메인 화면"><span className="app-grid" aria-hidden="true"><i /><i /><i /><i /></span></Link>
          {me.isSysAdmin
            ? <><NavLink to="/sys" end>회사 팀 구조도</NavLink><NavLink to="/sys/viewers">전체 열람 권한</NavLink></>
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

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/find-id" element={<FindId />} />
        <Route path="/find-pw" element={<FindPw />} />
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectList />} />
          <Route path="/sys" element={<SysAdmin />} />
          <Route path="/sys/viewers" element={<SysViewers />} />
          <Route path="/p/:pid" element={<ProjectHome />} />
          <Route path="/p/:pid/pres/new" element={<PresentationForm />} />
          <Route path="/p/:pid/pres/:prid" element={<PresentationForm />} />
          <Route path="/p/:pid/results" element={<ResultsPage />} />
          <Route path="/p/:pid/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      <div className="mock-tag" title="데이터는 이 브라우저에 저장됩니다.">목업 모드</div>
    </HashRouter>
  );
}
