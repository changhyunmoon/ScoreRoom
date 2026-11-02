// 결과 현황: 발표 구성원 한 명씩 인원·합계·평균·순위.
// - 룸 운영자: 평가자별 점수·피드백과 평가자별 점수표까지
// - 전체 열람 권한자: 인원·평균·순위만 (누가 몇 점을 줬는지와 피드백은 못 봄)
// 일반 참여자는 결과를 볼 수 없다 (목업 API도 집계를 이 두 경우에만 보낸다).
import { Link, Navigate, useParams } from 'react-router-dom';
import { BoardHead, ProjectShell } from './ProjectShell';
import { ResultTab } from './Admin';
import { Empty, useMe } from '../ui';
import { roomAccess } from '../logic';

export default function ResultsPage() {
  const { pid } = useParams();
  const { db, me } = useMe();
  const project = db.projects.find(p => p.id === pid);
  if (!project || !me) return <Navigate to="/" replace />;
  const access = roomAccess(db, project.id, me);
  // 결과는 룸 운영자와 전체 열람 권한자만 본다 (참여자이면서 열람 권한이 있으면 집계만)
  const allowed = access === 'admin' || me.canViewAll;
  if (!allowed) return <Empty icon="lock">룸 운영자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  return (
    <ProjectShell project={project} current="results">
      <BoardHead title="결과 현황" />
      <ResultTab project={project} detail={access === 'admin'} />
    </ProjectShell>
  );
}
