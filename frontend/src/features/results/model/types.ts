import type { ID } from '../../../shared/lib/types';

/**
 * 서버가 계산한 발표 구성원별 집계. 룸 관리자와 전체 열람 권한자에게만 내려온다.
 * 미제출과 평가 불가는 평균에 넣지 않는다. 제출이 없으면 avg는 null.
 */
export interface Summary {
  presentationId: ID; targetId: ID; total: number; blocked: number; eligible: number; scored: number; notRated: number;
  avg: number | null; inCount: number; inAvg: number | null;
  /** 평가함·평가 불가·미평가 인원이 누구인지. 사람 목록을 볼 수 없으면(설정이 꺼진 참여자) 서버가 null로 보낸다 */
  scoredIds?: ID[] | null; blockedIds?: ID[] | null; notRatedIds?: ID[] | null;
}
