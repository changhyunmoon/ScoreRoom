import type { ID } from '../../../shared/lib/types';

export interface Settings {
  min: number; max: number;
  aggMin: number | null; aggMax: number | null;
  /** 나 자신도 평가할 수 있는지 (기본: 불가) */
  allowSelf: boolean;
  /** 나와 같은 회사 팀인 사람도 평가할 수 있는지 (기본: 불가) */
  allowSameTeam: boolean;
  /** 내가 구성원인 발표의 다른 구성원(같은 발표 팀원)도 평가할 수 있는지 (기본: 불가) */
  allowSameCrew: boolean;
  allowEdit: boolean;
}

/** 입장 코드. expiresAt이 null이면 기간 무제한 (중지할 때까지 유효) */
export interface Invite { code: string; issuedAt: number; expiresAt: number | null; issuedBy: ID; revokedAt: number | null }

export interface Project {
  id: ID; name: string; description: string; createdBy: ID; createdAt: number;
  status: 'OPEN' | 'CLOSED'; closedAt: number | null;
  settings: Settings;
  /** 입장 코드는 룸 운영자에게만 내려온다 */
  invite: Invite | null;
  /** 평가룸 쓰기마다 올라가는 값. 평가를 지우는 변경을 확인받을 때 함께 보낸다 */
  version: number;
}

/** 평가룸 참여자. teamIdAtJoin은 참여 당시 회사 팀이며 이후 조직이 바뀌어도 그대로다 */
export interface Membership { projectId: ID; userId: ID; teamIdAtJoin: ID | null; teamNameAtJoin: string | null; isAdmin: boolean; joinedAt: number }
