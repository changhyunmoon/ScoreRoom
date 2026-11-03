// 화면 표시용 포맷 (시각은 서버가 epoch milliseconds로 보낸다)

/** 날짜만: 2026.10.30 */
export function dateText(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 10/30 14:05 */
export function timeText(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 파일 크기: 1.2MB, 340KB */
export function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** 평균: 정수로 반올림하거나 소수 넷째 자리까지. 값이 없으면 — */
export function formatAvg(v: number | null, decimals: boolean) {
  if (v === null) return '—';
  if (!decimals) return String(Math.round(v));
  return String(Math.round(v * 10000) / 10000);
}

/** 남은 시간: 12:05 */
export const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
