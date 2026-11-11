// 발표 자료 (형식 제한 없음, 파일당 최대 50MB, 발표당 최대 10개)
import { http } from '../../../shared/api/client';
import { saveFile } from '../../../shared/lib/download';
import type { ID } from '../../../shared/lib/types';
import { UserError } from '../../../shared/ui';
import { MAX_ATTACHMENT_MB, type Attachment } from '../model/types';

const path = (pid: ID, prid: ID) => `/projects/${pid}/presentations/${prid}/attachments`;

/** 파일 하나를 올린다 (multipart의 file 필드) */
export async function uploadAttachment(pid: ID, prid: ID, file: File) {
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) throw new UserError(`발표 자료는 파일당 ${MAX_ATTACHMENT_MB}MB 이하만 올릴 수 있어요.`);
  const form = new FormData();
  form.append('file', file);
  return http.upload<Attachment>(path(pid, prid), form);
}

export const removeAttachment = (pid: ID, prid: ID, attachmentId: ID) => http.del(`${path(pid, prid)}/${attachmentId}`);

/** 평가룸 참여자와 전체 열람 권한자가 내려받는다 */
export async function downloadAttachment(pid: ID, prid: ID, attachment: Attachment) {
  saveFile(await http.blob(`${path(pid, prid)}/${attachment.id}`), attachment.name);
}
