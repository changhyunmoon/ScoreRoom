import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

/** 비밀번호는 바꿀 때만 newPassword와 currentPassword를 함께 보낸다 */
export interface ProfileForm {
  loginId: string; name: string; phone: string; teamId: ID | null; position: string;
  currentPassword?: string; newPassword?: string;
}

export const updateProfile = (form: ProfileForm) => http.put('/me', form);
