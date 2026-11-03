import { useEffect, useState } from 'react';

/** intervalMs마다 다시 그린다 (입장 코드 남은 시간 표시용) */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
