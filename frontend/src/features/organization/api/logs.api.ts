// 시스템 관리자 로그 조회와 화면 오류 전송
import { http } from '../../../shared/api/client';
import type { ID } from '../../../shared/lib/types';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: ID; createdAt: number; category: string; level: LogLevel; action: string; message: string;
  actorId: ID | null; actorName: string | null; projectId: ID | null; projectName: string | null;
  requestId: string | null; httpMethod: string | null; path: string | null; status: number | null;
  ip: string | null; userAgent: string | null; errorType: string | null;
  /** 목록에서는 앞 300자만. detailTruncated면 상세 조회로 전체를 받는다 */
  detail: string | null; detailTruncated: boolean;
}

export interface LogPage { items: LogEntry[]; nextCursor: string | null }

export interface LogSummary {
  byCategory: Record<string, number>; byAction: Record<string, number>;
  last24hByCategory: Record<string, number>; last24hByAction: Record<string, number>;
  lastServerErrorAt: number | null;
}

export interface LogActions {
  categories: { code: string; label: string }[];
  actions: { code: string; category: string; label: string; level: LogLevel }[];
}

export interface LogFilter {
  categories: string[]; actions: string[]; projectId: ID | null;
  from: number | null; to: number | null; q: string;
}

function params(f: LogFilter, extra: Record<string, string> = {}) {
  const p = new URLSearchParams(extra);
  if (f.categories.length) p.set('category', f.categories.join(','));
  if (f.actions.length) p.set('action', f.actions.join(','));
  if (f.projectId) p.set('projectId', f.projectId);
  if (f.from !== null) p.set('from', String(f.from));
  if (f.to !== null) p.set('to', String(f.to));
  if (f.q.trim()) p.set('q', f.q.trim());
  return p.toString();
}

export const fetchLogs = (f: LogFilter, cursor: string | null, signal?: AbortSignal) =>
  http.get<LogPage>(`/admin/logs?${params(f, cursor ? { cursor, size: '50' } : { size: '50' })}`, signal);

/** 건수는 기간·평가룸·검색어만 반영한다 (카테고리·항목 버튼마다 건수를 보여 주므로) */
export const fetchLogSummary = (f: LogFilter, signal?: AbortSignal) =>
  http.get<LogSummary>(`/admin/logs/summary?${params({ ...f, categories: [], actions: [] })}`, signal);

export const fetchLogActions = () => http.get<LogActions>('/admin/logs/actions');

export const fetchLog = (id: ID) => http.get<LogEntry>(`/admin/logs/${id}`);

