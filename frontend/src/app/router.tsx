// 화면 경로 (BrowserRouter: 주소가 /p/... 그대로 보인다).
// 새로 고침·직접 접속을 위해 Nginx는 /api 밖의 모든 경로에 index.html을 돌려준다 (deploy/nginx/scoreroom.conf)
import { Navigate, Route, Routes } from 'react-router-dom';
import FindIdPage from '../features/auth/pages/FindIdPage';
import FindPasswordPage from '../features/auth/pages/FindPasswordPage';
import LoginPage from '../features/auth/pages/LoginPage';
import SignupPage from '../features/auth/pages/SignupPage';
import SysOrgPage from '../features/organization/pages/SysOrgPage';
import SysCreatorsPage from '../features/organization/pages/SysCreatorsPage';
import SysRoomsPage from '../features/organization/pages/SysRoomsPage';
import SysViewersPage from '../features/organization/pages/SysViewersPage';
import PresentationFormPage from '../features/presentations/pages/PresentationFormPage';
import PresentationListPage from '../features/presentations/pages/PresentationListPage';
import ProjectListPage from '../features/projects/pages/ProjectListPage';
import RoomAdminPage from '../features/projects/pages/RoomAdminPage';
import ResultsPage from '../features/results/pages/ResultsPage';
import { RequireAuth, RequireSysAdmin } from './guards/RequireAuth';
import { AppLayout } from './layouts/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/find-id" element={<FindIdPage />} />
      <Route path="/find-pw" element={<FindPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProjectListPage />} />
          <Route element={<RequireSysAdmin />}>
            <Route path="/sys" element={<SysOrgPage />} />
            <Route path="/sys/viewers" element={<SysViewersPage />} />
            <Route path="/sys/creators" element={<SysCreatorsPage />} />
            <Route path="/sys/rooms" element={<SysRoomsPage />} />
          </Route>
          <Route path="/p/:pid" element={<PresentationListPage />} />
          <Route path="/p/:pid/pres/new" element={<PresentationFormPage />} />
          <Route path="/p/:pid/pres/:prid" element={<PresentationFormPage />} />
          <Route path="/p/:pid/results" element={<ResultsPage />} />
          <Route path="/p/:pid/admin" element={<RoomAdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
