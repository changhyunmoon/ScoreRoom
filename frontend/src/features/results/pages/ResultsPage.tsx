// 결과 현황: 발표 구성원 한 명씩 인원·합계·평균·순위.
// 룸 관리자와 전체 열람 권한자만 본다 (서버도 집계를 이 두 경우에만 보낸다). 일반 참여자는 볼 수 없다.
import { Link, useParams } from 'react-router-dom';
import { BoardHead, Empty } from '../../../shared/ui';
import { ProjectShell, RoomNotFound, roomAccess } from '../../projects';
import { useSession } from '../../session';
import { ResultBoard } from '../components/ResultBoard';

export default function ResultsPage() {
  const { pid } = useParams();
  const { db, me } = useSession();
  const project = db.projects.find(p => p.id === pid);
  if (!project || !me) return <RoomNotFound />;
  const access = roomAccess(db, project.id, me);
  // 참여자이면서 열람 권한이 있으면 집계만 본다
  const allowed = access === 'admin' || me.canViewAll;
  if (!allowed) return <Empty icon="lock">룸 관리자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  return (
    <ProjectShell project={project} current="results">
      <BoardHead title="결과 현황" />
      <ResultBoard project={project} detail={access === 'admin'} />
    </ProjectShell>
  );
}
