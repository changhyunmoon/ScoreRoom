import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { reportError } from '../lib/errorReporter';

/* ---------- 토스트 ---------- */
type ToastItem = { id: number; text: string; tone: 'ok' | 'err' };
let toasts: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();

export function toast(text: string, tone: ToastItem['tone'] = 'ok') {
  const t = { id: Date.now() + Math.random(), text, tone };
  toasts = [...toasts, t];
  listeners.forEach(l => l(toasts));
  setTimeout(() => { toasts = toasts.filter(x => x !== t); listeners.forEach(l => l(toasts)); }, 2600);
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => { listeners.add(setList); return () => { listeners.delete(setList); }; }, []);
  return <div className="toaster" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>;
}

/** 사용자 행동을 실행하고 성공 안내 또는 오류 토스트를 띄운다. 성공 여부를 돌려준다 */
export async function run(fn: () => unknown, okText?: string): Promise<boolean> {
  try {
    await fn();
    if (okText) toast(okText);
    return true;
  } catch (e) {
    toast(errorMessage(e), 'err');
    if (!(e instanceof ApiError) && !(e instanceof UserError)) { console.error(e); reportError(e); }
    return false;
  }
}

/** 화면에서 직접 만드는 안내용 오류 (서버 오류가 아님) */
export class UserError extends Error {}

export function errorMessage(e: unknown) {
  // 서버 오류(5xx)는 오류 번호를 함께 보여 준다. 사용자가 알려 주면 시스템 관리자 로그에서 바로 찾을 수 있다
  if (e instanceof ApiError && e.status >= 500 && e.requestId) return `${e.message} (오류 번호 ${e.requestId})`;
  return e instanceof ApiError || e instanceof UserError ? e.message : '오류가 발생했어요.';
}
