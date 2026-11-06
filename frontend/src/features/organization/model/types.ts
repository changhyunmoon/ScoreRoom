import type { ID } from '../../../shared/lib/types';

export interface Team { id: ID; name: string; parentId: ID | null }

/**
 * 사용자. loginId는 로그인에 쓰는 이메일 주소다.
 * 이메일·전화번호는 본인과 시스템 관리자에게만 내려온다 (그 외에는 빈 문자열).
 */
export interface User {
  id: ID; loginId: string; name: string; phone: string; teamId: ID | null; isSysAdmin: boolean;
  /** 직위 (예: 팀장, 선임) */
  position: string;
  /** 팀 안 순서. 작을수록 위(높은 사람). 팀 발표에서 우리 팀을 불러올 때 대표를 정하는 데 쓴다 */
  rank: number;
  /** 전체 열람 권한: 모든 평가룸의 발표와 결과 집계를 볼 수 있다. 평가·등록·편집은 못 한다 */
  canViewAll: boolean;
  /** 평가룸 생성 권한: 시스템 관리자가 준다. 있어야 평가룸을 만들 수 있다 */
  canCreateRoom: boolean;
}
