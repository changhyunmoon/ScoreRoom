// 평가 가능 여부와 내 진행 상태 (화면 안내용). 서버가 같은 규칙으로 최종 판단한다.
// 발표 상태는 없고 마감 전까지 언제든 평가한다. 점수는 발표 하나에 한 번 준다 (팀 발표도 구성원별이 아니다).
import type { ID } from '../../../shared/lib/types';
import { involvedIds, type Presentation } from '../../presentations';
import { membership, type Membership, type Project } from '../../projects';
import type { Rating } from './types';

type RoomData = { memberships: Membership[]; presentations: Presentation[]; ratings: Rating[] };

export type Block = 'ADMIN' | 'SELF' | 'SAME_TEAM' | null;

/** 발표 구성원들의 참여 당시 회사 팀 (팀이 없는 사람은 뺀다) */
const crewTeams = (d: RoomData, project: Project, pres: Presentation) =>
  new Set(involvedIds(pres).map(id => membership(d, project.id, id)?.teamIdAtJoin ?? null).filter((t): t is ID => !!t));

/**
 * 평가자(raterId)가 이 발표를 평가할 수 없는 이유. null이면 평가 가능. 서버(RoomRoster.check)와 같은 순서:
 * - ADMIN: 룸 관리자 (관리자도 평가하기가 꺼져 있으면)
 * - SELF: 내가 구성원인 발표 = 본인 발표 (개인 발표의 본인, 팀 발표의 팀원. 본인 발표 평가 허용이 꺼져 있으면)
 * - SAME_TEAM: 구성원 중 참여 당시 나와 같은 회사 팀인 사람이 있는 발표 (같은 팀 평가 허용이 꺼져 있으면)
 */
export function blockReason(d: RoomData, project: Project, pres: Presentation, raterId: ID): Block {
  const { allowSelf, allowSameTeam, allowAdminRating } = project.settings;
  if (!allowAdminRating && membership(d, project.id, raterId)?.isAdmin) return 'ADMIN';
  if (involvedIds(pres).includes(raterId)) return allowSelf ? null : 'SELF';
  const myTeam = membership(d, project.id, raterId)?.teamIdAtJoin ?? null;
  if (!allowSameTeam && myTeam && crewTeams(d, project, pres).has(myTeam)) return 'SAME_TEAM';
  return null;
}
export const blockText: Record<Exclude<Block, null>, string> = {
  ADMIN: '룸 관리자는 평가하지 않는 평가룸이에요.',
  SELF: '본인 발표는 평가할 수 없어요.',
  SAME_TEAM: '같은 회사 팀의 발표라 평가할 수 없어요.',
};
export const blockShort: Record<Exclude<Block, null>, string> = { ADMIN: '관리자', SELF: '본인 발표', SAME_TEAM: '같은 팀' };

/** 평가 규칙을 바꾸면 새 규칙에 맞지 않게 되는 기존 평가 (저장할 때 삭제된다). 룸 관리자는 평가룸 전체 평가를 받는다 */
export function ratingsBlockedBy(d: RoomData, project: Project, settings: Project['settings']) {
  const changed = { ...project, settings };
  return d.ratings.filter(r => {
    if (r.projectId !== project.id) return false;
    const pres = d.presentations.find(p => p.id === r.presentationId);
    return !!pres && blockReason(d, changed, pres, r.raterId) !== null;
  });
}

/** 이 평가룸에서 평가하는 사람인지. 관리자도 평가하기가 꺼져 있으면 룸 관리자는 평가하지 않는다 */
export const ratesInRoom = (project: Project, m: Membership | undefined) => !!m && (project.settings.allowAdminRating || !m.isAdmin);

/** 이 발표에 내가 준 점수 */
export const myRating = (d: RoomData, pres: Presentation, userId: ID) =>
  d.ratings.find(r => r.presentationId === pres.id && r.raterId === userId);

/** 참여자 입장에서 본 발표 상태. 화면 전체에서 같은 색·아이콘·문구로 표시한다 */
export type MyStatus = 'TODO' | 'DONE' | 'BLOCKED' | 'MISSED';
export function myStatus(d: RoomData, project: Project, pres: Presentation, userId: ID): MyStatus {
  if (blockReason(d, project, pres, userId)) return 'BLOCKED';
  if (myRating(d, pres, userId)) return 'DONE';
  // 마감된 평가룸은 모든 발표가 끝난 것으로 보고, 평가하지 않은 발표는 '평가 안 함'으로 둔다
  return project.status === 'CLOSED' ? 'MISSED' : 'TODO';
}
export const statusMeta = {
  TODO: { label: '평가 필요', tone: 'amber', icon: 'star' },
  DONE: { label: '평가 완료', tone: 'green', icon: 'checkCircle' },
  BLOCKED: { label: '평가 불가', tone: 'gray', icon: 'lock' },
  MISSED: { label: '평가 안 함', tone: 'gray', icon: 'ban' },
} as const;
