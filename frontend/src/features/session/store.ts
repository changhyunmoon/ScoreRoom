// 로그인 세션과 화면 데이터 (전환용 /state 어댑터).
// 서버가 권한에 맞게 걸러 보낸 데이터를 한 곳에 두고 화면이 함께 읽는다.
// - 앱 시작: /state를 불러 로그인 상태를 확인한다 (401이면 로그인 안 됨)
// - 변경 요청이 성공하면 mutate()가 /state를 다시 받는다
// - 15초마다(탭이 보일 때만) 다시 받아 다른 사람의 변경을 반영한다. 입력 중인 폼 값은 각 화면의 상태라 바뀌지 않는다
import { useSyncExternalStore } from 'react';
import { ApiError, http, setUnauthenticatedHandler } from '../../shared/api/client';
import { toast } from '../../shared/ui';
import type { ID } from '../../shared/lib/types';
import type { DB, StateResponse } from './model/types';

/** loading: 로그인 정보 확인 중, ready: 로그인됨, anon: 로그인 안 됨 */
export type SessionStatus = 'loading' | 'ready' | 'anon';

const EMPTY: DB = { teams: [], users: [], projects: [], memberships: [], presentations: [], ratings: [], summaries: [], invitations: [] };
const POLL_MS = 15_000;

/** loadedAt: 마지막으로 서버 데이터를 받은 시각 */
let snapshot: { db: DB; meId: ID | null; status: SessionStatus; loadedAt: number } = { db: EMPTY, meId: null, status: 'loading', loadedAt: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach(l => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** 화면에서 데이터와 로그인 사용자를 읽는다 */
export function useSession() {
  const { db, meId, status, loadedAt } = useSyncExternalStore(subscribe, () => snapshot);
  return { db, status, loadedAt, me: db.users.find(u => u.id === meId) ?? null };
}

/** 로그인한 사람이 볼 수 있는 데이터를 다시 받는다 */
export async function refresh() {
  const { me, ...db } = await http.get<StateResponse>('/state');
  set({ db, meId: me.id, status: 'ready', loadedAt: Date.now() });
}

/** 변경 요청 후 최신 데이터를 다시 받는다. 다른 변경과 충돌(409)해도 최신 상태를 보여준다 */
export async function mutate<T>(call: Promise<T>): Promise<T> {
  try {
    const result = await call;
    await refresh();
    return result;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) await refresh().catch(() => undefined);
    throw e;
  }
}

/** 로그아웃·세션 만료: 이전 사용자의 데이터를 화면에서 모두 지운다 */
export function clearSession() {
  set({ db: EMPTY, meId: null, status: 'anon', loadedAt: 0 });
}

setUnauthenticatedHandler(() => {
  if (snapshot.status !== 'ready') return;
  clearSession();
  toast('로그인이 만료되었습니다. 다시 로그인해 주세요.', 'err');
});

/** 앱 시작 시 한 번 부른다 */
export function startSession() {
  refresh().catch(e => {
    if (!(e instanceof ApiError && e.status === 401)) toast('서버에 연결할 수 없습니다. 잠시 후 새로 고침해 주세요.', 'err');
    clearSession();
  });

  const poll = () => {
    if (snapshot.status === 'ready' && document.visibilityState === 'visible' && navigator.onLine) {
      refresh().catch(() => undefined); // 배경 갱신 실패는 기존 데이터를 그대로 둔다
    }
  };
  window.setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
}
