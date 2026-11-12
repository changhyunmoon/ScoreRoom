// 화면(브라우저)에서 난 오류를 서버 로그로 보낸다. 시스템 관리자 로그 화면의 '화면 오류'로 보인다.
// - 같은 메시지는 1분에 한 번만 보낸다 (반복되는 오류가 로그를 덮지 않게)
// - 서버가 이미 기록한 API 오류(ApiError)는 보내지 않는다
// - 보내기에 실패해도 아무것도 하지 않는다
import { ApiError, http } from '../api/client';

const sentAt = new Map<string, number>();
const WINDOW = 60_000;
const cut = (s: string | undefined, max: number) => (s && s.length > max ? s.slice(0, max) : s);

export function reportError(error: unknown, componentStack?: string) {
  if (error instanceof ApiError) return;
  if (error instanceof DOMException && error.name === 'AbortError') return;
  const e = error instanceof Error ? error : null;
  const message = e ? `${e.name}: ${e.message}` : String(error);
  const now = Date.now();
  if ((sentAt.get(message) ?? 0) > now - WINDOW) return;
  sentAt.set(message, now);
  if (sentAt.size > 100) sentAt.clear();
  http.post('/client-errors', {
    message: cut(message, 1000),
    stack: cut(e?.stack, 8000),
    url: window.location.href,
    componentStack: cut(componentStack, 4000),
  }).catch(() => { /* 무시 */ });
}

/** 앱 시작 때 한 번 부른다 */
export function startErrorReporter() {
  window.addEventListener('error', ev => {
    // 이미지·스크립트 로딩 실패는 error 객체가 없다. 메시지라도 남긴다
    reportError(ev.error ?? (ev.message ? new Error(ev.message) : 'Script error'));
  });
  window.addEventListener('unhandledrejection', ev => reportError(ev.reason));
}
