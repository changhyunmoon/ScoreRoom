// 룸 운영: 요약과 탭 (발표 관리 / 초대·입장 코드 / 참여자 / 설정). 탭은 ?tab= 으로 주소에 남는다
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useNow } from '../../../shared/hooks/useNow';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import { mmss, timeText } from '../../../shared/lib/format';
import { BoardHead, Empty } from '../../../shared/ui';
import { presentationsOf } from '../../presentations';
import { useSession } from '../../session';
import { InviteTab, inviteState } from '../components/admin/InviteTab';
import { MembersTab } from '../components/admin/MembersTab';
import { RunTab } from '../components/admin/RunTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { ProjectShell, RoomNotFound } from '../components/ProjectShell';
import { members, membership } from '../model/access';

type Tab = 'run' | 'invite' | 'members' | 'settings';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'run', label: '발표 관리', icon: 'mic' },
  { key: 'invite', label: '초대·입장 코드', icon: 'ticket' },
  { key: 'members', label: '참여자', icon: 'users' },
  { key: 'settings', label: '설정', icon: 'sliders' },
];

export default function RoomAdminPage() {
  const { pid } = useParams();
  const { db, me } = useSession();
  const [sp] = useSearchParams();
  const now = useNow();
  const tabParam = sp.get('tab');
  const tab: Tab = TABS.some(t => t.key === tabParam) ? tabParam as Tab : 'run';
  const project = db.projects.find(p => p.id === pid);
  if (!project || !me) return <RoomNotFound />;
  // 예전 '결과 보기' 탭은 결과 현황 페이지로 합쳤다
  if (tabParam === 'result') return <Navigate to={`/p/${project.id}/results`} replace />;
  const m = membership(db, project.id, me.id);
  if (!m?.isAdmin) return <Empty icon="lock">룸 운영자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  const list = presentationsOf(db, project.id);
  const sums = db.summaries.filter(x => list.some(p => p.id === x.presentationId));
  const scored = sums.reduce((a, x) => a + x.scored, 0);
  const eligible = sums.reduce((a, x) => a + x.eligible, 0);
  const inv = inviteState(project, now);
  const active = TABS.find(t => t.key === tab)!;

  return (
    <ProjectShell project={project} current={`admin-${tab}`}>
      <BoardHead title={active.label} />

      {project.status === 'CLOSED' && <div className="notice"><Icon name="flag" size={16} />{project.closedAt && timeText(project.closedAt)}에 마감된 평가룸이에요.</div>}

      <div className="overview">
        <div className="ov"><span className="ov-label"><Icon name="mic" size={14} />발표</span><b className="ov-value">{list.length}개</b></div>
        <div className="ov"><span className="ov-label"><Icon name="check" size={14} />평가 제출</span><b className="ov-value">{scored} / {eligible}</b></div>
        <div className="ov"><span className="ov-label"><Icon name="users" size={14} />참여자</span><b className="ov-value">{members(db, project.id).length}명</b></div>
        <div className="ov"><span className="ov-label"><Icon name="ticket" size={14} />입장 코드</span>
          <b className={`ov-value ${inv === 'ACTIVE' ? 'ok' : 'off'}`}>{inv === 'ACTIVE' ? (project.invite!.expiresAt === null ? '사용 중 · 무제한' : `사용 중 ${mmss(project.invite!.expiresAt - now)}`) : inv === 'REVOKED' ? '중지됨' : inv === 'EXPIRED' ? '만료됨' : '없음'}</b></div>
      </div>

      {tab === 'run' && <RunTab project={project} />}
      {tab === 'invite' && (project.status === 'CLOSED'
        ? <Empty icon="ticket">마감된 평가룸은 초대하거나 입장 코드를 발급할 수 없어요.</Empty>
        : <InviteTab project={project} />)}
      {tab === 'members' && <MembersTab project={project} />}
      {tab === 'settings' && <SettingsTab key={project.id} project={project} />}
    </ProjectShell>
  );
}
