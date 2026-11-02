// 화면 목업의 데이터 저장소. 브라우저 안의 목업 API가 localStorage와 IndexedDB에 데이터를 보관한다.
// 변경 직후 최신 목업 상태를 다시 읽는다. 다른 탭의 변경은 새로 고침해야 보인다.
import { useSyncExternalStore } from 'react';
import { mockApi, mockDownload, mockUpload, MockFail } from './mock/server';

export type ID = string;

export interface Team { id: ID; name: string; parentId: ID | null }
/**
 * 사용자. loginId는 로그인에 쓰는 이메일 주소다.
 * 이메일·전화번호는 본인과 시스템 관리자에게만 내려온다 (그 외에는 빈 문자열).
 */
export interface User {
  id: ID; loginId: string; name: string; phone: string; teamId: ID | null; isSysAdmin: boolean;
  /** 직위 (예: 팀장, 선임) */
  position: string;
  /** 팀 안 순서. 작을수록 위(높은 사람). 팀 발표에서 우리 팀을 불러올 때 대표를 정하는 데 쓴다. 시스템 관리자가 조직도에서 바꾼다 */
  rank: number;
  /** 전체 열람 권한: 모든 평가룸(진행 중·마감)의 발표와 결과 집계를 볼 수 있다. 평가·등록·편집은 못 한다. 시스템 관리자가 준다 */
  canViewAll: boolean;
}
export interface Settings {
  min: number; max: number;
  aggMin: number | null; aggMax: number | null;
  /** 나 자신도 평가할 수 있는지 (기본: 불가) */
  allowSelf: boolean;
  /** 나와 같은 회사 팀인 사람도 평가할 수 있는지 (기본: 불가) */
  allowSameTeam: boolean;
  /** 내가 구성원인 발표의 다른 구성원(같은 발표 팀원)도 평가할 수 있는지 (기본: 불가) */
  allowSameCrew: boolean;
  allowEdit: boolean;
}
/** 입장 코드. expiresAt이 null이면 기간 무제한 (중지할 때까지 유효) */
export interface Invite { code: string; issuedAt: number; expiresAt: number | null; issuedBy: ID; revokedAt?: number | null }
/**
 * 평가룸 초대 (룸 운영자 → 사용자). 받은 사람은 우측 상단 알림에서 참여하거나 거절한다.
 * 받은 사람에게는 자기 초대가, 룸 운영자에게는 그 평가룸에서 보낸 대기 중인 초대가 내려온다.
 */
export interface Invitation { id: ID; projectId: ID; projectName: string; inviterId: ID; inviterName: string; inviteeId: ID; createdAt: number }
export interface Project {
  id: ID; name: string; description: string; createdBy: ID; createdAt: number;
  status: 'OPEN' | 'CLOSED'; closedAt?: number | null;
  /** 입장 코드는 룸 운영자에게만 내려온다 */
  settings: Settings; invite: Invite | null;
}
export interface Membership { projectId: ID; userId: ID; teamIdAtJoin: ID | null; isAdmin: boolean; joinedAt: number }
/** 발표 유형: 개인 / 팀 */
export type PresType = 'PERSONAL' | 'TEAM';
/**
 * 발표 구성원
 * - leaderId: 대표 (1명). 대표로만 표시하고 발표자·팀원 목록에는 넣지 않는다.
 * - presenterIds: 발표자. 대표가 발표도 하면 대표도 여기에 들어간다 (대표+발표자)
 * - memberIds: 팀원 (대표 외에 함께 준비한 사람)
 * 평가 규칙(본인 발표·같은 팀 제한)은 구성원 전체(involvedIds)에 적용한다.
 */
export interface Presentation {
  id: ID; projectId: ID; title: string; intro: string; type: PresType;
  leaderId: ID; order: number; presenterIds: ID[]; memberIds: ID[];
  createdBy: ID; // 발표를 만든 사람 (대표가 아닐 수 있음)
  createdAt: number; // 등록 시각 (등록순 정렬)
  /** 배포 URL (선택) */
  deployUrl: string | null;
  /** 발표 자료 (여러 개, 선택). 평가룸 참여자 누구나 내려받을 수 있다 */
  attachments: Attachment[];
  /** 점수를 받은 적이 있는지. 받았으면 구성원 추가·제외를 막는다 (누가 몇 점인지는 모름) */
  hasRatings?: boolean;
}
export interface Attachment { id: ID; name: string; size: number; contentType: string; uploadedAt: number; uploadedBy: ID }
/** 발표 자료: 파일 하나당 최대 크기, 발표당 최대 개수 */
export const MAX_ATTACHMENT_MB = 50;
export const MAX_ATTACHMENTS = 10;
export const involvedIds = (p: Presentation): ID[] => Array.from(new Set([p.leaderId, ...p.presenterIds, ...(p.memberIds ?? [])]));
export type PresRole = 'PRESENTER' | 'MEMBER';
export const roleOf = (p: Presentation, id: ID): 'LEADER' | PresRole | null =>
  p.leaderId === id ? 'LEADER' : p.presenterIds.includes(id) ? 'PRESENTER' : (p.memberIds ?? []).includes(id) ? 'MEMBER' : null;
/**
 * 점수: 평가자(raterId)가 한 발표(presentationId)의 구성원 한 명(targetId)에게 준 점수와 피드백.
 * 발표의 대표·발표자·팀원이 각자 따로 평가받는다. 룸 운영자는 그 평가룸 전체, 일반 참여자는 본인이 준 것만 내려온다.
 */
export interface Rating {
  id: ID; projectId: ID; presentationId: ID; targetId: ID; raterId: ID; score: number;
  /** 피드백 (선택). 작성자 본인과 룸 운영자만 본다 */
  feedback: string | null;
  /** 마지막으로 저장한 시각. 수정 이력은 따로 남기지 않는다 */
  submittedAt: number;
}
/** 목업 API가 계산한 발표 구성원별 집계. 룸 운영자와 전체 열람 권한자에게만 내려온다 */
export interface Summary {
  presentationId: ID; targetId: ID; total: number; blocked: number; eligible: number; scored: number; notRated: number;
  avg: number | null; inCount: number; inAvg: number | null;
}
export const MAX_FEEDBACK_LENGTH = 1000;

export interface DB {
  teams: Team[]; users: User[]; projects: Project[]; memberships: Membership[];
  presentations: Presentation[]; ratings: Rating[]; summaries: Summary[];
  invitations: Invitation[];
}

const TOKEN_KEY = 'scoreroom-token';
const EMPTY: DB = { teams: [], users: [], projects: [], memberships: [], presentations: [], ratings: [], summaries: [], invitations: [] };

/** loading: 로그인 정보 확인 중, ready: 로그인됨, anon: 로그인 안 됨 */
type Status = 'loading' | 'ready' | 'anon';

function readToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t: string | null) {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

let token = readToken();
let db: DB = EMPTY;
let session: ID | null = null;
let status: Status = token ? 'loading' : 'anon';
let snapshot: { db: DB; session: ID | null; status: Status } = { db, session, status };
const listeners = new Set<() => void>();
function emit() { snapshot = { db, session, status }; listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useStore() { return useSyncExternalStore(subscribe, () => snapshot); }
export function getDB() { return db; }

export class AppError extends Error {}

/* ---------- 브라우저 목업 API ---------- */
async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await mockApi(method, path, body, token);
  return handle<T>(r.status, r.data);
}

function handle<T>(code: number, data: any): T {
  if (code === 401 && token) { signOut(); throw new AppError('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
  if (code < 200 || code >= 300) throw new AppError(data?.message ?? '오류가 발생했습니다.');
  return data as T;
}

/** 로그인한 사람이 볼 수 있는 데이터를 다시 받는다 */
export async function refresh() {
  if (!token) return;
  const s = await api<DB & { me: User }>('GET', '/state');
  const { me, ...rest } = s;
  db = rest;
  session = me.id;
  status = 'ready';
  emit();
}

/** 변경 요청 후 최신 데이터를 다시 받는다 */
async function mutate<T>(call: Promise<T>): Promise<T> {
  const result = await call;
  await refresh();
  return result;
}

function signOut() {
  token = null; writeToken(null);
  db = EMPTY; session = null; status = 'anon';
  emit();
}

async function signIn(t: string) {
  token = t; writeToken(t);
  await refresh();
}

// 앱 시작: 저장된 토큰이 있으면 데이터를 받아온다
if (token) refresh().catch(() => signOut());

/* ---------- 계정 ---------- */
export async function login(loginId: string, password: string) {
  const { token: t } = await api<{ token: string }>('POST', '/auth/login', { loginId, password });
  await signIn(t);
}
export async function logout() {
  try { await api('POST', '/auth/logout'); } catch { /* 이미 만료된 경우 */ }
  signOut();
}
export async function signup(f: { loginId: string; password: string; name: string; phone: string; teamId: ID | null; position: string }) {
  const { token: t } = await api<{ token: string }>('POST', '/auth/signup', f);
  await signIn(t);
}
export async function findIds(name: string, phone: string) {
  return (await api<{ loginIds: string[] }>('POST', '/auth/find-ids', { name, phone })).loginIds;
}
export async function resetPassword(loginId: string, name: string, phone: string, newPassword: string) {
  await api('POST', '/auth/reset-password', { loginId, name, phone, newPassword });
}
export async function updateProfile(_actor: ID, p: { loginId: string; name: string; phone: string; teamId: ID | null; position: string; password?: string }) {
  await mutate(api('PUT', '/me', p));
}

/** 가입 화면용 팀 목록 (로그인 전) */
export async function loadPublicTeams() {
  if (status === 'ready') return;
  db = { ...db, teams: await api<Team[]>('GET', '/teams') };
  emit();
}

/* ---------- 목업용 빠른 로그인과 데이터 초기화 ---------- */
export interface DemoAccount { id: ID; loginId: string; name: string; teamName: string | null; isSysAdmin: boolean }
export async function demoAccounts(): Promise<DemoAccount[]> {
  return (await api<{ accounts: DemoAccount[] }>('GET', '/auth/demo-accounts')).accounts;
}
export async function loginAs(userId: ID) {
  const { token: t } = await api<{ token: string }>('POST', '/auth/demo-login', { userId });
  await signIn(t);
}
export async function resetDemo() {
  await api('POST', '/demo/reset');
  signOut();
}

/* ---------- 시스템 관리자: 팀 ---------- */
export async function addUserToTeam(_actor: ID, teamId: ID, form: { loginId: string; password: string; name: string; phone: string; position: string }) {
  await mutate(api('POST', `/admin/teams/${teamId}/users`, form));
}
export async function addTeam(_actor: ID, name: string, parentId: ID | null) {
  await mutate(api('POST', '/admin/teams', { name, parentId }));
}
export async function updateTeam(_actor: ID, id: ID, name: string, parentId: ID | null) {
  await mutate(api('PUT', `/admin/teams/${id}`, { name, parentId }));
}
export async function deleteTeam(_actor: ID, id: ID) {
  await mutate(api('DELETE', `/admin/teams/${id}`));
}
export async function setUserTeam(_actor: ID, userId: ID, teamId: ID | null) {
  await mutate(api('PUT', `/admin/users/${userId}/team`, { teamId }));
}
/** 팀 안에서 한 칸 위(-1)·아래(+1)로 옮긴다. 위에 있을수록 높은 사람 */
export async function moveUserInTeam(userId: ID, dir: -1 | 1) {
  await mutate(api('POST', `/admin/users/${userId}/move`, { dir }));
}
/** 직위 변경 */
export async function setUserPosition(userId: ID, position: string) {
  await mutate(api('PUT', `/admin/users/${userId}/position`, { position }));
}
/** 전체 열람 권한 주기·회수 */
export async function setViewAll(userId: ID, enabled: boolean) {
  await mutate(api('PUT', `/admin/users/${userId}/view-all`, { enabled }));
}

/* ---------- 평가룸 ---------- */
export async function createProject(_actor: ID, name: string, description: string) {
  return (await mutate(api<{ id: ID }>('POST', '/projects', { name, description }))).id;
}
/** 입장 코드 발급. minutes가 null이면 기간 무제한 */
export async function issueInvite(_actor: ID, pid: ID, minutes: number | null) {
  await mutate(api('POST', `/projects/${pid}/invite`, { minutes }));
}
/** 입장 코드 중지: 즉시 신규 참여를 막는다. 기존 참여자는 유지 */
export async function revokeInvite(_actor: ID, pid: ID) {
  await mutate(api('DELETE', `/projects/${pid}/invite`));
}
/* ---------- 초대 ---------- */
/** 룸 운영자가 사용자들을 초대한다. 이미 참여 중이거나 초대 대기 중인 사람은 건너뛴다. 새로 초대한 인원을 돌려준다 */
export async function inviteUsers(pid: ID, userIds: ID[]) {
  return (await mutate(api<{ invited: number }>('POST', `/projects/${pid}/invitations`, { userIds }))).invited;
}
/** 초대 취소 (룸 운영자) */
export async function cancelInvitation(id: ID) {
  await mutate(api('DELETE', `/invitations/${id}`));
}
/** 초대 수락: 평가룸에 참여하고 그 평가룸 ID를 돌려준다 */
export async function acceptInvitation(id: ID) {
  return (await mutate(api<{ projectId: ID }>('POST', `/invitations/${id}/accept`))).projectId;
}
export async function declineInvitation(id: ID) {
  await mutate(api('POST', `/invitations/${id}/decline`));
}

export async function joinByCode(_actor: ID, code: string) {
  return (await mutate(api<{ id: ID }>('POST', '/projects/join', { code }))).id;
}
export async function setMemberAdmin(_actor: ID, pid: ID, userId: ID, isAdmin: boolean) {
  await mutate(api('PUT', `/projects/${pid}/members/${userId}/admin`, { isAdmin }));
}

/** 참여자 제거 시 영향 범위 (삭제 전 확인용, 운영자 화면) */
export function removalImpact(d: DB, pid: ID, userId: ID) {
  const pres = d.presentations.filter(p => p.projectId === pid && involvedIds(p).includes(userId));
  return {
    // 그 사람이 준 점수와 그 사람이 받은 점수
    ratings: d.ratings.filter(r => r.projectId === pid && (r.raterId === userId || r.targetId === userId)).length,
    soloPresentations: pres.filter(p => involvedIds(p).length === 1),
    sharedPresentations: pres.filter(p => involvedIds(p).length > 1),
  };
}
export async function removeMember(_actor: ID, pid: ID, userId: ID) {
  await mutate(api('DELETE', `/projects/${pid}/members/${userId}`));
}
/** 화면에서 바로 보여줄 입력 검사 (목업 API도 같은 검사를 한다) */
export function validateSettings(s: Settings): string | null {
  const ints = [s.min, s.max, s.aggMin, s.aggMax].filter(v => v !== null) as number[];
  if (ints.some(v => !Number.isInteger(v))) return '점수와 범위는 정수만 사용할 수 있습니다.';
  if (s.min >= s.max) return '점수 최솟값은 최댓값보다 작아야 합니다.';
  if ((s.aggMin === null) !== (s.aggMax === null)) return '집계 기준은 최저치·최대치를 함께 설정해야 합니다.';
  if (s.aggMin !== null && s.aggMax !== null) {
    if (s.aggMin > s.aggMax) return '집계 기준 최저치가 최대치보다 클 수 없습니다.';
    if (s.aggMin < s.min || s.aggMax > s.max) return '집계 기준은 점수 입력 범위 안에 있어야 합니다.';
  }
  return null;
}
/** 점수 입력 범위가 바뀌는지 */
export const rangeChanged = (before: Settings, after: Pick<Settings, 'min' | 'max'>) =>
  before.min !== after.min || before.max !== after.max;

/**
 * 설정 저장. 점수 입력 범위가 바뀌면 목업 API가 이 평가룸의 모든 평가(점수·피드백)를 지우고
 * 집계 기준 범위도 '사용 안 함'으로 초기화한다. 지운 평가 건수를 돌려준다.
 */
export async function updateSettings(_actor: ID, pid: ID, s: Settings): Promise<number> {
  return (await mutate(api<{ removed: number }>('PUT', `/projects/${pid}/settings`, s))).removed;
}
export async function closeProject(_actor: ID, pid: ID) {
  await mutate(api('POST', `/projects/${pid}/close`));
}

/* ---------- 발표 ---------- */
/** 발표를 수정할 수 있는 사람: 관리자, 대표, 발표를 만든 사람 */
export const canEditPresentation = (p: Presentation, userId: ID, isAdmin: boolean) =>
  isAdmin || p.leaderId === userId || p.createdBy === userId;

export async function savePresentation(_actor: ID, pid: ID, data: { title: string; intro: string; type: PresType; leaderId: ID; presenterIds: ID[]; memberIds: ID[]; deployUrl: string | null }, prid?: ID) {
  const call = prid
    ? api<{ id: ID }>('PUT', `/projects/${pid}/presentations/${prid}`, data)
    : api<{ id: ID }>('POST', `/projects/${pid}/presentations`, data);
  return (await mutate(call)).id;
}
export async function deletePresentation(_actor: ID, pid: ID, prid: ID) {
  await mutate(api('DELETE', `/projects/${pid}/presentations/${prid}`));
}
export async function movePresentation(_actor: ID, pid: ID, prid: ID, dir: -1 | 1) {
  await mutate(api('POST', `/projects/${pid}/presentations/${prid}/move`, { dir }));
}
/** 드래그로 바꾼 전체 순서를 저장 */
export async function reorderPresentations(_actor: ID, pid: ID, orderedIds: ID[]) {
  await mutate(api('PUT', `/projects/${pid}/presentations/order`, { ids: orderedIds }));
}

/* ---------- 발표 자료 (여러 개, 형식 제한 없음, 파일당 최대 50MB, 발표당 최대 10개) ---------- */
const attachmentsPath = (pid: ID, prid: ID) => `/projects/${pid}/presentations/${prid}/attachments`;

/** 파일 하나 추가: 브라우저 목업 API가 파일을 IndexedDB에 보관한다 */
export async function uploadAttachment(pid: ID, prid: ID, file: File) {
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) throw new AppError(`발표 자료는 파일당 ${MAX_ATTACHMENT_MB}MB 이하만 올릴 수 있습니다.`);
  const { status, data } = await mockUpload(pid, prid, file, token);
  handle(status, data);
}
/** 여러 파일을 차례로 올리고 마지막에 한 번 새로 받는다 */
export async function uploadAttachments(pid: ID, prid: ID, files: File[]) {
  try {
    for (const f of files) await uploadAttachment(pid, prid, f);
  } finally {
    await refresh();
  }
}
/** DELETE /projects/{pid}/presentations/{prid}/attachments/{attachmentId} */
export async function removeAttachment(pid: ID, prid: ID, attachmentId: ID) {
  await mutate(api('DELETE', `${attachmentsPath(pid, prid)}/${attachmentId}`));
}
/** GET /projects/{pid}/presentations/{prid}/attachments/{attachmentId}. 평가룸 참여자 누구나 내려받는다 */
export async function downloadAttachment(pid: ID, prid: ID, attachment: Attachment) {
  let blob: Blob;
  try { blob = await mockDownload(pid, prid, attachment.id, token); }
  catch (e) { throw new AppError(e instanceof MockFail ? e.message : '내려받지 못했습니다.'); }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ---------- 평가 ---------- */
/** 발표 구성원 한 명에게 점수(필수)와 피드백(선택)을 준다. PUT /projects/{pid}/presentations/{prid}/ratings/{targetId} */
export async function submitRating(_actor: ID, pid: ID, prid: ID, targetId: ID, score: number, feedback: string) {
  await mutate(api('PUT', `/projects/${pid}/presentations/${prid}/ratings/${targetId}`, { score, feedback: feedback.trim() || null }));
}
