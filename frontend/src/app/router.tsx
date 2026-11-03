// 화면 경로. HashRouter라 실제 주소는 /#/p/... 로 보인다 (BrowserRouter 전환은 배포 설정과 함께 검토)
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage';
import SignupPage from '../features/auth/pages/SignupPage';
import SysOrgPage from '../features/organization/pages/SysOrgPage';
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
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProjectListPage />} />
          <Route element={<RequireSysAdmin />}>
            <Route path="/sys" element={<SysOrgPage />} />
            <Route path="/sys/viewers" element={<SysViewersPage />} />
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
