// 참여자를 팀 구조도 순으로 늘어놓고 팀별로 묶는다. 발표 화면과 참여자 화면이 같은 순서를 쓴다.
import type { ID } from '../../../shared/lib/types';
import { teamRank, userName, userOf, type Team, type User } from '../../organization';
import type { Membership } from './types';

type OrgData = { teams: Team[]; users: User[] };

/** 참여 당시 팀(팀 구조도 위 → 아래), 같은 팀은 조직도 순서(위 = 높은 사람), 그다음 이름. 소속 없음은 맨 뒤 */
export function sortByTeamStructure<T extends Pick<Membership, 'userId' | 'teamIdAtJoin'>>(d: OrgData, list: T[]): T[] {
  const rank = teamRank(d);
  const teamRankOf = (t: ID | null) => (t !== null && rank.has(t) ? rank.get(t)! : Number.MAX_SAFE_INTEGER);
  const userRankOf = (id: ID) => userOf(d, id)?.rank ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => teamRankOf(a.teamIdAtJoin) - teamRankOf(b.teamIdAtJoin)
    || (a.teamIdAtJoin ?? '').localeCompare(b.teamIdAtJoin ?? '')
    || userRankOf(a.userId) - userRankOf(b.userId)
    || userName(d, a.userId).localeCompare(userName(d, b.userId)));
}

/** 이미 팀 순으로 놓인 목록을 이어지는 팀끼리 묶는다. index는 원래 목록에서의 위치 */
export function groupByTeam<T extends Pick<Membership, 'teamIdAtJoin'>>(list: T[]) {
  const groups: { teamId: ID | null; rows: { item: T; index: number }[] }[] = [];
  list.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.teamId === item.teamIdAtJoin) last.rows.push({ item, index });
    else groups.push({ teamId: item.teamIdAtJoin, rows: [{ item, index }] });
  });
  return groups;
}
