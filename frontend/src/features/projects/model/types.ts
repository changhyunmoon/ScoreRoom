import type { ID } from '../../../shared/lib/types';

export interface Settings {
  min: number; max: number;
  aggMin: number | null; aggMax: number | null;
  /** 나 자신도 평가할 수 있는지 (새 평가룸 기본: 불가) */
  allowSelf: boolean;
  /** 나와 같은 회사 팀인 사람도 평가할 수 있는지 (새 평가룸 기본: 가능) */
  allowSameTeam: boolean;
  /** 내가 구성원인 발표의 다른 구성원(같은 발표 팀원)도 평가할 수 있는지 (새 평가룸 기본: 가능) */
  allowSameCrew: boolean;
  /** 제출한 점수를 수정할 수 있는지 (새 평가룸 기본: 가능) */
  allowEdit: boolean;
  /** 참여자에게도 발표 목록의 사람별 평가 현황(전체·평가함·평가 불가·미평가 인원)을 보여 줄지 (새 평가룸 기본: 숨김). 룸 관리자는 항상 본다 */
  showRatingStatus: boolean;
  /** 집계(평균·순위)에 넣을 점수: 본인 점수 / 같은 발표 팀원이 준 점수 / 같은 회사 팀원이 준 점수 (기본: 모두 포함) */
  countSelf: boolean; countSameCrew: boolean; countSameTeam: boolean;
  /** 룸 관리자도 평가할지 (새 평가룸 기본: 함). 끄면 관리자는 평가자에서 빠진다. 관리자는 어떤 경우에도 발표하지 않는다 */
  allowAdminRating: boolean;
  /** 룸 관리자가 준 점수를 집계(평균·순위)에 넣을지 (기본: 포함) */
  countAdmin: boolean;
  /** 발표 화면 위쪽 참여자·발표 등록·발표 미등록 인원을 일반 참여자에게도 보여 줄지 (기본: 숨김). 룸 관리자는 항상 본다 */
  showRosterSummary: boolean;
}

/** 입장 코드. expiresAt이 null이면 기간 무제한 (중지할 때까지 유효) */
export interface Invite { code: string; issuedAt: number; expiresAt: number | null; issuedBy: ID; revokedAt: number | null }

export interface Project {
  id: ID; name: string; description: string; createdBy: ID; createdAt: number;
  status: 'OPEN' | 'CLOSED'; closedAt: number | null;
  settings: Settings;
  /** 입장 코드는 룸 관리자에게만 내려온다 */
  invite: Invite | null;
  /** 평가룸 쓰기마다 올라가는 값. 평가를 지우는 변경을 확인받을 때 함께 보낸다 */
  version: number;
}

/** 평가룸 참여자. teamIdAtJoin은 참여 당시 회사 팀이며 이후 조직이 바뀌어도 그대로다 */
export interface Membership { projectId: ID; userId: ID; teamIdAtJoin: ID | null; teamNameAtJoin: string | null; isAdmin: boolean; joinedAt: number }
