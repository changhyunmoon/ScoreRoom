// 회사 조직도 조회와 시스템 관리자의 팀·사용자 관리
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';
import type { Team } from '../model/types';

/** 가입 화면용 팀 목록 (로그인 전에도 조회) */
export const fetchTeams = () => http.get<Team[]>('/teams');

export const addTeam = (name: string, parentId: ID | null) => http.post<{ id: ID }>('/admin/teams', { name, parentId });
export const updateTeam = (id: ID, name: string, parentId: ID | null) => http.put(`/admin/teams/${id}`, { name, parentId });
export const deleteTeam = (id: ID) => http.del(`/admin/teams/${id}`);

export interface NewUserForm { loginId: string; password: string; name: string; phone: string; position: string }
export const addUserToTeam = (teamId: ID, form: NewUserForm) => http.post<{ id: ID }>(`/admin/teams/${teamId}/users`, form);
export const setUserTeam = (userId: ID, teamId: ID | null) => http.put(`/admin/users/${userId}/team`, { teamId });
/** 팀 안에서 한 칸 위(-1)·아래(+1)로 옮긴다. 위에 있을수록 높은 사람 */
export const moveUserInTeam = (userId: ID, dir: -1 | 1) => http.post(`/admin/users/${userId}/move`, { dir });
export const setUserPosition = (userId: ID, position: string) => http.put(`/admin/users/${userId}/position`, { position });
/** 전체 열람 권한 주기·회수 */
export const setViewAll = (userId: ID, enabled: boolean) => http.put(`/admin/users/${userId}/view-all`, { enabled });
/** 시스템 관리자 화면의 평가룸 한 줄 */
export interface RoomOverview {
  id: ID; name: string; description: string | null; status: 'OPEN' | 'CLOSED'; createdAt: number;
  creatorName: string | null; adminNames: string | null; memberCount: number; presentationCount: number; ratingCount: number;
}
/** 시스템 관리자: 전체 평가룸 (최근 만든 순) */
export const fetchAllRooms = () => http.get<RoomOverview[]>('/admin/projects');
/** 평가룸 생성 권한 주기·회수 */
export const setCreateRoom = (userId: ID, enabled: boolean) => http.put(`/admin/users/${userId}/create-room`, { enabled });
/** 비밀번호를 잊은 사용자의 비밀번호를 새로 정한다. 그 사용자의 로그인은 모두 끊긴다 */
export const resetUserPassword = (userId: ID, password: string) => http.put(`/admin/users/${userId}/password`, { password });
