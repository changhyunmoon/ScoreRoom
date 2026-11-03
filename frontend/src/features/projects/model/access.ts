// 평가룸 참여자와 접근 자격 (화면 표시용. 최종 권한은 서버가 검사한다)
import type { ID } from '../../../shared/lib/types';
import type { Membership } from './types';

type WithMemberships = { memberships: Membership[] };

export const members = (d: WithMemberships, pid: ID) => d.memberships.filter(m => m.projectId === pid);
export const membership = (d: WithMemberships, pid: ID, userId: ID) => d.memberships.find(m => m.projectId === pid && m.userId === userId);

/** 평가룸에서 내 자격: 룸 운영자 / 참여자 / 전체 열람(참여하지 않았지만 볼 수만 있음) / 없음 */
export function roomAccess(d: WithMemberships, projectId: ID, user: { id: ID; canViewAll: boolean }) {
  const m = membership(d, projectId, user.id);
  if (m) return m.isAdmin ? 'admin' : 'member';
  return user.canViewAll ? 'viewer' : null;
}
