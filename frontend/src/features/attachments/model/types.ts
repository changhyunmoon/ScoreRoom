import type { ID } from '../../../shared/lib/types';

export interface Attachment { id: ID; name: string; size: number; contentType: string; uploadedAt: number; uploadedBy: ID }

/** 발표 자료: 파일 하나당 최대 크기, 발표당 최대 개수 (서버도 같은 제한을 검사한다) */
export const MAX_ATTACHMENT_MB = 50;
export const MAX_ATTACHMENTS = 10;
