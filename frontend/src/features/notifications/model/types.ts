import type { ID } from '../../../shared/lib/types';

/** 알림 종류. ROOM_INVITED: 룸 운영자가 나를 평가룸에 추가함 (수락 없이 바로 참여), PRESENTATION_REQUESTED: 룸 운영자가 발표 등록을 요청함 */
export type NotificationType = 'ROOM_INVITED' | 'PRESENTATION_REQUESTED';

/** 우측 상단 알림 한 건. 지금 참여 중인 평가룸에 대한 것만, 최근 50건이 내려온다. readAt이 null이면 안 읽음 */
export interface Notification {
  id: ID; type: NotificationType; projectId: ID; projectName: string; actorId: ID; actorName: string;
  createdAt: number; readAt: number | null;
}
