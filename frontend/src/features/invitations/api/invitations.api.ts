// 평가룸 초대
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

/** 룸 운영자가 사용자들을 초대한다. 이미 참여 중이거나 초대 대기 중인 사람은 건너뛰고, 새로 초대한 인원을 돌려준다 */
export const inviteUsers = async (pid: ID, userIds: ID[]) =>
  (await http.post<{ invited: number }>(`/projects/${pid}/invitations`, { userIds })).invited;
/** 초대 취소 (룸 운영자) */
export const cancelInvitation = (id: ID) => http.del(`/invitations/${id}`);
/** 초대 수락: 평가룸에 참여하고 그 평가룸 ID를 돌려준다 */
export const acceptInvitation = async (id: ID) => (await http.post<{ projectId: ID }>(`/invitations/${id}/accept`)).projectId;
export const declineInvitation = (id: ID) => http.post(`/invitations/${id}/decline`);
