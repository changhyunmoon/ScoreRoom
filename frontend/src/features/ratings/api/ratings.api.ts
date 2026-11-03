import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

/** 발표 구성원 한 명에게 점수(필수)와 피드백(선택)을 준다. 평가자는 로그인 세션으로 정해진다 */
export const submitRating = (pid: ID, prid: ID, targetId: ID, score: number, feedback: string) =>
  http.put(`/projects/${pid}/presentations/${prid}/ratings/${targetId}`, { score, feedback: feedback.trim() || null });
