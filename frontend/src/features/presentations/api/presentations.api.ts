// 발표 등록·수정·삭제와 순서
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';
import type { PresentationInput } from '../model/types';

/** prid가 있으면 수정, 없으면 등록. 발표 ID를 돌려준다 */
export const savePresentation = async (pid: ID, data: PresentationInput, prid?: ID) =>
  (prid
    ? await http.put<{ id: ID }>(`/projects/${pid}/presentations/${prid}`, data)
    : await http.post<{ id: ID }>(`/projects/${pid}/presentations`, data)).id;

export const deletePresentation = (pid: ID, prid: ID) => http.del(`/projects/${pid}/presentations/${prid}`);
export const movePresentation = (pid: ID, prid: ID, dir: -1 | 1) => http.post(`/projects/${pid}/presentations/${prid}/move`, { dir });
/** 드래그로 바꾼 전체 순서를 저장 */
export const reorderPresentations = (pid: ID, orderedIds: ID[]) => http.put(`/projects/${pid}/presentations/order`, { ids: orderedIds });

/** 룸 관리자: 발표 미등록자에게 발표 등록 요청 알림을 보낸다. 실제로 보낸 인원을 돌려준다 */
export const requestPresentations = async (pid: ID, userIds: ID[]) =>
  (await http.post<{ sent: number }>(`/projects/${pid}/presentation-requests`, { userIds })).sent;
