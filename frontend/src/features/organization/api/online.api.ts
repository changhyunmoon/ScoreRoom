// 시스템 관리자: 지금 로그인해 있는 사람
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

export interface OnlineUser {
  userId: ID; name: string; loginId: string; teamName: string | null; position: string | null; sysAdmin: boolean;
  /** 로그인해 있는 기기(세션) 수 */
  sessionCount: number;
  loginAt: number; lastAccessAt: number;
  /** 마지막 활동이 1분 이내 = 지금 화면을 보는 중 */
  active: boolean;
  ip: string | null; userAgent: string | null;
}

export interface OnlineUsers { serverTime: number; users: OnlineUser[] }

export const fetchOnlineUsers = () => http.get<OnlineUsers>('/admin/online');
