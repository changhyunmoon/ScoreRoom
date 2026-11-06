// 알림
import { http } from '../../../shared/api/client';

/** 내 알림을 모두 읽음으로 표시한다 */
export const markAllNotificationsRead = () => http.post('/notifications/read');
