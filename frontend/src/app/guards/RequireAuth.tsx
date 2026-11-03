import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../features/session';

/**
 * 로그인한 사람만 들어온다. 로그인 확인 중에는 로그인 화면과 보호 화면이 번갈아 보이지 않도록 로딩만 보여준다.
 * 시스템 관리자는 평가룸에 참여하지 않으므로 시스템 관리 화면(/sys)만 쓴다.
 */
export function RequireAuth() {
  const { me, status } = useSession();
  const { pathname } = useLocation();
  if (status === 'loading') return <div className="boot-loading">불러오는 중…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (me.isSysAdmin && !pathname.startsWith('/sys')) return <Navigate to="/sys" replace />;
  return <Outlet />;
}

/** 시스템 관리자 전용 화면 (서버도 같은 권한을 검사한다) */
export function RequireSysAdmin() {
  const { me } = useSession();
  if (!me?.isSysAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
