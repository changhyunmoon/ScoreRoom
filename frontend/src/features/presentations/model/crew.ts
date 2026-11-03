// 발표 구성원과 목록 정렬 (화면 표시용)
import type { ID } from '../../../shared/lib/types';
import { teamRank, userName, type Team, type User } from '../../organization';
import { membership, type Membership, type Project } from '../../projects';
import type { Presentation } from './types';

type RoomData = { teams: Team[]; users: User[]; memberships: Membership[]; presentations: Presentation[] };

/** 발표 구성원 전체 (대표·발표자·팀원, 한 사람은 한 번) */
export const involvedIds = (p: Presentation): ID[] => Array.from(new Set([p.leaderId, ...p.presenterIds, ...p.memberIds]));

/** 발표를 수정할 수 있는 사람: 룸 운영자, 대표, 발표를 만든 사람 */
export const canEditPresentation = (p: Presentation, userId: ID, isAdmin: boolean) =>
  isAdmin || p.leaderId === userId || p.createdBy === userId;

/**
 * 발표 구성원과 역할 (대표 → 발표자 → 팀원 순서). 모두 한 명씩 평가받는다.
 * 대표가 발표도 하면 presenterIds에 대표가 함께 들어 있고, 그 사람은 한 번만 나온다 (역할: 대표·발표자).
 */
export type CrewRole = 'LEADER' | 'LEADER_PRESENTER' | 'PRESENTER' | 'MEMBER';
export const crewOf = (p: Presentation): { id: ID; role: CrewRole }[] => [
  { id: p.leaderId, role: p.presenterIds.includes(p.leaderId) ? 'LEADER_PRESENTER' : 'LEADER' },
  ...p.presenterIds.filter(id => id !== p.leaderId).map(id => ({ id, role: 'PRESENTER' as const })),
  ...p.memberIds.filter(id => id !== p.leaderId).map(id => ({ id, role: 'MEMBER' as const })),
];
export const roleText: Record<CrewRole, string> = { LEADER: '대표', LEADER_PRESENTER: '대표·발표자', PRESENTER: '발표자', MEMBER: '팀원' };
export const roleClass: Record<CrewRole, string> = { LEADER: 'lead', LEADER_PRESENTER: 'lead', PRESENTER: 'presenter', MEMBER: 'member' };

export const presTypeText = { PERSONAL: '개인', TEAM: '팀' } as const;

/** 관리자 설정 순서대로 */
export const presentationsOf = (d: { presentations: Presentation[] }, pid: ID) =>
  d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);

/** 목록용 한 줄 요약: "정예린 외 2명" (대표 기준) */
export function crewSummary(d: { users: User[] }, p: Presentation) {
  const others = involvedIds(p).length - 1;
  return others > 0 ? `${userName(d, p.leaderId)} 외 ${others}명` : userName(d, p.leaderId);
}
/** 검색용: 구성원 전체 이름 */
export const crewNames = (d: { users: User[] }, p: Presentation) => involvedIds(p).map(id => userName(d, id));

/* ---------- 정렬 ---------- */
export type PresSort = 'order' | 'created' | 'team';
export const presSortText: Record<PresSort, string> = { order: '관리자 설정 순', created: '등록순', team: '팀 구조도 순' };

/** 발표 목록 정렬. 팀 구조도 순은 대표의 참여 당시 팀 기준이고, 같은 팀 안에서는 관리자 설정 순 */
export function sortPresentations(d: RoomData, project: Project, list: Presentation[], mode: PresSort) {
  if (mode === 'order') return [...list].sort((a, b) => a.order - b.order);
  if (mode === 'created') return [...list].sort((a, b) => a.createdAt - b.createdAt || a.order - b.order);
  const rank = teamRank(d);
  const teamOf = (p: Presentation) => membership(d, project.id, p.leaderId)?.teamIdAtJoin ?? null;
  const rankOf = (p: Presentation) => {
    const t = teamOf(p);
    return t != null && rank.has(t) ? rank.get(t)! : Number.MAX_SAFE_INTEGER;
  };
  return [...list].sort((a, b) => rankOf(a) - rankOf(b) || (teamOf(a) ?? '').localeCompare(teamOf(b) ?? '') || a.order - b.order);
}
