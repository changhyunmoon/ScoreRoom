import type { ID } from '../../../shared/lib/types';

/**
 * 점수: 평가자(raterId)가 한 발표(presentationId)의 구성원 한 명(targetId)에게 준 점수와 피드백.
 * 룸 운영자에게는 그 평가룸 전체, 일반 참여자에게는 본인이 준 것만 내려온다.
 */
export interface Rating {
  id: ID; projectId: ID; presentationId: ID; targetId: ID; raterId: ID; score: number;
  /** 피드백 (선택). 작성자 본인과 룸 운영자만 본다 */
  feedback: string | null;
  /** 마지막으로 저장한 시각. 수정 이력은 따로 남기지 않는다 */
  submittedAt: number;
}

export const MAX_FEEDBACK_LENGTH = 1000;
