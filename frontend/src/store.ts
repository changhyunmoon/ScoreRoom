// 목업 데이터 저장소. 백엔드 없이 화면을 동작시키기 위해 localStorage에 저장한다.
// 실제 구현에서는 /api/v1 호출로 바뀌며, 아래 액션의 권한·검증 로직은 서버 Service로 옮긴다.
import { useSyncExternalStore } from 'react';

export type ID = string;

export interface Team { id: ID; name: string; parentId: ID | null }
export interface User {
  id: ID; loginId: string; password: string; // 목업 전용. 실제로는 비밀번호 해시만 저장
  name: string; phone: string; teamId: ID | null; isSysAdmin: boolean;
}
export interface Settings {
  min: number; max: number;
  aggMin: number | null; aggMax: number | null;
  allowSameTeam: boolean; allowEdit: boolean;
}
export interface Invite { code: string; issuedAt: number; expiresAt: number; issuedBy: ID; revokedAt?: number }
export interface Project {
  id: ID; name: string; description: string; createdBy: ID; createdAt: number;
  status: 'OPEN' | 'CLOSED'; closedAt?: number;
  settings: Settings; currentPresentationId: ID | null; invite: Invite | null;
}
export interface Membership { projectId: ID; userId: ID; teamIdAtJoin: ID | null; isAdmin: boolean; joinedAt: number }
export type PresType = 'PERSONAL' | 'TEAM' | 'FREE';
/**
 * 발표 구성원
 * - leaderId: 대표 (1명). 발표를 만든 사람이 지정하며, 대표로만 표시하고 발표자·팀원 목록에는 넣지 않는다.
 * - presenterIds: 발표자 (대표 외에 발표하는 사람)
 * - memberIds: 팀원 (대표 외에 함께 준비한 사람)
 * 평가 규칙(본인 발표·같은 팀 제한)은 구성원 전체(involvedIds)에 적용한다.
 */
export interface Presentation {
  id: ID; projectId: ID; title: string; intro: string; type: PresType;
  leaderId: ID; order: number; status: 'SCHEDULED' | 'STARTED'; presenterIds: ID[]; memberIds: ID[];
  createdBy: ID; // 발표를 만든 사람 (대표가 아닐 수 있음)
}
export const involvedIds = (p: Presentation): ID[] => Array.from(new Set([p.leaderId, ...p.presenterIds, ...(p.memberIds ?? [])]));
export type PresRole = 'PRESENTER' | 'MEMBER';
export const roleOf = (p: Presentation, id: ID): 'LEADER' | PresRole | null =>
  p.leaderId === id ? 'LEADER' : p.presenterIds.includes(id) ? 'PRESENTER' : (p.memberIds ?? []).includes(id) ? 'MEMBER' : null;
export interface Rating { id: ID; projectId: ID; presentationId: ID; raterId: ID; score: number; submittedAt: number; updatedAt: number }
export interface RatingHistory { id: ID; ratingId: ID; projectId: ID; presentationId: ID; raterId: ID; before: number; after: number; at: number }

export interface DB {
  teams: Team[]; users: User[]; projects: Project[]; memberships: Membership[];
  presentations: Presentation[]; ratings: Rating[]; history: RatingHistory[];
}

const KEY = 'scoreroom-mock-v1';
const SESSION_KEY = 'scoreroom-session';

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const MIN = 60_000;

function seed(): DB {
  const now = Date.now();
  const teams: Team[] = [
    { id: 't-dev', name: '개발본부', parentId: null },
    { id: 't-plat', name: '플랫폼팀', parentId: 't-dev' },
    { id: 't-svc', name: '서비스개발팀', parentId: 't-dev' },
    { id: 't-design', name: '디자인팀', parentId: null },
    { id: 't-plan', name: '기획팀', parentId: null },
  ];
  const u = (id: string, loginId: string, name: string, n: number, teamId: string | null, isSysAdmin = false): User =>
    ({ id, loginId, password: '1234', name, phone: `010-1234-${String(n).padStart(4, '0')}`, teamId, isSysAdmin });
  const users: User[] = [
    u('u0', 'admin', '시스템관리자', 0, null, true),
    u('u1', 'minjun', '김민준', 1, 't-plat'),
    u('u2', 'seoyeon', '이서연', 2, 't-plat'),
    u('u3', 'jihoon', '박지훈', 3, 't-svc'),
    u('u4', 'suah', '최수아', 4, 't-svc'),
    u('u5', 'yerin', '정예린', 5, 't-design'),
    u('u6', 'doyun', '강도윤', 6, 't-plan'),
    u('u7', 'haeun', '윤하은', 7, 't-design'),
  ];
  const m = (projectId: string, userId: string, isAdmin = false): Membership =>
    ({ projectId, userId, teamIdAtJoin: users.find(x => x.id === userId)!.teamId, isAdmin, joinedAt: now - 3600_000 });
  const projects: Project[] = [
    {
      id: 'p1', name: '2026 하반기 기술 세미나', description: '팀별 기술 공유 발표', createdBy: 'u1', createdAt: now - 86400_000,
      status: 'OPEN', settings: { min: 0, max: 100, aggMin: 30, aggMax: 80, allowSameTeam: false, allowEdit: true },
      currentPresentationId: 'pr2', invite: { code: 'SEM26H', issuedAt: now, expiresAt: now + 60 * MIN, issuedBy: 'u1' },
    },
    {
      id: 'p2', name: '신입 온보딩 발표회', description: '온보딩 과제 결과 발표', createdBy: 'u3', createdAt: now - 30 * 86400_000,
      status: 'CLOSED', closedAt: now - 20 * 86400_000,
      settings: { min: 0, max: 5, aggMin: null, aggMax: null, allowSameTeam: true, allowEdit: false },
      currentPresentationId: null, invite: null,
    },
  ];
  const memberships: Membership[] = [
    m('p1', 'u1', true), m('p1', 'u2'), m('p1', 'u3'), m('p1', 'u4'), m('p1', 'u5'), m('p1', 'u6', true), m('p1', 'u7'),
    m('p2', 'u3', true), m('p2', 'u2'), m('p2', 'u4'),
  ];
  const pr = (id: string, projectId: string, order: number, title: string, intro: string, type: PresType, leaderId: string, presenterIds: string[], memberIds: string[], status: Presentation['status']): Presentation =>
    ({ id, projectId, order, title, intro, type, leaderId, presenterIds, memberIds, status, createdBy: leaderId });
  const presentations: Presentation[] = [
    pr('pr1', 'p1', 1, '쿠버네티스 비용 최적화 사례', '클러스터 비용을 40% 줄인 과정과 시행착오', 'PERSONAL', 'u1', [], [], 'STARTED'),
    pr('pr2', 'p1', 2, '디자인 시스템 2.0', '컴포넌트 토큰 구조 개편과 적용 결과', 'TEAM', 'u5', ['u7'], [], 'STARTED'),
    pr('pr3', 'p1', 3, '결제 모듈 리팩터링 회고', '레거시 결제 흐름을 나누며 배운 점', 'FREE', 'u3', ['u6'], ['u4'], 'SCHEDULED'),
    pr('pr4', 'p1', 4, '고객 인터뷰로 찾은 기회', '인터뷰 30건에서 뽑은 개선 아이디어', 'PERSONAL', 'u6', [], [], 'SCHEDULED'),
    pr('pr5', 'p1', 5, 'LLM 기반 사내 검색', '사내 문서 검색 PoC 소개', 'TEAM', 'u2', ['u1'], [], 'SCHEDULED'),
    pr('pr6', 'p2', 1, '첫 달 회고', '온보딩 과제와 배운 점', 'PERSONAL', 'u4', [], [], 'STARTED'),
  ];
  const r = (id: string, projectId: string, presentationId: string, raterId: string, score: number, ago: number): Rating =>
    ({ id, projectId, presentationId, raterId, score, submittedAt: now - ago * MIN, updatedAt: now - ago * MIN });
  const ratings: Rating[] = [
    r('r1', 'p1', 'pr1', 'u3', 72, 50), r('r2', 'p1', 'pr1', 'u4', 85, 49), r('r3', 'p1', 'pr1', 'u5', 64, 48),
    r('r4', 'p1', 'pr1', 'u6', 28, 47), r('r5', 'p1', 'pr1', 'u7', 90, 46),
    r('r6', 'p1', 'pr2', 'u1', 77, 10), r('r7', 'p1', 'pr2', 'u3', 81, 8), r('r8', 'p1', 'pr2', 'u6', 45, 5),
    r('r9', 'p2', 'pr6', 'u3', 4, 30000), r('r10', 'p2', 'pr6', 'u2', 5, 30000),
  ];
  ratings[0].submittedAt = now - 55 * MIN;
  const history: RatingHistory[] = [
    { id: 'h1', ratingId: 'r1', projectId: 'p1', presentationId: 'pr1', raterId: 'u3', before: 65, after: 72, at: now - 50 * MIN },
  ];
  return { teams, users, projects, memberships, presentations, ratings, history };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d: DB = JSON.parse(raw);
      // 이전 데이터 보정: 팀원 필드 추가, 대표는 발표자·팀원 목록에서 뺀다
      d.presentations.forEach(p => {
        p.createdBy ??= p.leaderId;
        p.memberIds = (p.memberIds ?? []).filter(id => id !== p.leaderId);
        p.presenterIds = p.presenterIds.filter(id => id !== p.leaderId);
      });
      return d;
    }
  } catch { /* 저장소 사용 불가 시 시드로 시작 */ }
  const d = seed();
  persist(d);
  return d;
}
function persist(d: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function readSession(): ID | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}

let db: DB = load();
let session: ID | null = readSession();
let snapshot = { db, session };
const listeners = new Set<() => void>();
function emit() { snapshot = { db, session }; listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

// 다른 탭에서 바뀐 데이터를 즉시 반영 → 관리자 결과 화면의 "실시간" 동작을 흉내낸다 (실제는 SSE)
window.addEventListener('storage', e => { if (e.key === KEY) { db = load(); emit(); } });

export function useStore() { return useSyncExternalStore(subscribe, () => snapshot); }
export function getDB() { return db; }

function commit<T>(mut: (d: DB) => T): T {
  const next: DB = structuredClone(db);
  const result = mut(next);
  db = next;
  persist(db);
  emit();
  return result;
}

export class AppError extends Error {}
const fail = (msg: string): never => { throw new AppError(msg); };

export function resetMock() {
  db = seed(); persist(db); setSession(null);
}

/* ---------- 계정 ---------- */
function setSession(id: ID | null) {
  session = id;
  try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  emit();
}
export function login(loginId: string, password: string) {
  const u = db.users.find(x => x.loginId === loginId.trim() && x.password === password);
  if (!u) fail('아이디 또는 비밀번호가 올바르지 않습니다.');
  setSession(u!.id);
}
export const loginAs = (id: ID) => setSession(id);
export const logout = () => setSession(null);

const normPhone = (p: string) => p.replace(/\D/g, '');

export function signup(f: { loginId: string; password: string; name: string; phone: string; teamId: ID | null }) {
  if (!f.loginId.trim() || !f.password || !f.name.trim() || !f.phone.trim()) fail('모든 항목을 입력해 주세요.');
  if (!f.teamId) fail('회사 팀을 선택해 주세요.');
  const id = commit(d => {
    if (d.users.some(x => x.loginId === f.loginId.trim())) fail('이미 사용 중인 아이디입니다.');
    const user: User = { id: uid('u'), loginId: f.loginId.trim(), password: f.password, name: f.name.trim(), phone: f.phone.trim(), teamId: f.teamId, isSysAdmin: false };
    d.users.push(user);
    return user.id;
  });
  setSession(id);
}
export function findIds(name: string, phone: string) {
  return db.users.filter(x => x.name === name.trim() && normPhone(x.phone) === normPhone(phone)).map(x => x.loginId);
}
export function resetPassword(loginId: string, name: string, phone: string, newPw: string) {
  if (!newPw) fail('새 비밀번호를 입력해 주세요.');
  commit(d => {
    const u = d.users.find(x => x.loginId === loginId.trim() && x.name === name.trim() && normPhone(x.phone) === normPhone(phone));
    if (!u) fail('일치하는 계정이 없습니다.');
    u!.password = newPw;
  });
}
export function updateProfile(userId: ID, p: { loginId: string; name: string; phone: string; teamId: ID | null; password?: string }) {
  commit(d => {
    if (!p.loginId.trim() || !p.name.trim() || !p.phone.trim()) fail('빈 항목이 있습니다.');
    if (d.users.some(x => x.id !== userId && x.loginId === p.loginId.trim())) fail('이미 사용 중인 아이디입니다.');
    const u = d.users.find(x => x.id === userId)!;
    Object.assign(u, { loginId: p.loginId.trim(), name: p.name.trim(), phone: p.phone.trim(), teamId: p.teamId });
    if (p.password) u.password = p.password;
  });
}

/* ---------- 시스템 관리자: 팀 ---------- */
const assertSys = (d: DB, actor: ID) => { if (!d.users.find(x => x.id === actor)?.isSysAdmin) fail('시스템 관리자만 가능합니다.'); };
export function addUserToTeam(actor: ID, teamId: ID, form: { loginId: string; password: string; name: string; phone: string }) {
  commit(d => {
    assertSys(d, actor);
    if (!d.teams.some(t => t.id === teamId)) fail('팀을 찾을 수 없습니다.');
    if (!form.loginId.trim() || !form.password || !form.name.trim() || !form.phone.trim()) fail('사용자 정보를 모두 입력해 주세요.');
    if (d.users.some(u => u.loginId === form.loginId.trim())) fail('이미 사용 중인 아이디입니다.');
    d.users.push({
      id: uid('u'), loginId: form.loginId.trim(), password: form.password,
      name: form.name.trim(), phone: form.phone.trim(), teamId, isSysAdmin: false,
    });
  });
}
export function addTeam(actor: ID, name: string, parentId: ID | null) {
  commit(d => { assertSys(d, actor); if (!name.trim()) fail('팀 이름을 입력해 주세요.'); d.teams.push({ id: uid('t'), name: name.trim(), parentId }); });
}
export function updateTeam(actor: ID, id: ID, name: string, parentId: ID | null) {
  commit(d => {
    assertSys(d, actor);
    // 자기 자신이나 하위 팀을 상위로 지정하는 순환 방지
    let p = parentId;
    while (p) { if (p === id) fail('하위 팀을 상위 팀으로 지정할 수 없습니다.'); p = d.teams.find(t => t.id === p)?.parentId ?? null; }
    const t = d.teams.find(x => x.id === id)!;
    t.name = name.trim() || t.name; t.parentId = parentId;
  });
}
export function deleteTeam(actor: ID, id: ID) {
  commit(d => {
    assertSys(d, actor);
    if (d.teams.some(t => t.parentId === id)) fail('하위 팀이 있는 팀은 삭제할 수 없습니다.');
    if (d.users.some(u => u.teamId === id)) fail('소속 사용자가 있는 팀은 삭제할 수 없습니다.');
    d.teams = d.teams.filter(t => t.id !== id);
  });
}
export function setUserTeam(actor: ID, userId: ID, teamId: ID | null) {
  commit(d => { assertSys(d, actor); d.users.find(u => u.id === userId)!.teamId = teamId; });
}

/* ---------- 프로젝트 ---------- */
const getProject = (d: DB, pid: ID) => d.projects.find(p => p.id === pid) ?? fail('평가룸을 찾을 수 없습니다.');
const assertMember = (d: DB, pid: ID, actor: ID) =>
  d.memberships.find(m => m.projectId === pid && m.userId === actor) ?? fail('평가룸 참여자가 아닙니다.');
const assertAdmin = (d: DB, pid: ID, actor: ID) => { if (!assertMember(d, pid, actor).isAdmin) fail('룸 운영자만 가능합니다.'); };
const assertOpen = (p: Project) => { if (p.status === 'CLOSED') fail('마감된 평가룸입니다.'); };
// 시스템 관리자는 시스템 설정(팀·사용자 소속)만 관리하고 프로젝트 생성·참여·평가는 하지 않는다
const assertNotSys = (d: DB, actor: ID) => { if (d.users.find(u => u.id === actor)?.isSysAdmin) fail('시스템 관리자는 평가룸에 참여할 수 없습니다.'); };

export function createProject(actor: ID, name: string, description: string) {
  if (!name.trim()) fail('평가룸 이름을 입력해 주세요.');
  return commit(d => {
    assertNotSys(d, actor);
    const id = uid('p');
    d.projects.push({
      id, name: name.trim(), description: description.trim(), createdBy: actor, createdAt: Date.now(), status: 'OPEN',
      settings: { min: 0, max: 100, aggMin: null, aggMax: null, allowSameTeam: false, allowEdit: true },
      currentPresentationId: null, invite: null,
    });
    const me = d.users.find(u => u.id === actor)!;
    d.memberships.push({ projectId: id, userId: actor, teamIdAtJoin: me.teamId, isAdmin: true, joinedAt: Date.now() });
    return id;
  });
}
export function issueInvite(actor: ID, pid: ID, minutes: number) {
  commit(d => {
    assertAdmin(d, pid, actor);
    const p = getProject(d, pid); assertOpen(p);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do { code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
    while (d.projects.some(x => x.invite?.code === code));
    const now = Date.now();
    p.invite = { code, issuedAt: now, expiresAt: now + minutes * MIN, issuedBy: actor }; // 이전 코드는 덮어써져 무효화
  });
}
/** 초대 코드 중지: 즉시 신규 참여를 막는다. 기존 참여자는 유지 */
export function revokeInvite(actor: ID, pid: ID) {
  commit(d => {
    assertAdmin(d, pid, actor);
    const p = getProject(d, pid); assertOpen(p);
    if (!p.invite || p.invite.revokedAt || p.invite.expiresAt < Date.now()) fail('사용 중인 입장 코드가 없습니다.');
    p.invite!.revokedAt = Date.now();
  });
}
export function joinByCode(actor: ID, code: string) {
  return commit(d => {
    assertNotSys(d, actor);
    const c = code.trim().toUpperCase();
    const p = d.projects.find(x => x.invite?.code === c);
    if (!p || !p.invite) fail('유효하지 않은 입장 코드입니다.');
    if (p!.invite!.revokedAt) fail('사용이 중지된 입장 코드입니다.');
    if (p!.invite!.expiresAt < Date.now()) fail('만료된 입장 코드입니다.');
    if (p!.status === 'CLOSED') fail('마감된 평가룸입니다.');
    if (d.memberships.some(m => m.projectId === p!.id && m.userId === actor)) return p!.id;
    const me = d.users.find(u => u.id === actor)!;
    d.memberships.push({ projectId: p!.id, userId: actor, teamIdAtJoin: me.teamId, isAdmin: false, joinedAt: Date.now() });
    return p!.id;
  });
}
export function setMemberAdmin(actor: ID, pid: ID, userId: ID, isAdmin: boolean) {
  commit(d => {
    assertAdmin(d, pid, actor); assertOpen(getProject(d, pid));
    const ms = d.memberships.filter(m => m.projectId === pid);
    if (!isAdmin && ms.filter(m => m.isAdmin).length <= 1) fail('룸 운영자는 최소 1명이어야 합니다.');
    ms.find(m => m.userId === userId)!.isAdmin = isAdmin;
  });
}

/** 참여자 제거 시 영향 범위 (삭제 전 확인용) */
export function removalImpact(d: DB, pid: ID, userId: ID) {
  const pres = d.presentations.filter(p => p.projectId === pid && involvedIds(p).includes(userId));
  return {
    ratings: d.ratings.filter(r => r.projectId === pid && r.raterId === userId).length,
    soloPresentations: pres.filter(p => involvedIds(p).length === 1),
    sharedPresentations: pres.filter(p => involvedIds(p).length > 1),
  };
}
export function removeMember(actor: ID, pid: ID, userId: ID) {
  commit(d => {
    assertAdmin(d, pid, actor); assertOpen(getProject(d, pid));
    const ms = d.memberships.filter(m => m.projectId === pid);
    const target = ms.find(m => m.userId === userId);
    if (!target) return;
    if (target.isAdmin && ms.filter(m => m.isAdmin).length <= 1) fail('마지막 룸 운영자는 제거할 수 없습니다.');
    // 본인이 준 평가와 이력 삭제
    const myRatingIds = new Set(d.ratings.filter(r => r.projectId === pid && r.raterId === userId).map(r => r.id));
    d.ratings = d.ratings.filter(r => !myRatingIds.has(r.id));
    d.history = d.history.filter(h => !myRatingIds.has(h.ratingId));
    // 혼자인 발표는 주제째 삭제, 공동 발표는 구성원에서만 제외
    const proj = getProject(d, pid);
    for (const p of d.presentations.filter(p => p.projectId === pid && involvedIds(p).includes(userId))) {
      if (involvedIds(p).length === 1) { deletePresentationIn(d, proj, p.id); continue; }
      p.presenterIds = p.presenterIds.filter(x => x !== userId);
      p.memberIds = p.memberIds.filter(x => x !== userId);
      // 대표가 빠지면 첫 발표자(없으면 첫 팀원)가 대표가 된다. 관리자가 발표 편집에서 다시 지정 가능
      if (p.leaderId === userId) {
        p.leaderId = p.presenterIds[0] ?? p.memberIds[0];
        p.presenterIds = p.presenterIds.filter(x => x !== p.leaderId);
        p.memberIds = p.memberIds.filter(x => x !== p.leaderId);
      }
    }
    d.memberships = d.memberships.filter(m => !(m.projectId === pid && m.userId === userId));
  });
}
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
export function updateSettings(actor: ID, pid: ID, s: Settings) {
  const err = validateSettings(s);
  if (err) fail(err);
  commit(d => { assertAdmin(d, pid, actor); const p = getProject(d, pid); assertOpen(p); p.settings = s; });
}
export function closeProject(actor: ID, pid: ID) {
  commit(d => {
    assertAdmin(d, pid, actor); const p = getProject(d, pid); assertOpen(p);
    p.status = 'CLOSED'; p.closedAt = Date.now(); p.invite = null;
  });
}

/* ---------- 발표 ---------- */
/** 발표를 수정할 수 있는 사람: 관리자, 대표, 발표를 만든 사람 */
export const canEditPresentation = (p: Presentation, userId: ID, isAdmin: boolean) =>
  isAdmin || p.leaderId === userId || p.createdBy === userId;

export function savePresentation(actor: ID, pid: ID, data: { title: string; intro: string; type: PresType; leaderId: ID; presenterIds: ID[]; memberIds: ID[] }, prid?: ID) {
  if (!data.title.trim()) fail('발표 제목을 입력해 주세요.');
  if (!data.leaderId) fail('대표를 1명 선택해 주세요.');
  return commit(d => {
    const proj = getProject(d, pid); assertOpen(proj);
    const me = assertMember(d, pid, actor);
    const members = d.memberships.filter(m => m.projectId === pid);
    const existing = prid ? d.presentations.find(p => p.id === prid) : undefined;
    if (prid && !existing) fail('발표를 찾을 수 없습니다.');
    if (existing && !canEditPresentation(existing, actor, me.isAdmin)) fail('대표, 발표를 만든 사람, 룸 운영자만 수정할 수 있습니다.');
    const leaderId = data.leaderId;

    // 대표·발표자·팀원은 서로 겹치지 않는다
    let presenters = Array.from(new Set(data.presenterIds)).filter(id => id !== leaderId);
    let teamMembers = Array.from(new Set(data.memberIds)).filter(id => id !== leaderId && !presenters.includes(id));
    if (data.type === 'PERSONAL') { presenters = []; teamMembers = []; }
    const all = [leaderId, ...presenters, ...teamMembers];
    if (all.some(id => !members.some(m => m.userId === id))) fail('평가룸 참여자만 구성원으로 등록할 수 있습니다.');
    if (!me.isAdmin && !all.includes(actor)) fail('본인을 구성원에서 뺄 수 없습니다. 대표·발표자·팀원 중 하나를 선택해 주세요.');
    if (data.type === 'TEAM') {
      const leaderTeam = members.find(m => m.userId === leaderId)!.teamIdAtJoin;
      if (all.some(id => members.find(m => m.userId === id)!.teamIdAtJoin !== leaderTeam)) fail('회사 팀 발표는 같은 팀 참여자만 등록할 수 있습니다.');
    }
    if (existing) {
      // 평가 가능 여부는 구성원 전체로 정해지므로, 시작된 발표는 구성원 추가·제외만 막고 역할 변경은 허용
      const changed = involvedIds(existing).slice().sort().join() !== all.slice().sort().join();
      if (changed && existing.status === 'STARTED') fail('평가가 시작된 발표는 구성원을 추가하거나 뺄 수 없습니다.');
      Object.assign(existing, { title: data.title.trim(), intro: data.intro.trim(), type: data.type, presenterIds: presenters, memberIds: teamMembers, leaderId });
      return existing.id;
    }
    const order = Math.max(0, ...d.presentations.filter(p => p.projectId === pid).map(p => p.order)) + 1;
    const p: Presentation = {
      id: uid('pr'), projectId: pid, title: data.title.trim(), intro: data.intro.trim(), type: data.type,
      leaderId, order, status: 'SCHEDULED', presenterIds: presenters, memberIds: teamMembers, createdBy: actor,
    };
    d.presentations.push(p);
    return p.id;
  });
}
function deletePresentationIn(d: DB, proj: Project, prid: ID) {
  d.presentations = d.presentations.filter(p => p.id !== prid);
  d.ratings = d.ratings.filter(r => r.presentationId !== prid);
  d.history = d.history.filter(h => h.presentationId !== prid);
  if (proj.currentPresentationId === prid) proj.currentPresentationId = null;
}
export function deletePresentation(actor: ID, pid: ID, prid: ID) {
  commit(d => { assertAdmin(d, pid, actor); const p = getProject(d, pid); assertOpen(p); deletePresentationIn(d, p, prid); });
}
export function movePresentation(actor: ID, pid: ID, prid: ID, dir: -1 | 1) {
  commit(d => {
    assertAdmin(d, pid, actor); assertOpen(getProject(d, pid));
    const list = d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);
    const i = list.findIndex(p => p.id === prid), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
  });
}
/** 드래그로 바꾼 전체 순서를 저장 */
export function reorderPresentations(actor: ID, pid: ID, orderedIds: ID[]) {
  commit(d => {
    assertAdmin(d, pid, actor); assertOpen(getProject(d, pid));
    const list = d.presentations.filter(p => p.projectId === pid);
    if (orderedIds.length !== list.length || list.some(p => !orderedIds.includes(p.id))) fail('발표 목록이 바뀌었습니다. 다시 시도해 주세요.');
    orderedIds.forEach((id, i) => { list.find(p => p.id === id)!.order = i + 1; });
  });
}
export function setCurrentPresentation(actor: ID, pid: ID, prid: ID | null) {
  commit(d => {
    assertAdmin(d, pid, actor); const p = getProject(d, pid); assertOpen(p);
    p.currentPresentationId = prid;
    if (prid) d.presentations.find(x => x.id === prid)!.status = 'STARTED';
  });
}
/** 현재 발표를 완료하고 순서상 다음 미시작 발표를 바로 진행한다. */
export function completeCurrentPresentation(actor: ID, pid: ID, prid: ID): string | null {
  return commit(d => {
    assertAdmin(d, pid, actor);
    const project = getProject(d, pid);
    assertOpen(project);
    if (project.currentPresentationId !== prid) fail('현재 진행 중인 발표가 아닙니다.');
    const list = d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);
    const currentIndex = list.findIndex(p => p.id === prid);
    if (currentIndex < 0) fail('발표를 찾을 수 없습니다.');
    const next = list.slice(currentIndex + 1).find(p => p.status === 'SCHEDULED') ?? null;
    project.currentPresentationId = next?.id ?? null;
    if (next) next.status = 'STARTED';
    return next?.title ?? null;
  });
}

/* ---------- 평가 ---------- */
export function submitRating(actor: ID, pid: ID, prid: ID, score: number, canRate: (d: DB) => string | null) {
  commit(d => {
    const p = getProject(d, pid); assertOpen(p); assertMember(d, pid, actor);
    const why = canRate(d); if (why) fail(why);
    const { min, max, allowEdit } = p.settings;
    if (!Number.isInteger(score)) fail('점수는 정수만 입력할 수 있습니다.');
    if (score < min || score > max) fail(`점수는 ${min}~${max} 사이여야 합니다.`);
    const now = Date.now();
    const existing = d.ratings.find(r => r.presentationId === prid && r.raterId === actor);
    if (existing) {
      if (!allowEdit) fail('이 평가룸은 제출한 점수를 수정할 수 없습니다.');
      if (existing.score === score) return;
      d.history.push({ id: uid('h'), ratingId: existing.id, projectId: pid, presentationId: prid, raterId: actor, before: existing.score, after: score, at: now });
      existing.score = score; existing.updatedAt = now;
    } else {
      d.ratings.push({ id: uid('r'), projectId: pid, presentationId: prid, raterId: actor, score, submittedAt: now, updatedAt: now });
    }
  });
}
