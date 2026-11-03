// 평가 가능 여부와 내 진행 상태 (화면 안내용). 서버가 같은 규칙으로 최종 판단한다.
// 발표 상태는 없고 마감 전까지 언제든 평가한다. 점수는 발표 구성원(대표·발표자·팀원) 한 명씩 따로 준다.
import type { ID } from '../../../shared/lib/types';
import { crewOf, involvedIds, type Presentation } from '../../presentations';
import { membership, type Membership, type Project } from '../../projects';
import type { Rating } from './types';

type RoomData = { memberships: Membership[]; presentations: Presentation[]; ratings: Rating[] };

export type Block = 'SELF' | 'SAME_CREW' | 'SAME_TEAM' | null;

/**
 * 평가자(raterId)가 발표 구성원(targetId)을 평가할 수 없는 이유. null이면 평가 가능.
 * - SELF: 나 자신 (본인 평가 허용이 꺼져 있으면)
 * - SAME_CREW: 내가 구성원인 발표의 다른 구성원 (같은 발표 팀원 평가 허용이 꺼져 있으면)
 * - SAME_TEAM: 참여 당시 나와 같은 회사 팀인 사람 (같은 팀 평가 허용이 꺼져 있으면)
 */
export function blockReason(d: RoomData, project: Project, pres: Presentation, raterId: ID, targetId: ID): Block {
  const { allowSelf, allowSameTeam, allowSameCrew } = project.settings;
  if (targetId === raterId) return allowSelf ? null : 'SELF';
  if (!allowSameCrew && involvedIds(pres).includes(raterId)) return 'SAME_CREW';
  const myTeam = membership(d, project.id, raterId)?.teamIdAtJoin ?? null;
  if (!allowSameTeam && myTeam && membership(d, project.id, targetId)?.teamIdAtJoin === myTeam) return 'SAME_TEAM';
  return null;
}
export const blockText: Record<Exclude<Block, null>, string> = {
  SELF: '본인은 평가할 수 없습니다.',
  SAME_CREW: '같은 발표의 팀원은 평가할 수 없습니다.',
  SAME_TEAM: '같은 회사 팀이라 평가할 수 없습니다.',
};
export const blockShort: Record<Exclude<Block, null>, string> = { SELF: '본인', SAME_CREW: '같은 발표', SAME_TEAM: '같은 팀' };

/** 평가 규칙을 바꾸면 새 규칙에 맞지 않게 되는 기존 평가 (저장할 때 삭제된다). 룸 운영자는 평가룸 전체 평가를 받는다 */
export function ratingsBlockedBy(d: RoomData, project: Project, settings: Project['settings']) {
  const changed = { ...project, settings };
  return d.ratings.filter(r => {
    if (r.projectId !== project.id) return false;
    const pres = d.presentations.find(p => p.id === r.presentationId);
    return !!pres && blockReason(d, changed, pres, r.raterId, r.targetId) !== null;
  });
}

/** 내가 이 발표에서 평가할 수 있는 구성원 수와 이미 평가한 수 */
export function myProgress(d: RoomData, project: Project, pres: Presentation, userId: ID) {
  const ratable = crewOf(pres).filter(c => !blockReason(d, project, pres, userId, c.id));
  const rated = ratable.filter(c => d.ratings.some(r => r.presentationId === pres.id && r.targetId === c.id && r.raterId === userId));
  return { ratable: ratable.length, rated: rated.length };
}

/** 참여자 입장에서 본 발표 상태. 화면 전체에서 같은 색·아이콘·문구로 표시한다 */
export type MyStatus = 'TODO' | 'DONE' | 'BLOCKED' | 'MISSED';
export function myStatus(d: RoomData, project: Project, pres: Presentation, userId: ID): MyStatus {
  const { ratable, rated } = myProgress(d, project, pres, userId);
  if (ratable === 0) return 'BLOCKED';
  if (rated === ratable) return 'DONE';
  // 마감된 평가룸은 모든 발표가 끝난 것으로 보고, 다 평가하지 않은 발표는 '평가 안 함'으로 둔다
  return project.status === 'CLOSED' ? 'MISSED' : 'TODO';
}
export const statusMeta = {
  TODO: { label: '평가 필요', tone: 'amber', icon: 'star' },
  DONE: { label: '평가 완료', tone: 'green', icon: 'checkCircle' },
  BLOCKED: { label: '평가 불가', tone: 'gray', icon: 'lock' },
  MISSED: { label: '평가 안 함', tone: 'gray', icon: 'ban' },
} as const;
