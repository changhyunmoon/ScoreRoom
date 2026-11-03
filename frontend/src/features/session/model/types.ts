import type { Invitation } from '../../invitations';
import type { Team, User } from '../../organization';
import type { Presentation } from '../../presentations';
import type { Membership, Project } from '../../projects';
import type { Rating } from '../../ratings';
import type { Summary } from '../../results';

/** 로그인한 사람이 볼 수 있는 화면 데이터 (서버가 권한에 맞게 걸러서 보낸다) */
export interface DB {
  teams: Team[]; users: User[]; projects: Project[]; memberships: Membership[];
  presentations: Presentation[]; ratings: Rating[]; summaries: Summary[];
  invitations: Invitation[];
}

/** GET /state 응답 */
export type StateResponse = DB & { me: User };
