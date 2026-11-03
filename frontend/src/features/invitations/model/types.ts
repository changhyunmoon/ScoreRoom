import type { ID } from '../../../shared/lib/types';

/**
 * 평가룸 초대 (룸 운영자 → 사용자). 받은 사람은 우측 상단 알림에서 참여하거나 거절한다.
 * 받은 사람에게는 자기 초대가, 룸 운영자에게는 그 평가룸에서 보낸 대기 중인 초대가 내려온다.
 */
export interface Invitation { id: ID; projectId: ID; projectName: string; inviterId: ID; inviterName: string; inviteeId: ID; createdAt: number }
