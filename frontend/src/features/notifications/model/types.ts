import type { ID } from '../../../shared/lib/types';

/**
 * 알림 종류. ROOM_INVITED: 룸 관리자가 나를 평가룸에 추가함 (수락 없이 바로 참여), PRESENTATION_REQUESTED: 룸 관리자가 발표 등록을 요청함,
 * RATING_REQUESTED: 룸 관리자가 아직 평가하지 않은 발표를 평가해 달라고 요청함
 */
export type NotificationType = 'ROOM_INVITED' | 'PRESENTATION_REQUESTED' | 'RATING_REQUESTED';

/** 우측 상단 알림 한 건. 지금 참여 중인 평가룸에 대한 것만, 최근 50건이 내려온다. readAt이 null이면 안 읽음 */
export interface Notification {
  id: ID; type: NotificationType; projectId: ID; projectName: string; actorId: ID; actorName: string;
  createdAt: number; readAt: number | null;
  /** 평가 요청 알림이 가리키는 발표 (그 밖의 알림이거나 발표가 지워졌으면 null) */
  presentationId: ID | null; presentationTitle: string | null;
}
