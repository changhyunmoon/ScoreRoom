// 초대·입장 코드: 조직도에서 사람을 골라 초대하고, 입장 코드를 발급·중지한다
import { useState } from 'react';
import { Icon } from '../../../../shared/icons/Icon';
import { useNow } from '../../../../shared/hooks/useNow';
import { mmss, timeText } from '../../../../shared/lib/format';
import { Chip, IconText, SectionTitle, run, toast } from '../../../../shared/ui';
import { cancelInvitation, inviteUsers } from '../../../invitations';
import { OrgDirectory, teamName, userName } from '../../../organization';
import { mutate, useSession } from '../../../session';
import { issueInvite, revokeInvite } from '../../api/projects.api';
import { membership } from '../../model/access';
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
      <InvitePeople project={project} />
      <section className="card stack">
        <SectionTitle icon="ticket" title="입장 코드"
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
  );
}

/** 조직도에서 사람을 골라 초대한다. 받은 사람은 우측 상단 알림에서 참여하거나 거절한다 */
function InvitePeople({ project }: { project: Project }) {
  const { db } = useSession();
  const [picking, setPicking] = useState(false);
  const pending = db.invitations.filter(i => i.projectId === project.id);
  const isMember = (id: string) => !!membership(db, project.id, id);
  const isPending = (id: string) => pending.some(i => i.inviteeId === id);
  return (
    <section className="card stack">
      <SectionTitle icon="users" title="사람 초대"
        right={<button className="btn primary solid" onClick={() => setPicking(true)}><IconText icon="plus">초대하기</IconText></button>} />
      {pending.length === 0
        ? <p className="muted small">대기 중인 초대가 없어요.</p>
        : (
          <div className="invite-list">
            {pending.map(i => (
              <div key={i.id} className="invite-row">
                <span><b>{userName(db, i.inviteeId)}</b> <span className="muted small">{teamName(db, db.users.find(u => u.id === i.inviteeId)?.teamId ?? null)}</span></span>
                <span className="muted small">{timeText(i.createdAt)} 초대 · 응답 대기</span>
                <button className="btn sm ghost" onClick={() => run(() => mutate(cancelInvitation(i.id)), '초대를 취소했습니다.')}>취소</button>
              </div>
            ))}
          </div>
        )}
      {picking && (
        <OrgDirectory onClose={() => setPicking(false)} picker={{
          title: `'${project.name}'에 초대`,
          hint: '사람 옆의 체크박스를 눌러 초대 목록에 담으세요.',
          listTitle: '초대 목록',
          confirmLabel: '초대',
          disabledReason: id => (isMember(id) ? '참여 중' : isPending(id) ? '초대함' : null),
          onConfirm: async ids => {
            let invited = 0;
            const ok = await run(async () => { invited = await mutate(inviteUsers(project.id, ids)); });
            if (ok) toast(`${invited}명에게 초대를 보냈어요.`);
            return ok;
          },
        }} />
      )}
    </section>
  );
}
