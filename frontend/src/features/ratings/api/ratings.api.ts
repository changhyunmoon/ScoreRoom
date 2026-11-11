import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

/** 발표 하나에 점수(필수)와 피드백(선택)을 준다. 팀 발표도 한 번만 준다. 평가자는 로그인 세션으로 정해진다 */
export const submitRating = (pid: ID, prid: ID, score: number, feedback: string) =>
  http.put(`/projects/${pid}/presentations/${prid}/rating`, { score, feedback: feedback.trim() || null });

/** 룸 관리자: 이 발표를 아직 평가하지 않은 사람에게 평가 요청 알림을 보낸다. 실제로 보낸 인원을 돌려준다 */
export const requestRatings = async (pid: ID, prid: ID, userIds: ID[]) =>
  (await http.post<{ sent: number }>(`/projects/${pid}/presentations/${prid}/rating-requests`, { userIds })).sent;
