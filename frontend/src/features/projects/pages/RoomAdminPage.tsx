// 룸 운영: 탭(초대·입장 코드 / 참여자 / 발표 관리 / 설정)과 탭마다 맞는 위쪽 요약. 탭은 ?tab= 으로 주소에 남는다
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useNow } from '../../../shared/hooks/useNow';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import { mmss, timeText } from '../../../shared/lib/format';
import { BoardHead, Empty } from '../../../shared/ui';
import { presentationOfUser, presentationsOf, presenterRoster } from '../../presentations';
import { useSession } from '../../session';
import { InviteTab, inviteState } from '../components/admin/InviteTab';
import { MembersTab } from '../components/admin/MembersTab';
import { RunTab } from '../components/admin/RunTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { ProjectShell, RoomNotFound } from '../components/ProjectShell';
import { members, membership } from '../model/access';

type Tab = 'run' | 'invite' | 'members' | 'settings';
/** 위쪽 요약 한 칸 */
type Ov = { icon: IconName; label: string; value: string; tone?: 'ok' | 'off' };
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'invite', label: '초대·입장 코드', icon: 'ticket' },
  { key: 'members', label: '참여자', icon: 'users' },
  { key: 'run', label: '발표 관리', icon: 'mic' },
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
  if (!m?.isAdmin) return <Empty icon="lock">룸 관리자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  const active = TABS.find(t => t.key === tab)!;
  const all = members(db, project.id);
  const admins = all.filter(x => x.isAdmin).length;

  // 위쪽 요약은 탭마다 그 화면에 필요한 정보만 보여 준다
  const overview = (): Ov[] => {
    if (tab === 'invite') {
      const inv = inviteState(project, now);
      const code = project.invite;
      return [
        { icon: 'ticket', label: '입장 코드', value: inv === 'ACTIVE' ? '사용 중' : inv === 'REVOKED' ? '중지됨' : inv === 'EXPIRED' ? '만료됨' : '없음', tone: inv === 'ACTIVE' ? 'ok' : 'off' },
        { icon: 'clock', label: '남은 시간', value: inv !== 'ACTIVE' ? '-' : code!.expiresAt === null ? '무제한' : mmss(code!.expiresAt - now), tone: inv === 'ACTIVE' ? undefined : 'off' },
        { icon: 'ticket', label: '코드 발급', value: code ? timeText(code.issuedAt) : '-', tone: code ? undefined : 'off' },
        { icon: 'users', label: '참여자', value: `${all.length}명` },
      ];
    }
    if (tab === 'members') {
      return [
        { icon: 'users', label: '전체 참여자', value: `${all.length}명` },
        { icon: 'shield', label: '룸 관리자', value: `${admins}명` },
        { icon: 'user', label: '일반 참여자', value: `${all.length - admins}명` },
      ];
    }
    if (tab === 'run') {
      const list = presentationsOf(db, project.id);
      const sums = db.summaries.filter(x => list.some(p => p.id === x.presentationId));
      const roster = presenterRoster(db, project.id, all);
      const registered = roster.filter(x => presentationOfUser(db, project.id, x.userId)).length;
      return [
        { icon: 'mic', label: '발표', value: `${list.length}개` },
        { icon: 'checkCircle', label: '발표 등록', value: `${registered} / ${roster.length}명` },
        { icon: 'check', label: '평가 제출', value: `${sums.reduce((a, x) => a + x.scored, 0)} / ${sums.reduce((a, x) => a + x.eligible, 0)}` },
      ];
    }
    const s = project.settings;
    const closed = project.status === 'CLOSED';
    return [
      { icon: 'flag', label: '평가룸 상태', value: closed ? '마감' : '진행 중', tone: closed ? 'off' : 'ok' },
      { icon: 'star', label: '점수 입력 범위', value: `${s.min} ~ ${s.max}점` },
    ];
  };

  const items = overview();

  return (
    <ProjectShell project={project} current={`admin-${tab}`}>
      <BoardHead title={active.label} />

      {project.status === 'CLOSED' && <div className="notice"><Icon name="flag" size={16} />{project.closedAt && timeText(project.closedAt)}에 마감된 평가룸이에요.</div>}

      <div className={`overview ${items.length <= 3 ? 'few' : ''}`} style={{ '--ov-cols': items.length } as React.CSSProperties}>
        {items.map(o => (
          <div key={o.label} className="ov">
            <span className="ov-label"><Icon name={o.icon} size={14} />{o.label}</span>
            <b className={`ov-value ${o.tone ?? ''}`}>{o.value}</b>
          </div>
        ))}
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
