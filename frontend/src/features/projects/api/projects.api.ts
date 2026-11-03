// 평가룸: 생성, 입장, 입장 코드, 참여자, 설정, 마감
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';
import type { Settings } from '../model/types';

export const createProject = async (name: string, description: string) =>
  (await http.post<{ id: ID }>('/projects', { name, description })).id;

export const joinByCode = async (code: string) => (await http.post<{ id: ID }>('/projects/join', { code })).id;

/** 입장 코드 발급. minutes가 null이면 기간 무제한. 이전 코드는 바로 무효가 된다 */
export const issueInvite = (pid: ID, minutes: number | null) => http.post(`/projects/${pid}/invite`, { minutes });
/** 입장 코드 중지: 즉시 신규 참여를 막는다. 기존 참여자는 유지 */
export const revokeInvite = (pid: ID) => http.del(`/projects/${pid}/invite`);

export const setMemberAdmin = (pid: ID, userId: ID, isAdmin: boolean) =>
  http.put(`/projects/${pid}/members/${userId}/admin`, { isAdmin });

/** 참여자 제거. expectedVersion은 화면이 제거 영향을 보여줄 때 본 평가룸 version (그 사이 바뀌었으면 409) */
export const removeMember = (pid: ID, userId: ID, expectedVersion: number) =>
  http.del(`/projects/${pid}/members/${userId}?expectedVersion=${expectedVersion}`);

/**
 * 설정 저장. 점수 입력 범위가 바뀌면 이 평가룸의 모든 평가를 지우고 집계 기준도 '사용 안 함'으로 되돌린다.
 * 평가를 지우는 변경은 expectedVersion이 지금과 같아야 한다. 지운 평가 건수를 돌려준다.
 */
export const updateSettings = async (pid: ID, settings: Settings, expectedVersion: number) =>
  (await http.put<{ removed: number }>(`/projects/${pid}/settings`, { ...settings, expectedVersion })).removed;

export const closeProject = (pid: ID) => http.post(`/projects/${pid}/close`);
