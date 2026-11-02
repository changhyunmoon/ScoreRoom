// 화면 목업 전용 API. 요청·응답과 권한 검사를 브라우저 안에서 처리한다.
// 개발 서버와 빌드 결과 모두 이 목업 데이터를 사용한다.
//
// 데이터는 브라우저 localStorage(파일은 IndexedDB)에 있다. 비밀번호는 모두 1234, 시스템 관리자는 admin.
import type { Attachment, Invitation, Membership, Presentation, Project, Rating, Settings, Summary, Team, User } from '../store';
import { clearFiles, deleteFile, getFile, putFile } from './files';

type MUser = User & { password: string };
interface MInvite { id: string; projectId: string; inviterId: string; inviteeId: string; createdAt: number; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' }
interface MDB {
  teams: Team[]; users: MUser[]; projects: Project[]; memberships: Membership[];
  presentations: Presentation[]; ratings: Rating[];
  invitations: MInvite[];
  tokens: Record<string, string>;
}

const KEY = 'scoreroom-mock-v10'; // 데이터 모양이 바뀌면 숫자를 올려 새로 시작한다
const MIN = 60_000;
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_FEEDBACK = 1000;

class Fail extends Error { constructor(public status: number, message: string) { super(message); } }
const bad = (m: string): never => { throw new Fail(400, m); };
const forbidden = (m: string): never => { throw new Fail(403, m); };
const notFound = (m: string): never => { throw new Fail(404, m); };
const conflict = (m: string): never => { throw new Fail(409, m); };

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 12)}`;
const digits = (s: string) => (s ?? '').replace(/\D/g, '');
const trim = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
/** 새로 들어온 사람은 그 팀의 맨 아래 */
const lastRank = (d: MDB, teamId: string | null) => Math.max(-1, ...d.users.filter(u => u.teamId === teamId).map(u => u.rank)) + 1;
/** 로그인 ID는 이메일 주소다. 비교는 소문자로 한다 */
const email = (v: unknown) => trim(v).toLowerCase();
const checkEmail = (v: string) => { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad('이메일 주소 형식이 올바르지 않습니다.'); return v; };

/* ---------- 시드 (데이타솔루션 > 아키텍처컨설팅본부 조직도 기준) ---------- */
function seed(): MDB {
  const now = Date.now();
  const teams: Team[] = [
    { id: 't-ds', name: '데이타솔루션', parentId: null },
    { id: 't-acc', name: '아키텍처컨설팅본부', parentId: 't-ds' },
    { id: 't-digital', name: '디지털 아키텍처팀', parentId: 't-acc' },
    { id: 't-native', name: '네이티브 아키텍처팀', parentId: 't-acc' },
    { id: 't-multi', name: '멀티클라우드 아키텍처팀', parentId: 't-acc' },
    { id: 't-platform', name: '플랫폼 아키텍처팀', parentId: 't-acc' },
    { id: 't-infra', name: '인프라 아키텍처팀', parentId: 't-acc' },
  ];
  // 팀 안 순서(rank)는 조직도에 적힌 순서. 비밀번호는 모두 1234
  const people: [string, string, string, string, string][] = [
    // [id, 이름, 직위, 이동전화, 메일]
    ['u1', '이시종', '프로', '010-5518-3731', 'lsj@datasolution.kr'],
    ['u2', '이병현', '수석', '010-7705-6755', 'manjumeok@datasolution.kr'],
    ['u3', '안재현', '수석', '010-9527-2098', 'jhahn@datasolution.kr'],
    ['u4', '박철한', '책임', '010-4115-3770', 'pch3770@datasolution.kr'],
    ['u5', '이지연', '책임', '010-9502-4826', 'jylee@datasolution.kr'],
    ['u6', '김경현', '주임', '010-7116-5238', 'sujipark2009@datasolution.kr'],
    ['u7', '윤희영', '수석', '010-9199-2383', 'fishsin@datasolution.kr'],
    ['u8', '원영진', '책임', '010-7255-9945', 'realten@datasolution.kr'],
    ['u9', '이세라', '선임', '010-7412-0198', 'sr_lee@datasolution.kr'],
    ['u10', '전서영', '선임', '010-2129-9110', 'jsyzero@datasolution.kr'],
    ['u11', '윤하경', '선임', '010-4056-3465', 'dbsgkrud5379@datasolution.kr'],
    ['u12', '최인호', '수석', '010-2933-0617', 'saderbo@datasolution.kr'],
    ['u13', '장훈', '선임', '010-6224-9275', 'beat26@datasolution.kr'],
    ['u14', '유승민', '선임', '010-3763-9849', 'usm369@datasolution.kr'],
    ['u15', '윤호석', '주임', '010-2062-9089', 'hs970216@datasolution.kr'],
    ['u16', '문창현', '사원', '010-8758-3209', 'chbigmoon@datasolution.kr'],
    ['u17', '조현준A', '책임', '010-9436-7424', 'jhj921202@datasolution.kr'],
    ['u18', '정재은', '선임', '010-3706-3006', 'silver08@datasolution.kr'],
    ['u19', '금창진', '주임', '010-5422-0814', 'roykeum1998@datasolution.kr'],
    ['u20', '안용식', '사원', '010-3119-9452', 'wkdrmdydtlr@datasolution.kr'],
    ['u21', '이승화', '사원', '010-7762-6343', 'is-hwa@datasolution.kr'],
    ['u22', '방용현', '책임', '010-4943-4437', 'yhbang@datasolution.kr'],
    ['u23', '조현준B', '수석', '010-2089-7897', 'jhj1989@datasolution.kr'],
    ['u24', '박재훈', '책임', '010-3976-9112', 'wogns9609@datasolution.kr'],
    ['u25', '이지훈', '사원', '010-9739-7335', 'jihun.lee@datasolution.kr'],
  ];
  const teamOfUser = (n: number) => (n === 1 ? 't-acc' : n <= 6 ? 't-digital' : n <= 11 ? 't-native' : n <= 16 ? 't-multi' : n <= 21 ? 't-platform' : 't-infra');
  const seen: Record<string, number> = {};
  const users: MUser[] = [
    { id: 'u0', loginId: 'admin@scoreroom.dev', password: '1234', name: '시스템관리자', phone: '010-0000-0000', teamId: null, isSysAdmin: true, canViewAll: false, position: '', rank: 0 },
    ...people.map(([id, name, position, phone, mail]) => {
      const n = Number(id.slice(1));
      return { id, loginId: mail.toLowerCase(), password: '1234', name, phone, teamId: teamOfUser(n), isSysAdmin: false, canViewAll: false, position, rank: (seen[teamOfUser(n)] = (seen[teamOfUser(n)] ?? -1) + 1) };
    }),
  ];
  // 전체 열람 권한 예시: 조현준B (온보딩 발표회에는 참여하지 않았지만 볼 수 있다)
  users.find(x => x.id === 'u23')!.canViewAll = true;
  const m = (projectId: string, userId: string, isAdmin = false): Membership =>
    ({ projectId, userId, teamIdAtJoin: users.find(x => x.id === userId)!.teamId, isAdmin, joinedAt: now - 3600_000 });
  const settings = (s: Partial<Settings>): Settings => ({
    min: 0, max: 100, aggMin: null, aggMax: null, allowSelf: false, allowSameTeam: false, allowSameCrew: false, allowEdit: true, ...s,
  });
  const projects: Project[] = [
    {
      id: 'p1', name: '2026 하반기 기술 세미나', description: '팀별 기술 공유 발표', createdBy: 'u16', createdAt: now - 86400_000, status: 'OPEN', closedAt: null,
      settings: settings({ aggMin: 30, aggMax: 80 }),
      invite: { code: 'SEM26H', issuedAt: now, expiresAt: now + 60 * MIN, issuedBy: 'u16', revokedAt: null },
    },
    {
      id: 'p2', name: '신입 온보딩 발표회', description: '온보딩 과제 결과 발표', createdBy: 'u12', createdAt: now - 30 * 86400_000, status: 'CLOSED',
      closedAt: now - 20 * 86400_000, settings: settings({ max: 5, allowSameTeam: true, allowEdit: false }), invite: null,
    },
  ];
  // 기술 세미나: 본부 전원 참여 (운영자: 문창현, 이시종) / 온보딩 발표회: 신입과 멘토
  const memberships = [
    ...people.map(([id]) => m('p1', id, id === 'u16' || id === 'u1')),
    m('p2', 'u12', true), m('p2', 'u15'), m('p2', 'u16'), m('p2', 'u20'), m('p2', 'u21'), m('p2', 'u25'),
  ];
  // 등록 시각은 발표 순서와 일부러 다르게 둔다 (등록순 정렬 확인용)
  const pr = (id: string, projectId: string, order: number, createdMinAgo: number, title: string, intro: string, type: Presentation['type'], leaderId: string,
    presenterIds: string[], memberIds: string[], deployUrl: string | null = null): Presentation =>
    ({ id, projectId, order, title, intro, type, leaderId, presenterIds, memberIds, createdBy: leaderId, createdAt: now - createdMinAgo * MIN, deployUrl, attachments: [] });
  const presentations = [
    pr('pr1', 'p1', 1, 300, '쿠버네티스 비용 최적화 사례', '클러스터 비용을 40% 줄인 과정과 시행착오', 'PERSONAL', 'u16', [], []),
    pr('pr2', 'p1', 2, 500, '레퍼런스 아키텍처 표준화', '프로젝트마다 다르던 설계 산출물을 하나의 기준으로 묶은 과정', 'TEAM', 'u2', ['u4'], ['u5', 'u6'], 'https://example.com/reference-architecture'),
    pr('pr3', 'p1', 3, 200, '멀티클라우드 네트워크 설계 회고', 'AWS·Azure 간 연결 구조를 설계하며 배운 점', 'TEAM', 'u12', ['u13'], ['u14', 'u15']),
    pr('pr4', 'p1', 4, 400, '클라우드 네이티브 전환 사례', '모놀리식 서비스를 컨테이너 기반으로 옮긴 경험', 'PERSONAL', 'u9', [], []),
    pr('pr5', 'p1', 5, 100, 'LLM 기반 사내 문서 검색', '사내 문서 검색 PoC 소개', 'TEAM', 'u17', ['u17', 'u18'], ['u21']),
    pr('pr6', 'p2', 1, 50000, '첫 달 회고', '온보딩 과제와 배운 점', 'PERSONAL', 'u20', [], []),
  ];
  const r = (id: string, projectId: string, presentationId: string, targetId: string, raterId: string, score: number, ago: number, feedback: string | null = null): Rating =>
    ({ id, projectId, presentationId, targetId, raterId, score, feedback, submittedAt: now - ago * MIN });
  const ratings = [
    r('r1', 'p1', 'pr1', 'u16', 'u3', 72, 55, '비용 절감 수치가 구체적이라 좋았어요.'), r('r2', 'p1', 'pr1', 'u16', 'u8', 85, 49),
    r('r3', 'p1', 'pr1', 'u16', 'u17', 64, 48), r('r4', 'p1', 'pr1', 'u16', 'u22', 28, 47, '배경 설명이 조금 더 있으면 좋겠어요.'),
    r('r5', 'p1', 'pr1', 'u16', 'u24', 90, 46),
    r('r6', 'p1', 'pr2', 'u2', 'u16', 77, 10), r('r7', 'p1', 'pr2', 'u4', 'u16', 70, 10),
    r('r8', 'p1', 'pr2', 'u2', 'u12', 81, 8, '산출물 기준 정리가 인상적이었습니다.'), r('r9', 'p1', 'pr2', 'u4', 'u12', 84, 8),
    r('r10', 'p1', 'pr2', 'u2', 'u7', 45, 5),
    r('r11', 'p2', 'pr6', 'u20', 'u12', 4, 30000), r('r12', 'p2', 'pr6', 'u20', 'u16', 5, 30000),
  ];
  return { teams, users, projects, memberships, presentations, ratings, invitations: [], tokens: {} };
}

function load(): MDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 새로 시작 */ }
  const d = seed();
  save(d);
  return d;
}
function save(d: MDB) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 용량 초과 등 */ }
}

/* ---------- 규칙 (화면의 logic.ts와 같음) ---------- */
const involved = (p: Presentation) => Array.from(new Set([p.leaderId, ...p.presenterIds, ...p.memberIds]));
const memberOf = (d: MDB, pid: string, userId: string) => d.memberships.find(m => m.projectId === pid && m.userId === userId);

type Block = 'SELF' | 'SAME_CREW' | 'SAME_TEAM' | null;
function blockReason(d: MDB, project: Project, pres: Presentation, raterId: string, targetId: string): Block {
  const { allowSelf, allowSameTeam, allowSameCrew } = project.settings;
  if (targetId === raterId) return allowSelf ? null : 'SELF';
  if (!allowSameCrew && involved(pres).includes(raterId)) return 'SAME_CREW';
  const myTeam = memberOf(d, project.id, raterId)?.teamIdAtJoin ?? null;
  if (!allowSameTeam && myTeam && memberOf(d, project.id, targetId)?.teamIdAtJoin === myTeam) return 'SAME_TEAM';
  return null;
}
const blockText = { SELF: '본인은 평가할 수 없습니다.', SAME_CREW: '같은 발표의 팀원은 평가할 수 없습니다.', SAME_TEAM: '같은 회사 팀이라 평가할 수 없습니다.' };

/** 발표 구성원 한 명의 집계 */
function summarize(d: MDB, project: Project, pres: Presentation, targetId: string): Summary {
  const ms = d.memberships.filter(m => m.projectId === project.id);
  const rs = d.ratings.filter(r => r.presentationId === pres.id && r.targetId === targetId);
  let blocked = 0, notRated = 0;
  for (const m of ms) {
    if (rs.some(r => r.raterId === m.userId)) continue;
    if (blockReason(d, project, pres, m.userId, targetId)) blocked++; else notRated++;
  }
  const { aggMin, aggMax } = project.settings;
  const scores = rs.map(r => r.score);
  const inScores = aggMin !== null && aggMax !== null ? scores.filter(s => s >= aggMin && s <= aggMax) : [];
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    presentationId: pres.id, targetId, total: ms.length, blocked, eligible: ms.length - blocked, scored: rs.length, notRated,
    avg: avg(scores), inCount: inScores.length, inAvg: avg(inScores),
  };
}

/* ---------- 공통 확인 ---------- */
const project = (d: MDB, pid: string) => d.projects.find(p => p.id === pid) ?? notFound('평가룸을 찾을 수 없습니다.');
const member = (d: MDB, pid: string, userId: string) => memberOf(d, pid, userId) ?? forbidden('평가룸 참여자가 아닙니다.');
const admin = (d: MDB, pid: string, userId: string) => { const m = member(d, pid, userId); if (!m.isAdmin) forbidden('룸 운영자만 가능합니다.'); return m; };
/** 참여자이거나 전체 열람 권한이 있으면 볼 수 있다 */
const canSee = (d: MDB, pid: string, u: MUser) => { if (!memberOf(d, pid, u.id) && !u.canViewAll) forbidden('평가룸 참여자가 아닙니다.'); };
const open = (p: Project) => { if (p.status !== 'OPEN') bad('마감된 평가룸입니다.'); };
const presentation = (d: MDB, pid: string, prid: string) => d.presentations.find(p => p.id === prid && p.projectId === pid) ?? notFound('발표를 찾을 수 없습니다.');
const canEdit = (p: Presentation, userId: string, isAdmin: boolean) => isAdmin || p.leaderId === userId || p.createdBy === userId;
const issueToken = (d: MDB, userId: string) => { const t = uid('tok'); d.tokens[t] = userId; return t; };

function dropRatings(d: MDB, keep: (r: Rating) => boolean) {
  const removed = new Set(d.ratings.filter(r => !keep(r)).map(r => r.id));
  d.ratings = d.ratings.filter(r => !removed.has(r.id));
  return removed.size;
}

function deletePresentationIn(d: MDB, pres: Presentation) {
  d.presentations = d.presentations.filter(p => p.id !== pres.id);
  dropRatings(d, r => r.presentationId !== pres.id);
  for (const a of pres.attachments) void deleteFile(a.id);
}

function normalizeUrl(raw: unknown): string | null {
  const s = trim(raw);
  if (!s) return null;
  let ok = false;
  try { const u = new URL(s); ok = u.protocol === 'http:' || u.protocol === 'https:'; } catch { ok = false; }
  if (!ok) bad('배포 URL은 http:// 또는 https://로 시작하는 주소로 입력해 주세요.');
  if (s.length > 500) bad('배포 URL은 500자 이하로 입력해 주세요.');
  return s;
}

/* ---------- 화면 데이터 (/state) ---------- */
function state(d: MDB, meId: string) {
  const me = d.users.find(u => u.id === meId)!;
  const strip = ({ password: _pw, ...u }: MUser): User => u;
  const users = d.users.map(u => (me.isSysAdmin || u.id === me.id ? strip(u) : { ...strip(u), loginId: '', phone: '' }));
  const mine = d.memberships.filter(m => m.userId === me.id);
  const memberOfIds = new Set(mine.map(m => m.projectId));
  const adminOf = new Set(mine.filter(m => m.isAdmin).map(m => m.projectId));
  // 전체 열람 권한이 있으면 모든 평가룸(진행 중·마감)을 본다
  const visible = new Set(me.canViewAll && !me.isSysAdmin ? d.projects.map(p => p.id) : memberOfIds);
  // 결과 집계: 룸 운영자, 전체 열람 권한자
  const summaryOf = new Set([...adminOf, ...(me.canViewAll ? visible : [])]);
  const ownOrAdmin = <T extends { projectId: string; raterId: string }>(x: T) => adminOf.has(x.projectId) || x.raterId === me.id;
  return {
    me: strip(me), teams: d.teams, users,
    projects: d.projects.filter(p => visible.has(p.id)).map(p => ({ ...p, invite: adminOf.has(p.id) ? p.invite : null })),
    // 대기 중인 초대: 내가 받은 것 + 내가 운영하는 평가룸에서 보낸 것 (마감된 평가룸 제외)
    invitations: d.invitations
      .filter(i => i.status === 'PENDING' && project(d, i.projectId).status === 'OPEN' && (i.inviteeId === me.id || adminOf.has(i.projectId)))
      .map((i): Invitation => ({
        id: i.id, projectId: i.projectId, projectName: project(d, i.projectId).name, inviteeId: i.inviteeId, createdAt: i.createdAt,
        inviterId: i.inviterId, inviterName: d.users.find(u => u.id === i.inviterId)?.name ?? '',
      })),
    memberships: d.memberships.filter(m => visible.has(m.projectId)),
    presentations: d.presentations.filter(p => visible.has(p.projectId)).map(p => ({ ...p, hasRatings: d.ratings.some(r => r.presentationId === p.id) })),
    // 점수·피드백: 룸 운영자는 그 평가룸 전체, 그 외에는 본인이 준 것만 (열람 권한자도 남의 점수는 못 봄)
    ratings: d.ratings.filter(r => memberOfIds.has(r.projectId) && ownOrAdmin(r)),
    summaries: d.presentations.filter(p => summaryOf.has(p.projectId))
      .flatMap(p => involved(p).map(t => summarize(d, project(d, p.projectId), p, t))),
  };
}

/* ---------- 요청 처리 ---------- */
type Body = Record<string, any>;
type Handler = (d: MDB, p: string[], body: Body, me: MUser | null) => unknown;
const routes: [string, RegExp, Handler, boolean][] = []; // method, path, handler, needsLogin
const on = (method: string, path: string, h: Handler, auth = true) =>
  routes.push([method, new RegExp('^' + path.replace(/:[a-z]+/g, '([^/]+)') + '$'), h, auth]);

on('POST', '/auth/login', (d, _p, b) => {
  const u = d.users.find(x => x.loginId === email(b.loginId) && x.password === b.password) ?? bad('이메일 또는 비밀번호가 올바르지 않습니다.');
  return { token: issueToken(d, u.id) };
}, false);
on('POST', '/auth/signup', (d, _p, b) => {
  if (!trim(b.loginId) || !b.password || !trim(b.name) || !trim(b.phone)) bad('모든 항목을 입력해 주세요.');
  if (!b.teamId) bad('회사 팀을 선택해 주세요.');
  if (d.users.some(x => x.loginId === checkEmail(email(b.loginId)))) conflict('이미 가입된 이메일입니다.');
  const u: MUser = {
    id: uid('u'), loginId: email(b.loginId), password: b.password, name: trim(b.name), phone: trim(b.phone), teamId: b.teamId,
    isSysAdmin: false, canViewAll: false, position: trim(b.position), rank: lastRank(d, b.teamId),
  };
  d.users.push(u);
  return { token: issueToken(d, u.id) };
}, false);
on('POST', '/auth/find-ids', (d, _p, b) => ({
  loginIds: d.users.filter(x => x.name === trim(b.name) && digits(x.phone) === digits(b.phone) && digits(b.phone)).map(x => x.loginId),
}), false);
on('POST', '/auth/reset-password', (d, _p, b) => {
  if (!b.newPassword) bad('새 비밀번호를 입력해 주세요.');
  const u = d.users.find(x => x.loginId === email(b.loginId) && x.name === trim(b.name) && digits(x.phone) === digits(b.phone)) ?? bad('일치하는 계정이 없습니다.');
  u.password = b.newPassword;
  for (const [t, id] of Object.entries(d.tokens)) if (id === u.id) delete d.tokens[t];
}, false);
on('GET', '/teams', d => d.teams, false);
on('GET', '/auth/demo-accounts', d => ({
  enabled: true,
  accounts: d.users.map(u => ({ id: u.id, loginId: u.loginId, name: u.name, isSysAdmin: u.isSysAdmin, teamName: d.teams.find(t => t.id === u.teamId)?.name ?? null })),
}), false);
on('POST', '/auth/demo-login', (d, _p, b) => ({ token: issueToken(d, (d.users.find(u => u.id === b.userId) ?? bad('계정을 찾을 수 없습니다.')).id) }), false);

on('POST', '/auth/logout', () => undefined);
on('GET', '/state', (d, _p, _b, me) => state(d, me!.id));
on('PUT', '/me', (d, _p, b, me) => {
  if (!trim(b.loginId) || !trim(b.name) || !trim(b.phone)) bad('빈 항목이 있습니다.');
  if (d.users.some(x => x.id !== me!.id && x.loginId === checkEmail(email(b.loginId)))) conflict('이미 가입된 이메일입니다.');
  const teamId = b.teamId ?? null;
  if (teamId !== me!.teamId) me!.rank = lastRank(d, teamId);
  Object.assign(me!, { loginId: email(b.loginId), name: trim(b.name), phone: trim(b.phone), teamId, position: trim(b.position) });
  if (b.password) me!.password = b.password;
});

/* 시스템 관리자 */
const sys = (me: MUser | null) => { if (!me?.isSysAdmin) forbidden('시스템 관리자만 가능합니다.'); };
const team = (d: MDB, id: string) => d.teams.find(t => t.id === id) ?? notFound('팀을 찾을 수 없습니다.');
on('POST', '/admin/teams', (d, _p, b, me) => {
  sys(me);
  if (!trim(b.name)) bad('팀 이름을 입력해 주세요.');
  if (b.parentId) team(d, b.parentId);
  const t = { id: uid('t'), name: trim(b.name), parentId: b.parentId ?? null };
  d.teams.push(t);
  return { id: t.id };
});
on('PUT', '/admin/teams/:id', (d, [id], b, me) => {
  sys(me);
  const t = team(d, id);
  for (let p: string | null = b.parentId ?? null; p; p = team(d, p).parentId) if (p === id) bad('하위 팀을 상위 팀으로 지정할 수 없습니다.');
  if (trim(b.name)) t.name = trim(b.name);
  t.parentId = b.parentId ?? null;
});
on('DELETE', '/admin/teams/:id', (d, [id], _b, me) => {
  sys(me); team(d, id);
  if (d.teams.some(t => t.parentId === id)) bad('하위 팀이 있는 팀은 삭제할 수 없습니다.');
  if (d.users.some(u => u.teamId === id)) bad('소속 사용자가 있는 팀은 삭제할 수 없습니다.');
  d.teams = d.teams.filter(t => t.id !== id);
});
on('POST', '/admin/teams/:id/users', (d, [id], b, me) => {
  sys(me); team(d, id);
  if (!trim(b.loginId) || !b.password || !trim(b.name) || !trim(b.phone)) bad('사용자 정보를 모두 입력해 주세요.');
  if (d.users.some(u => u.loginId === checkEmail(email(b.loginId)))) conflict('이미 가입된 이메일입니다.');
  const u: MUser = {
    id: uid('u'), loginId: email(b.loginId), password: b.password, name: trim(b.name), phone: trim(b.phone), teamId: id,
    isSysAdmin: false, canViewAll: false, position: trim(b.position), rank: lastRank(d, id),
  };
  d.users.push(u);
  return { id: u.id };
});
on('PUT', '/admin/users/:id/team', (d, [id], b, me) => {
  sys(me);
  const u = d.users.find(x => x.id === id) ?? notFound('사용자를 찾을 수 없습니다.');
  if (b.teamId) team(d, b.teamId);
  if ((b.teamId ?? null) !== u.teamId) u.rank = lastRank(d, b.teamId ?? null);
  u.teamId = b.teamId ?? null;
});
/** 팀 안 순서 바꾸기: 위에 있을수록 높은 사람 */
on('POST', '/admin/users/:id/move', (d, [id], b, me) => {
  sys(me);
  const u = d.users.find(x => x.id === id && !x.isSysAdmin) ?? notFound('사용자를 찾을 수 없습니다.');
  const list = d.users.filter(x => x.teamId === u.teamId && !x.isSysAdmin).sort((a, z) => a.rank - z.rank || a.name.localeCompare(z.name));
  list.forEach((x, i) => { x.rank = i; }); // 순서를 0부터 다시 매긴다
  const i = list.indexOf(u);
  const j = i + Math.sign(b.dir);
  if (j < 0 || j >= list.length) return;
  [list[i].rank, list[j].rank] = [list[j].rank, list[i].rank];
});
on('PUT', '/admin/users/:id/position', (d, [id], b, me) => {
  sys(me);
  const u = d.users.find(x => x.id === id) ?? notFound('사용자를 찾을 수 없습니다.');
  if (trim(b.position).length > 30) bad('직위는 30자 이하로 입력해 주세요.');
  u.position = trim(b.position);
});
/** 전체 열람 권한 주기·회수 */
on('PUT', '/admin/users/:id/view-all', (d, [id], b, me) => {
  sys(me);
  const u = d.users.find(x => x.id === id) ?? notFound('사용자를 찾을 수 없습니다.');
  if (u.isSysAdmin) bad('시스템 관리자에게는 줄 수 없습니다.');
  u.canViewAll = !!b.enabled;
});

/* 평가룸 */
on('POST', '/projects', (d, _p, b, me) => {
  if (me!.isSysAdmin) forbidden('시스템 관리자는 평가룸에 참여할 수 없습니다.');
  if (!trim(b.name)) bad('평가룸 이름을 입력해 주세요.');
  const now = Date.now();
  const p: Project = {
    id: uid('p'), name: trim(b.name), description: trim(b.description), createdBy: me!.id, createdAt: now, status: 'OPEN', closedAt: null,
    settings: { min: 0, max: 100, aggMin: null, aggMax: null, allowSelf: false, allowSameTeam: false, allowSameCrew: false, allowEdit: true }, invite: null,
  };
  d.projects.push(p);
  d.memberships.push({ projectId: p.id, userId: me!.id, teamIdAtJoin: me!.teamId, isAdmin: true, joinedAt: now });
  return { id: p.id };
});
on('POST', '/projects/join', (d, _p, b, me) => {
  if (me!.isSysAdmin) forbidden('시스템 관리자는 평가룸에 참여할 수 없습니다.');
  const c = trim(b.code).toUpperCase();
  const p = d.projects.find(x => x.invite?.code === c) ?? bad('유효하지 않은 입장 코드입니다.');
  if (p.invite!.revokedAt) bad('사용이 중지된 입장 코드입니다.');
  if (p.invite!.expiresAt !== null && p.invite!.expiresAt < Date.now()) bad('만료된 입장 코드입니다.');
  open(p);
  joinRoom(d, p, me!);
  return { id: p.id };
});
on('POST', '/projects/:pid/invite', (d, [pid], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  // minutes가 null이면 기간 무제한
  const minutes = b.minutes === null || b.minutes === undefined ? null : Number(b.minutes);
  if (minutes !== null && (!isInt(minutes) || minutes < 1 || minutes > 1440)) bad('유효 시간은 1분~24시간 사이로 정하거나 무제한으로 해 주세요.');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do { code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); } while (d.projects.some(x => x.invite?.code === code));
  const now = Date.now();
  p.invite = { code, issuedAt: now, expiresAt: minutes === null ? null : now + minutes * MIN, issuedBy: me!.id, revokedAt: null };
});
on('DELETE', '/projects/:pid/invite', (d, [pid], _b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  if (!p.invite || p.invite.revokedAt || (p.invite.expiresAt !== null && p.invite.expiresAt < Date.now())) bad('사용 중인 입장 코드가 없습니다.');
  p.invite!.revokedAt = Date.now();
});
on('PUT', '/projects/:pid/members/:uid/admin', (d, [pid, userId], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const ms = d.memberships.filter(m => m.projectId === pid);
  const t = ms.find(m => m.userId === userId) ?? notFound('참여자를 찾을 수 없습니다.');
  if (!b.isAdmin && t.isAdmin && ms.filter(m => m.isAdmin).length <= 1) bad('룸 운영자는 최소 1명이어야 합니다.');
  t.isAdmin = !!b.isAdmin;
});
on('DELETE', '/projects/:pid/members/:uid', (d, [pid, userId], _b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const ms = d.memberships.filter(m => m.projectId === pid);
  const t = ms.find(m => m.userId === userId);
  if (!t) return;
  if (t.isAdmin && ms.filter(m => m.isAdmin).length <= 1) bad('마지막 룸 운영자는 제거할 수 없습니다.');
  // 그 사람이 준 점수와 받은 점수를 지운다
  dropRatings(d, r => !(r.projectId === pid && (r.raterId === userId || r.targetId === userId)));
  for (const pres of d.presentations.filter(x => x.projectId === pid && involved(x).includes(userId))) {
    if (involved(pres).length === 1) { deletePresentationIn(d, pres); continue; }
    pres.presenterIds = pres.presenterIds.filter(x => x !== userId);
    pres.memberIds = pres.memberIds.filter(x => x !== userId);
    if (pres.leaderId === userId) {
      pres.leaderId = pres.presenterIds[0] ?? pres.memberIds[0];
      pres.presenterIds = pres.presenterIds.filter(x => x !== pres.leaderId);
      pres.memberIds = pres.memberIds.filter(x => x !== pres.leaderId);
    }
  }
  d.memberships = d.memberships.filter(m => !(m.projectId === pid && m.userId === userId));
});
on('PUT', '/projects/:pid/settings', (d, [pid], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const msg = '점수와 범위는 정수만 사용할 수 있습니다.';
  const nums = [b.min, b.max, b.aggMin, b.aggMax].filter(v => v !== null && v !== undefined);
  if (nums.some(v => !isInt(v))) bad(msg);
  const reset = p.settings.min !== b.min || p.settings.max !== b.max;
  const s: Settings = {
    min: b.min, max: b.max, aggMin: reset ? null : b.aggMin ?? null, aggMax: reset ? null : b.aggMax ?? null,
    allowSelf: b.allowSelf ?? p.settings.allowSelf, allowSameTeam: b.allowSameTeam ?? p.settings.allowSameTeam,
    allowSameCrew: b.allowSameCrew ?? p.settings.allowSameCrew, allowEdit: b.allowEdit ?? p.settings.allowEdit,
  };
  if (s.min >= s.max) bad('점수 최솟값은 최댓값보다 작아야 합니다.');
  if ((s.aggMin === null) !== (s.aggMax === null)) bad('집계 기준은 최저치·최대치를 함께 설정해야 합니다.');
  if (s.aggMin !== null && s.aggMax !== null) {
    if (s.aggMin > s.aggMax) bad('집계 기준 최저치가 최대치보다 클 수 없습니다.');
    if (s.aggMin < s.min || s.aggMax > s.max) bad('집계 기준은 점수 입력 범위 안에 있어야 합니다.');
  }
  // 점수 범위가 바뀌면 전부, 아니면 새 평가 규칙(본인·같은 발표 팀원·같은 팀)에 맞지 않게 된 평가만 지운다
  const changed = { ...p, settings: s };
  const removed = reset
    ? dropRatings(d, r => r.projectId !== pid)
    : dropRatings(d, r => {
      if (r.projectId !== pid) return true;
      const pres = d.presentations.find(x => x.id === r.presentationId);
      return !pres || blockReason(d, changed, pres, r.raterId, r.targetId) === null;
    });
  p.settings = s;
  return { removed };
});
on('POST', '/projects/:pid/close', (d, [pid], _b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  p.status = 'CLOSED'; p.closedAt = Date.now(); p.invite = null;
});

/* 초대: 룸 운영자가 사용자를 골라 초대하면 받은 사람의 알림에 뜨고, 수락하면 바로 참여한다 */
function joinRoom(d: MDB, p: Project, u: MUser) {
  if (!memberOf(d, p.id, u.id)) d.memberships.push({ projectId: p.id, userId: u.id, teamIdAtJoin: u.teamId, isAdmin: false, joinedAt: Date.now() });
  for (const i of d.invitations) if (i.projectId === p.id && i.inviteeId === u.id && i.status === 'PENDING') i.status = 'ACCEPTED';
}
on('POST', '/projects/:pid/invitations', (d, [pid], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const ids: string[] = Array.isArray(b.userIds) ? Array.from(new Set(b.userIds)) : [];
  if (ids.length === 0) bad('초대할 사람을 선택해 주세요.');
  let invited = 0;
  for (const id of ids) {
    const u = d.users.find(x => x.id === id) ?? notFound('사용자를 찾을 수 없습니다.');
    if (u.isSysAdmin) bad('시스템 관리자는 초대할 수 없습니다.');
    if (memberOf(d, pid, id)) continue;
    if (d.invitations.some(i => i.projectId === pid && i.inviteeId === id && i.status === 'PENDING')) continue;
    d.invitations.push({ id: uid('inv'), projectId: pid, inviterId: me!.id, inviteeId: id, createdAt: Date.now(), status: 'PENDING' });
    invited++;
  }
  return { invited };
});
const invitation = (d: MDB, id: string) => d.invitations.find(i => i.id === id && i.status === 'PENDING') ?? notFound('초대를 찾을 수 없습니다. 이미 처리됐을 수 있어요.');
on('DELETE', '/invitations/:id', (d, [id], _b, me) => {
  const i = invitation(d, id);
  admin(d, i.projectId, me!.id);
  i.status = 'CANCELED';
});
on('POST', '/invitations/:id/accept', (d, [id], _b, me) => {
  const i = invitation(d, id);
  if (i.inviteeId !== me!.id) forbidden('내가 받은 초대가 아닙니다.');
  const p = project(d, i.projectId);
  open(p);
  joinRoom(d, p, me!);
  return { projectId: p.id };
});
on('POST', '/invitations/:id/decline', (d, [id], _b, me) => {
  const i = invitation(d, id);
  if (i.inviteeId !== me!.id) forbidden('내가 받은 초대가 아닙니다.');
  i.status = 'DECLINED';
});

/* 발표 */
function savePresentation(d: MDB, pid: string, prid: string | null, b: Body, me: MUser) {
  if (!trim(b.title)) bad('발표 제목을 입력해 주세요.');
  if (!b.leaderId) bad('대표를 1명 선택해 주세요.');
  const p = project(d, pid);
  const mine = member(d, pid, me.id);
  open(p);
  const existing = prid ? presentation(d, pid, prid) : null;
  if (existing && !canEdit(existing, me.id, mine.isAdmin)) forbidden('대표, 발표를 만든 사람, 룸 운영자만 수정할 수 있습니다.');
  const leaderId: string = b.leaderId;
  // 대표는 발표자를 겸할 수 있다 (presenterIds에 대표가 들어 있으면 대표+발표자)
  let presenters = Array.from(new Set<string>(b.presenterIds ?? []));
  let teamMembers = Array.from(new Set<string>(b.memberIds ?? [])).filter(id => id !== leaderId && !presenters.includes(id));
  if (b.type === 'PERSONAL') { presenters = []; teamMembers = []; }
  const all = Array.from(new Set([leaderId, ...presenters, ...teamMembers])); // 대표+발표자는 한 번만 센다
  if (all.some(id => !memberOf(d, pid, id))) bad('평가룸 참여자만 구성원으로 등록할 수 있습니다.');
  if (!mine.isAdmin && !all.includes(me.id)) bad('본인을 구성원에서 뺄 수 없습니다. 대표·발표자·팀원 중 하나를 선택해 주세요.');
  if (b.type !== 'PERSONAL' && b.type !== 'TEAM') bad('발표 유형을 선택해 주세요.');
  const deployUrl = normalizeUrl(b.deployUrl);
  if (existing) {
    // 점수를 받은 발표는 평가 대상이 바뀌지 않도록 구성원 추가·제외를 막고 역할 변경만 허용
    const changed = involved(existing).slice().sort().join() !== all.slice().sort().join();
    if (changed && d.ratings.some(r => r.presentationId === existing.id)) bad('점수를 받은 발표는 구성원을 추가하거나 뺄 수 없습니다.');
    Object.assign(existing, { title: trim(b.title), intro: trim(b.intro), type: b.type, leaderId, presenterIds: presenters, memberIds: teamMembers, deployUrl });
    return { id: existing.id };
  }
  const order = Math.max(0, ...d.presentations.filter(x => x.projectId === pid).map(x => x.order)) + 1;
  const pres: Presentation = {
    id: uid('pr'), projectId: pid, title: trim(b.title), intro: trim(b.intro), type: b.type, leaderId, order,
    presenterIds: presenters, memberIds: teamMembers, createdBy: me.id, createdAt: Date.now(), deployUrl, attachments: [],
  };
  d.presentations.push(pres);
  return { id: pres.id };
}
on('POST', '/projects/:pid/presentations', (d, [pid], b, me) => savePresentation(d, pid, null, b, me!));
on('PUT', '/projects/:pid/presentations/order', (d, [pid], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const list = d.presentations.filter(x => x.projectId === pid);
  const ids: string[] = b.ids ?? [];
  if (ids.length !== list.length || new Set(ids).size !== list.length || list.some(x => !ids.includes(x.id))) conflict('발표 목록이 바뀌었습니다. 다시 시도해 주세요.');
  ids.forEach((id, i) => { list.find(x => x.id === id)!.order = i + 1; });
});
on('PUT', '/projects/:pid/presentations/:prid', (d, [pid, prid], b, me) => savePresentation(d, pid, prid, b, me!));
on('DELETE', '/projects/:pid/presentations/:prid', (d, [pid, prid], _b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  deletePresentationIn(d, presentation(d, pid, prid));
});
on('POST', '/projects/:pid/presentations/:prid/move', (d, [pid, prid], b, me) => {
  const p = project(d, pid); admin(d, pid, me!.id); open(p);
  const list = d.presentations.filter(x => x.projectId === pid).sort((a, z) => a.order - z.order);
  const i = list.findIndex(x => x.id === prid);
  if (i < 0) notFound('발표를 찾을 수 없습니다.');
  const j = i + Math.sign(b.dir);
  if (j < 0 || j >= list.length) return;
  [list[i].order, list[j].order] = [list[j].order, list[i].order];
});

/* 평가: 발표 구성원 한 명씩, 마감 전까지 언제든. 피드백은 선택 */
on('PUT', '/projects/:pid/presentations/:prid/ratings/:tid', (d, [pid, prid, targetId], b, me) => {
  const p = project(d, pid); member(d, pid, me!.id); open(p);
  const pres = presentation(d, pid, prid);
  if (!involved(pres).includes(targetId)) bad('이 발표의 구성원이 아닙니다.');
  const block = blockReason(d, p, pres, me!.id, targetId);
  if (block) bad(blockText[block]);
  if (!isInt(b.score)) bad('점수는 정수만 입력할 수 있습니다.');
  const { min, max, allowEdit } = p.settings;
  if (b.score < min || b.score > max) bad(`점수는 ${min}~${max} 사이여야 합니다.`);
  if (b.feedback != null && typeof b.feedback !== 'string') bad('피드백 형식이 올바르지 않습니다.');
  const feedback = trim(b.feedback) || null;
  if (feedback && feedback.length > MAX_FEEDBACK) bad(`피드백은 ${MAX_FEEDBACK}자 이하로 입력해 주세요.`);
  const now = Date.now();
  const existing = d.ratings.find(r => r.presentationId === prid && r.targetId === targetId && r.raterId === me!.id);
  if (!existing) {
    d.ratings.push({ id: uid('r'), projectId: pid, presentationId: prid, targetId, raterId: me!.id, score: b.score, feedback, submittedAt: now });
    return;
  }
  if (!allowEdit) bad('이 평가룸은 제출한 점수를 수정할 수 없습니다.');
  if (existing.score === b.score && existing.feedback === feedback) return;
  // 수정은 덮어쓰기만 한다 (이력은 남기지 않음)
  existing.score = b.score; existing.feedback = feedback; existing.submittedAt = now;
});

/* 발표 자료 (여러 개). 발표를 수정할 수 있는 사람만 올리고 지울 수 있다 */
const MAX_ATTACHMENTS = 10;
function attachmentTarget(d: MDB, pid: string, prid: string, me: MUser) {
  const p = project(d, pid);
  const m = member(d, pid, me.id);
  open(p);
  const pres = presentation(d, pid, prid);
  if (!canEdit(pres, me.id, m.isAdmin)) forbidden('대표, 발표를 만든 사람, 룸 운영자만 발표 자료를 바꿀 수 있습니다.');
  return pres;
}
on('DELETE', '/projects/:pid/presentations/:prid/attachments/:aid', (d, [pid, prid, aid], _b, me) => {
  const pres = attachmentTarget(d, pid, prid, me!);
  if (!pres.attachments.some(a => a.id === aid)) notFound('발표 자료를 찾을 수 없습니다.');
  pres.attachments = pres.attachments.filter(a => a.id !== aid);
  void deleteFile(aid);
});

/** 실제 서버의 fetch 대신 부른다. 응답은 { status, data } */
export async function mockApi(method: string, path: string, body: unknown, token: string | null): Promise<{ status: number; data: unknown }> {
  await new Promise(r => setTimeout(r, 80)); // 네트워크처럼 아주 잠깐 기다림
  if (method === 'POST' && path === '/demo/reset') {
    localStorage.removeItem(KEY);
    await clearFiles();
    load();
    return { status: 204, data: undefined };
  }
  const d = load();
  for (const [m, re, handler, auth] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    const me = token ? d.users.find(u => u.id === d.tokens[token]) ?? null : null;
    try {
      if (auth && !me) return { status: 401, data: { message: '로그인이 필요합니다.' } };
      if (path === '/auth/logout' && token) delete d.tokens[token];
      const data = handler(d, match.slice(1), (body ?? {}) as Body, me);
      save(d);
      return { status: data === undefined ? 204 : 200, data };
    } catch (e) {
      if (e instanceof Fail) return { status: e.status, data: { message: e.message } };
      console.error(e);
      return { status: 500, data: { message: '오류가 발생했습니다.' } };
    }
  }
  return { status: 404, data: { message: '요청한 주소를 찾을 수 없습니다.' } };
}

/** 발표 자료 하나 추가: POST /projects/{pid}/presentations/{prid}/attachments (multipart, 필드 이름 file) */
export async function mockUpload(pid: string, prid: string, file: File, token: string | null) {
  const d = load();
  const me = token ? d.users.find(u => u.id === d.tokens[token]) : undefined;
  if (!me) return { status: 401, data: { message: '로그인이 필요합니다.' } };
  try {
    const pres = attachmentTarget(d, pid, prid, me);
    if (file.size === 0) bad('빈 파일은 올릴 수 없습니다.');
    if (file.size > MAX_ATTACHMENT_BYTES) bad('발표 자료는 파일당 50MB 이하만 올릴 수 있습니다.');
    if (pres.attachments.length >= MAX_ATTACHMENTS) bad(`발표 자료는 ${MAX_ATTACHMENTS}개까지 올릴 수 있습니다.`);
    const attachment: Attachment = { id: uid('f'), name: file.name, size: file.size, contentType: file.type || 'application/octet-stream', uploadedAt: Date.now(), uploadedBy: me.id };
    await putFile(attachment.id, file);
    pres.attachments.push(attachment);
    save(d);
    return { status: 200, data: attachment };
  } catch (e) {
    if (e instanceof Fail) return { status: e.status, data: { message: e.message } };
    throw e;
  }
}

/** 발표 자료 내려받기: GET /projects/{pid}/presentations/{prid}/attachments/{aid}. 평가룸 참여자와 전체 열람 권한자 */
export async function mockDownload(pid: string, prid: string, aid: string, token: string | null): Promise<Blob> {
  const d = load();
  const me = token ? d.users.find(u => u.id === d.tokens[token]) : undefined;
  if (!me) throw new Fail(401, '로그인이 필요합니다.');
  canSee(d, pid, me);
  const pres = presentation(d, pid, prid);
  const blob = pres.attachments.some(a => a.id === aid) ? await getFile(aid) : undefined;
  if (!blob) throw new Fail(404, '발표 자료가 없습니다.');
  return blob;
}

export { Fail as MockFail };
