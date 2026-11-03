import type { ID } from '../../../shared/lib/types';
import type { Attachment } from '../../attachments';

/** 발표 유형: 개인 / 팀 */
export type PresType = 'PERSONAL' | 'TEAM';
export type PresRole = 'PRESENTER' | 'MEMBER';

/**
 * 발표 구성원
 * - leaderId: 대표 (1명). 대표로만 표시하고 발표자·팀원 목록에는 넣지 않는다.
 * - presenterIds: 발표자. 대표가 발표도 하면 대표도 여기에 들어간다 (대표+발표자)
 * - memberIds: 팀원 (대표 외에 함께 준비한 사람)
 * 평가 규칙(본인 발표·같은 팀 제한)은 구성원 전체(involvedIds)에 적용한다.
 */
export interface Presentation {
  id: ID; projectId: ID; title: string; intro: string; type: PresType;
  leaderId: ID; order: number; presenterIds: ID[]; memberIds: ID[];
  /** 발표를 만든 사람 (대표가 아닐 수 있음) */
  createdBy: ID;
  /** 등록 시각 (등록순 정렬) */
  createdAt: number;
  /** 배포 URL (선택) */
  deployUrl: string | null;
  /** 발표 자료 (여러 개, 선택). 평가룸 참여자 누구나 내려받을 수 있다 */
  attachments: Attachment[];
  /** 점수를 받은 적이 있는지. 받았으면 구성원 추가·제외를 막는다 (누가 몇 점인지는 모름) */
  hasRatings: boolean;
}

/** 발표 등록·수정 요청 */
export interface PresentationInput {
  title: string; intro: string; type: PresType; leaderId: ID; presenterIds: ID[]; memberIds: ID[]; deployUrl: string | null;
}
