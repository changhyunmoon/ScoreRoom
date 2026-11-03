// 로그인·로그아웃·가입. 세션은 쿠키로 유지하고, 세션이 바뀌면 CSRF 토큰을 새로 받는다
import { http, resetCsrf } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';
import { clearSession, refresh } from '../../session';

export interface SignupForm { loginId: string; password: string; name: string; phone: string; teamId: ID | null; position: string }

/** 로그인 화면에서 보여줄 기능 (회원가입은 운영 정책에 따라 켜고 끈다) */
export const fetchAuthOptions = () => http.get<{ signupEnabled: boolean }>('/auth/options');

export async function login(loginId: string, password: string) {
  await http.post('/auth/login', { loginId, password });
  resetCsrf();
  await refresh();
}

export async function signup(form: SignupForm) {
  await http.post('/auth/signup', form);
  resetCsrf();
  await refresh();
}

/** 이름·전화번호가 맞는 계정의 이메일 (서버가 일부를 가려서 보낸다) */
export const findLoginIds = async (name: string, phone: string) =>
  (await http.post<{ loginIds: string[] }>('/auth/find-ids', { name, phone })).loginIds;

/** 이메일·이름·전화번호가 모두 맞으면 새 비밀번호로 바꾼다. 그 계정의 기존 로그인은 모두 끊긴다 */
export const resetPassword = (loginId: string, name: string, phone: string, newPassword: string) =>
  http.post('/auth/reset-password', { loginId, name, phone, newPassword });

/** 서버 세션이 끝난 것을 확인한 뒤에만 화면 데이터를 지운다 (실패하면 오류를 알린다) */
export async function logout() {
  await http.post('/auth/logout');
  resetCsrf();
  clearSession();
}
