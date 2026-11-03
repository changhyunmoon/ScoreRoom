// Spring API 공통 클라이언트.
// - 모든 요청은 같은 출처의 /api/v1로 보낸다 (개발: Vite가 Spring으로 전달, 운영: Nginx가 전달)
// - 인증은 세션 쿠키로 하고, 쓰기 요청에는 서버가 알려준 CSRF 헤더를 붙인다
// - 오류는 ApiError 하나로 바꾼다. 화면 이동이나 토스트는 여기서 하지 않는다
const BASE = '/api/v1';

export interface FieldError { field: string; message: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    readonly requestId: string | null = null,
  ) {
    super(message);
  }
}

/* ---------- CSRF ---------- */
let csrf: { headerName: string; token: string } | null = null;

async function csrfHeader(): Promise<Record<string, string>> {
  if (!csrf) {
    const res = await send('GET', '/auth/csrf');
    csrf = await res.json();
  }
  return { [csrf!.headerName]: csrf!.token };
}

/** 로그인·로그아웃으로 세션이 바뀌면 토큰을 새로 받게 한다 */
export function resetCsrf() {
  csrf = null;
}

/* ---------- 인증 만료 ---------- */
let onUnauthenticated: (() => void) | null = null;

/** 보호된 API가 401(세션 만료)을 돌려줄 때 부를 함수. 세션 저장소가 등록한다 */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler;
}

/* ---------- 요청 ---------- */
async function send(method: string, path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(BASE + path, { ...init, method, credentials: 'same-origin' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.');
  }
}

async function toError(res: Response): Promise<ApiError> {
  let body: { code?: string; message?: string; fieldErrors?: FieldError[]; requestId?: string } = {};
  try { body = await res.json(); } catch { /* HTML·빈 응답 */ }
  return new ApiError(res.status, body.code ?? 'UNKNOWN', body.message ?? '오류가 발생했습니다.', body.fieldErrors ?? [], body.requestId ?? null);
}

async function request(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  const write = method !== 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', ...(write ? await csrfHeader() : {}) };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; // boundary는 브라우저가 정한다
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await send(method, path, { headers, body: payload, signal });
  if (res.ok) return res;

  const error = await toError(res);
  if (error.code === 'CSRF_INVALID') resetCsrf(); // 새 토큰을 받아 다시 시도하도록 안내한다
  if (error.status === 401 && error.code === 'UNAUTHENTICATED') onUnauthenticated?.();
  throw error;
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: async <T>(path: string, signal?: AbortSignal) => json<T>(await request('GET', path, undefined, signal)),
  post: async <T = void>(path: string, body?: unknown) => json<T>(await request('POST', path, body)),
  put: async <T = void>(path: string, body?: unknown) => json<T>(await request('PUT', path, body)),
  del: async <T = void>(path: string) => json<T>(await request('DELETE', path)),
  /** multipart 업로드 */
  upload: async <T>(path: string, form: FormData) => json<T>(await request('POST', path, form)),
  /** 파일 내려받기 (오류 응답을 파일로 저장하지 않는다) */
  blob: async (path: string) => (await request('GET', path)).blob(),
};
