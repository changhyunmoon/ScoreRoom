import { useState } from 'react';
import { HashRouter, Link, matchPath, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { logout } from './store';
import { teamName } from './logic';
import { Toaster, useMe } from './ui';
import { Icon } from './icons';
import { FindId, FindPw, Login, Signup } from './pages/Auth';
import ProjectList from './pages/ProjectList';
import Profile from './pages/Profile';
import SysAdmin from './pages/SysAdmin';
import OrgDirectory from './pages/OrgDirectory';
import ProjectHome from './pages/ProjectHome';
import PresentationForm from './pages/PresentationForm';
import AdminPage from './pages/Admin';

function Layout() {
  const { db, me } = useMe();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  if (!me) return <Navigate to="/login" replace />;
  // 시스템 관리자는 시스템 관리·개인정보 화면만 사용한다
  if (me.isSysAdmin && pathname !== '/sys' && pathname !== '/me') return <Navigate to="/sys" replace />;

  const inProject = !!matchPath('/p/:pid/*', pathname);
  const team = me.isSysAdmin ? '시스템 관리자' : teamName(db, me.teamId);

  return (
    <div className="app">
      <header className="gnb">
        <div className="gnb-top">
          <Link to={me.isSysAdmin ? '/sys' : '/'} className="brand"><span className="brand-mark" aria-hidden="true" />Score<b>Room</b></Link>
          <div className="menu-wrap">
            <button className="avatar-btn" onClick={() => setOpen(o => !o)} aria-label="계정 메뉴">
              <span className="avatar">{me.name.slice(0, 1)}</span>
              <span className="user-label"><b>{me.name}</b><span className="hide-sm">({team})</span></span>
              <Icon name="down" size={14} />
            </button>
            {open && (
              <div className="menu" onClick={() => setOpen(false)}>
                <div className="menu-head"><b>{me.name}</b><small>{me.loginId} · {team}</small></div>
                <Link to="/me"><Icon name="user" size={16} />개인정보 수정</Link>
                <button onClick={() => setDirectoryOpen(true)}><Icon name="tree" size={16} />회사 팀 구조도</button>
                <button onClick={() => { logout(); nav('/login'); }}><Icon name="logout" size={16} />로그아웃</button>
              </div>
            )}
          </div>
        </div>
        <nav className="gnb-menu">
          <Link to={me.isSysAdmin ? '/sys' : '/'} className="portal-home-link" aria-label="메인 화면"><span className="app-grid" aria-hidden="true"><i /><i /><i /><i /></span></Link>
          {me.isSysAdmin
            ? <NavLink to="/sys">시스템 관리</NavLink>
            : <NavLink to="/" className={() => (pathname === '/' || inProject ? 'active' : '')}>발표 평가</NavLink>}
          <span className="gnb-caption">사내 발표 평가</span>
        </nav>
      </header>
      <main className="container"><Outlet /></main>
      <footer className="portal-footer"><span><Icon name="mic" size={13} /><b>ScoreRoom</b><span className="hide-sm">사내 발표 평가 서비스</span></span><span>{me.name}<span className="hide-sm"> · {team}</span></span></footer>
      {directoryOpen && <OrgDirectory onClose={() => setDirectoryOpen(false)} />}
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
          <Route path="/me" element={<Profile />} />
          <Route path="/sys" element={<SysAdmin />} />
          <Route path="/p/:pid" element={<ProjectHome />} />
          <Route path="/p/:pid/pres/new" element={<PresentationForm />} />
          <Route path="/p/:pid/pres/:prid" element={<PresentationForm />} />
          <Route path="/p/:pid/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}
