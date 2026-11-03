// 회사 조직도 표시 규칙
import type { ID } from '../../../shared/lib/types';
import type { Team, User } from './types';

type WithTeams = { teams: Team[] };
type WithUsers = { users: User[] };

export const userOf = (d: WithUsers, id: ID) => d.users.find(u => u.id === id);
export const userName = (d: WithUsers, id: ID) => userOf(d, id)?.name ?? '(알 수 없음)';
export const teamName = (d: WithTeams, id: ID | null) => (id ? d.teams.find(t => t.id === id)?.name ?? '(삭제된 팀)' : '소속 없음');

/** 상위 팀 > 하위 팀 경로 */
export function teamPath(teams: Team[], id: ID | null) {
  if (!id) return '소속 없음';
  const path: string[] = [];
  let current = teams.find(t => t.id === id);
  while (current) {
    path.unshift(current.name);
    current = teams.find(t => t.id === current?.parentId);
  }
  return path.join(' > ');
}

/** 회사 팀 구조도에서 위에서부터 읽은 순서 (상위 팀 → 하위 팀) */
export function teamRank(d: WithTeams) {
  const rank = new Map<ID, number>();
  const walk = (parent: ID | null) => d.teams.filter(t => t.parentId === parent).forEach(t => { rank.set(t.id, rank.size); walk(t.id); });
  walk(null);
  return rank;
}

/** 팀 사람들을 조직도 순서(위 = 높은 사람)대로. 같은 순서면 이름순 */
export const byRank = <T extends { rank: number; name: string }>(a: T, b: T) => a.rank - b.rank || a.name.localeCompare(b.name);

/** 상하 관계를 들여쓰기로 보여주는 팀 선택지 */
export function teamOptions(teams: Team[]) {
  const out: { id: ID; label: string }[] = [];
  const walk = (parent: ID | null, depth: number) =>
    teams.filter(t => t.parentId === parent).forEach(t => { out.push({ id: t.id, label: `${'　'.repeat(depth)}${depth ? '└ ' : ''}${t.name}` }); walk(t.id, depth + 1); });
  walk(null, 0);
  return out;
}
