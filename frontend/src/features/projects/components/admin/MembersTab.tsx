// 참여자: 팀 구조도 순으로 팀별로 묶어 보여 준다 (발표 화면과 같은 모양).
// 룸 운영자 지정·해제, 제거 (제거 영향을 보여주고 확인받는다)
import { useState } from 'react';
import { Icon } from '../../../../shared/icons/Icon';
import { timeText } from '../../../../shared/lib/format';
import type { ID } from '../../../../shared/lib/types';
import { Chip, ConfirmButton, run } from '../../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../../organization';
import { involvedIds } from '../../../presentations';
import { mutate, useSession, type DB } from '../../../session';
import { removeMember, setMemberAdmin } from '../../api/projects.api';
import { members } from '../../model/access';
import { groupByTeam, sortByTeamStructure } from '../../model/teamOrder';
import type { Membership, Project } from '../../model/types';

/** 참여자 제거 시 영향 범위 (룸 운영자는 평가룸의 모든 평가를 받으므로 화면에서 계산한다) */
function removalImpact(d: DB, pid: ID, userId: ID) {
  const pres = d.presentations.filter(p => p.projectId === pid && involvedIds(p).includes(userId));
  return {
    // 그 사람이 준 점수와 그 사람이 받은 점수
    ratings: d.ratings.filter(r => r.projectId === pid && (r.raterId === userId || r.targetId === userId)).length,
    soloPresentations: pres.filter(p => involvedIds(p).length === 1),
    sharedPresentations: pres.filter(p => involvedIds(p).length > 1),
  };
}

function MemberRow({ project, m, no }: { project: Project; m: Membership; no: number }) {
  const { db, me } = useSession();
  const impact = removalImpact(db, project.id, m.userId);
  const name = userName(db, m.userId);
  const position = userOf(db, m.userId)?.position;
  const open = project.status === 'OPEN';
  return (
    <div className="mrow">
      <span className="c-no">{no}</span>
      <span className="c-name">
        <b>{name}</b>
        {position && <small className="muted"> {position}</small>}
        {m.userId === me!.id && <small className="muted"> (나)</small>}
      </span>
      <span className="c-date muted">{timeText(m.joinedAt)}</span>
      <span className="c-role">{m.isAdmin ? <Chip tone="violet" icon="shield">룸 운영자</Chip> : <Chip icon="user">참여자</Chip>}</span>
      <span className="c-act">
        {open && <>
          <button className="btn sm" onClick={() => run(() => mutate(setMemberAdmin(project.id, m.userId, !m.isAdmin)), m.isAdmin ? '룸 운영자 권한을 해제했습니다.' : '룸 운영자 권한을 부여했습니다.')}>
            {m.isAdmin ? '운영자 해제' : '운영자 지정'}
          </button>
          {m.userId !== me!.id && (
            <ConfirmButton className="btn sm danger" label="제거" confirmLabel="제거"
              detail={<>
                주고받은 평가 {impact.ratings}건 삭제
                {impact.soloPresentations.length > 0 && <> · 단독 발표 {impact.soloPresentations.length}개({impact.soloPresentations.map(p => p.title).join(', ')}) 삭제</>}
                {impact.sharedPresentations.length > 0 && <> · 공동 발표 {impact.sharedPresentations.length}개에서 발표자 제외</>}
              </>}
              // 확인한 영향이 그 사이 바뀌었으면 서버가 거절하고(409) 최신 데이터로 다시 보여준다
              onConfirm={() => run(() => mutate(removeMember(project.id, m.userId, project.version)), '참여자를 제거하고 결과를 다시 계산했습니다.')} />
          )}
        </>}
      </span>
    </div>
  );
}

export function MembersTab({ project }: { project: Project }) {
  const { db } = useSession();
  const [q, setQ] = useState('');
  const kw = q.trim();
  const teamOf = (m: Membership) => m.teamNameAtJoin ?? teamName(db, m.teamIdAtJoin);
  const all = members(db, project.id);
  const list = sortByTeamStructure(db, all)
    .filter(m => !kw || userName(db, m.userId).includes(kw) || teamOf(m).includes(kw));
  const groups = groupByTeam(list);
  return (
    <section className="stack">
      <div className="board-tools">
        <span className="bt-title">참여자 <b>{all.length}</b></span>
        <span className="muted small grow">팀 구조도 순 · 팀은 참여한 시점의 소속으로 고정되어 같은 팀 평가 제한에 쓰여요.</span>
        <label className="board-search sm"><input placeholder="이름·팀 검색" value={q} onChange={e => setQ(e.target.value)} aria-label="참여자 검색" /><Icon name="search" size={15} /></label>
      </div>
      <div className="btable members">
        <div className="bhead"><span className="c-no">No</span><span className="c-name">이름</span><span className="c-date">참여일</span><span className="c-role">권한</span><span className="c-act">관리</span></div>
        {list.length === 0 && <div className="bempty">검색 결과가 없습니다.</div>}
        {/* 팀마다 상자로 묶는다. 발표 화면·결과 현황의 팀 묶음과 같은 모양 */}
        {groups.map(g => {
          const first = g.rows[0].item;
          const admins = g.rows.filter(r => r.item.isAdmin).length;
          return (
            <div key={`${g.teamId ?? 'none'}-${g.rows[0].index}`} className="team-box">
              <div className="team-head" role="heading" aria-level={3}>
                <Icon name="building" size={14} />
                <b>{teamOf(first)}</b>
                <span className="team-path">{teamPath(db.teams, first.teamIdAtJoin)}</span>
                <span className="team-count">{g.rows.length}명{admins > 0 ? ` · 운영자 ${admins}명` : ''}</span>
              </div>
              {g.rows.map(({ item, index }) => <MemberRow key={item.userId} project={project} m={item} no={index + 1} />)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
