// 초대·입장 코드: 조직도에서 사람을 골라 초대하고, 입장 코드를 발급·중지한다
import { useState } from 'react';
import { Icon } from '../../../../shared/icons/Icon';
import { useNow } from '../../../../shared/hooks/useNow';
import { mmss, timeText } from '../../../../shared/lib/format';
import { Chip, IconText, SectionTitle, run, toast } from '../../../../shared/ui';
import { Link } from 'react-router-dom';
import { OrgDirectory, teamName, userName, userOf } from '../../../organization';
import { mutate, useSession } from '../../../session';
import { addMembers, issueInvite, revokeInvite } from '../../api/projects.api';
import { members, membership } from '../../model/access';
import { groupByTeam, sortByTeamStructure } from '../../model/teamOrder';
import type { Project } from '../../model/types';

export type InviteState = 'NONE' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export const inviteState = (p: Project, now: number): InviteState =>
  !p.invite ? 'NONE' : p.invite.revokedAt ? 'REVOKED' : p.invite.expiresAt !== null && p.invite.expiresAt <= now ? 'EXPIRED' : 'ACTIVE';

// 유효기간 선택지. null은 무제한 (중지하거나 재발급할 때까지 유효)
const CODE_TTL: { minutes: number | null; label: string }[] = [
  { minutes: 5, label: '5분' }, { minutes: 30, label: '30분' }, { minutes: 60, label: '1시간' }, { minutes: 1440, label: '24시간' }, { minutes: null, label: '무제한' },
];

export function InviteTab({ project }: { project: Project }) {
  const now = useNow();
  const [minutes, setMinutes] = useState<number | null>(30);
  const inv = project.invite;
  // 화면의 카운트다운은 안내용이다. 만료 판정은 서버가 요청 시각으로 한다
  const state = inviteState(project, now);
  const isActive = state === 'ACTIVE';
  return (
    <div className="stack lg">
      <div className="invite-guide">
        <Icon name="info" size={18} />
        <div>
          <b>참여자를 모으는 방법은 두 가지예요.</b>
          <ul>
            <li><b>사람 초대</b> 참여할 사람이 정해져 있을 때. 초대하는 즉시 참여자로 추가되고 알림이 가요.</li>
            <li><b>입장 코드</b> 메신저·메일로 여러 사람에게 한 번에 알릴 때. 코드를 아는 누구나 들어올 수 있어요.</li>
          </ul>
        </div>
      </div>
      <div className="invite-methods">
        <InvitePeople project={project} />
        <section className="card stack">
          <SectionTitle icon="ticket" title={<><span className="method-no">방법 2</span>입장 코드 공유</>}
            desc={<>코드를 발급해 공유하면, 받은 사람이 메인 화면의 <b>평가룸 입장</b>에 코드를 입력해 들어와요.</>}
            right={isActive ? <Chip tone="green" icon="check">사용 중</Chip> : state === 'REVOKED' ? <Chip tone="red" icon="stop">중지됨</Chip> : state === 'EXPIRED' ? <Chip icon="clock">만료됨</Chip> : <Chip>없음</Chip>} />
          {inv && (
            <div className={`invite ${isActive ? '' : 'inactive'}`}>
              <div className="invite-code mono">{inv.code}</div>
              <div className="small">
                {isActive && (inv.expiresAt === null
                  ? <div><Icon name="clock" size={13} /> <b>기간 무제한</b> · 중지할 때까지 유효</div>
                  : <div><Icon name="clock" size={13} /> <b>{mmss(inv.expiresAt - now)}</b> 후 만료</div>)}
                {state === 'REVOKED' && <div>{timeText(inv.revokedAt!)}에 중지됨 · 이 코드로는 참여할 수 없어요</div>}
                {state === 'EXPIRED' && inv.expiresAt !== null && <div>{timeText(inv.expiresAt)}에 만료됨</div>}
                <div className="muted">{timeText(inv.issuedAt)} 발급</div>
              </div>
              {isActive && (
                <div className="row gap-sm">
                  <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(inv.code); toast('코드를 복사했어요.'); }}><IconText icon="copy">복사</IconText></button>
                  <button className="btn sm danger" onClick={() => run(() => mutate(revokeInvite(project.id)), '입장 코드를 중지했습니다. 이제 이 코드로 입장할 수 없어요.')}><IconText icon="stop">중지</IconText></button>
                </div>
              )}
            </div>
          )}
          <div className="invite-issue">
            <span className="field-label">새 코드 유효기간</span>
            <div className="row gap wrap">
              <div className="segmented">
                {CODE_TTL.map(t => <button key={t.label} className={minutes === t.minutes ? 'on' : ''} onClick={() => setMinutes(t.minutes)}>{t.label}</button>)}
              </div>
              <button className="btn primary solid" onClick={() => run(() => mutate(issueInvite(project.id, minutes)), isActive ? '새 코드를 발급했어요. 이전 코드는 무효화됩니다.' : '코드를 발급했어요.')}>
                <IconText icon={isActive ? 'refresh' : 'plus'}>{isActive ? '재발급' : '코드 발급'}</IconText>
              </button>
            </div>
          </div>
          <ul className="help-list">
            <li><b>재발급</b> 이전 코드를 즉시 무효화하고 새 코드를 만들어요.</li>
            <li><b>중지</b> 새 코드를 발급하기 전까지 아무도 참여할 수 없어요.</li>
            <li>어느 경우든 이미 참여한 사람은 그대로 남아요.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/** 조직도에서 사람을 골라 초대한다. 수락 절차 없이 바로 참여자로 추가되고, 아래에 참여 중인 사람이 팀별로 보인다 */
function InvitePeople({ project }: { project: Project }) {
  const { db } = useSession();
  const [picking, setPicking] = useState(false);
  const isMember = (id: string) => !!membership(db, project.id, id);
  const all = members(db, project.id);
  const groups = groupByTeam(sortByTeamStructure(db, all));
  return (
    <section className="card stack">
      <SectionTitle icon="users" title={<><span className="method-no">방법 1</span>사람 지정해서 초대</>}
        desc={<>회사 팀 구조도에서 사람을 골라요. 초대한 사람은 <b>바로 이 평가룸에 참여</b>되고, 우측 상단 <b>알림</b>으로 초대 소식을 받아요.</>}
        right={<button className="btn primary solid" onClick={() => setPicking(true)}><IconText icon="plus">초대하기</IconText></button>} />
      <p className="muted small">
        현재 참여자 <b>{all.length}명</b> · 운영자 지정과 제거는 <Link to={`/p/${project.id}/admin?tab=members`}>참여자</Link> 탭에서 할 수 있어요.
      </p>
      {/* 초대된(참여 중인) 사람: 팀 구조도 순으로 팀별로 묶어 항상 보여 준다. 많으면 이 칸 안에서 스크롤 */}
      <div className="invited-list">
        {groups.map(g => {
          const first = g.rows[0].item;
          return (
            <div key={`${g.teamId ?? 'none'}-${g.rows[0].index}`} className="team-box">
              <div className="team-head">
                <Icon name="building" size={14} />
                <b>{first.teamNameAtJoin ?? teamName(db, first.teamIdAtJoin)}</b>
                <span className="team-count">{g.rows.length}명</span>
              </div>
              {g.rows.map(({ item: m }) => (
                <div key={m.userId} className="invited-row">
                  <span className="invited-name"><b>{userName(db, m.userId)}</b>{userOf(db, m.userId)?.position && <small className="muted"> {userOf(db, m.userId)!.position}</small>}</span>
                  {m.isAdmin && <Chip tone="violet" icon="shield">룸 운영자</Chip>}
                  <small className="muted invited-date">{timeText(m.joinedAt)} 참여</small>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {picking && (
        <OrgDirectory onClose={() => setPicking(false)} picker={{
          title: `'${project.name}'에 초대`,
          hint: '사람 옆의 체크박스를 눌러 초대 목록에 담으세요. 초대하면 바로 참여자로 추가돼요.',
          listTitle: '초대 목록',
          confirmLabel: '초대',
          disabledReason: id => (isMember(id) ? '참여 중' : null),
          onConfirm: async ids => {
            let added = 0;
            const ok = await run(async () => { added = await mutate(addMembers(project.id, ids)); });
            if (ok) toast(added > 0 ? `${added}명을 평가룸에 추가하고 알림을 보냈어요.` : '새로 추가된 사람이 없어요.');
            return ok;
          },
        }} />
      )}
    </section>
  );
}
