// 평가 가능 여부와 결과 집계 규칙. 목업 API도 같은 규칙으로 최종 판단한다.
// 발표 상태는 없고 마감 전까지 언제든 평가한다. 점수는 발표 구성원(대표·발표자·팀원) 한 명씩 따로 준다.
import { involvedIds, type DB, type ID, type Presentation, type Project, type Rating } from './store';

export const members = (d: DB, pid: ID) => d.memberships.filter(m => m.projectId === pid);
export const membership = (d: DB, pid: ID, userId: ID) => d.memberships.find(m => m.projectId === pid && m.userId === userId);
export const userName = (d: DB, id: ID) => d.users.find(u => u.id === id)?.name ?? '(알 수 없음)';
export const teamName = (d: DB, id: ID | null) => (id ? d.teams.find(t => t.id === id)?.name ?? '(삭제된 팀)' : '소속 없음');
export const presentationsOf = (d: DB, pid: ID) =>
  d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);

export type Block = 'SELF' | 'SAME_CREW' | 'SAME_TEAM' | null;

/**
 * 발표 구성원과 역할 (대표 → 발표자 → 팀원 순서). 모두 한 명씩 평가받는다.
 * 대표가 발표도 하면 presenterIds에 대표가 함께 들어 있고, 그 사람은 한 번만 나온다 (역할: 대표·발표자).
 */
export type CrewRole = 'LEADER' | 'LEADER_PRESENTER' | 'PRESENTER' | 'MEMBER';
export const crewOf = (p: Presentation): { id: ID; role: CrewRole }[] => [
  { id: p.leaderId, role: p.presenterIds.includes(p.leaderId) ? 'LEADER_PRESENTER' : 'LEADER' },
  ...p.presenterIds.filter(id => id !== p.leaderId).map(id => ({ id, role: 'PRESENTER' as const })),
  ...p.memberIds.filter(id => id !== p.leaderId).map(id => ({ id, role: 'MEMBER' as const })),
];
export const roleText: Record<CrewRole, string> = { LEADER: '대표', LEADER_PRESENTER: '대표·발표자', PRESENTER: '발표자', MEMBER: '팀원' };

/**
 * 평가자(raterId)가 발표 구성원(targetId)을 평가할 수 없는 이유. null이면 평가 가능. 목업 API도 같은 규칙으로 판단한다.
 * - SELF: 나 자신 (본인 평가 허용이 꺼져 있으면)
 * - SAME_CREW: 내가 구성원인 발표의 다른 구성원 (같은 발표 팀원 평가 허용이 꺼져 있으면)
 * - SAME_TEAM: 나와 같은 회사 팀인 사람 (같은 팀 평가 허용이 꺼져 있으면)
 */
export function blockReason(d: DB, project: Project, pres: Presentation, raterId: ID, targetId: ID): Block {
  const { allowSelf, allowSameTeam, allowSameCrew } = project.settings;
  if (targetId === raterId) return allowSelf ? null : 'SELF';
  if (!allowSameCrew && involvedIds(pres).includes(raterId)) return 'SAME_CREW';
  const myTeam = membership(d, project.id, raterId)?.teamIdAtJoin ?? null;
  if (!allowSameTeam && myTeam && membership(d, project.id, targetId)?.teamIdAtJoin === myTeam) return 'SAME_TEAM';
  return null;
}
export const blockText: Record<Exclude<Block, null>, string> = {
  SELF: '본인은 평가할 수 없습니다.',
  SAME_CREW: '같은 발표의 팀원은 평가할 수 없습니다.',
  SAME_TEAM: '같은 회사 팀이라 평가할 수 없습니다.',
};
export const blockShort: Record<Exclude<Block, null>, string> = { SELF: '본인', SAME_CREW: '같은 발표', SAME_TEAM: '같은 팀' };

/** 평가 규칙을 바꾸면 새 규칙에 맞지 않게 되는 기존 평가 (저장할 때 삭제된다) */
export function ratingsBlockedBy(d: DB, project: Project, settings: Project['settings']) {
  const changed = { ...project, settings };
  return d.ratings.filter(r => {
    if (r.projectId !== project.id) return false;
    const pres = d.presentations.find(p => p.id === r.presentationId);
    return !!pres && blockReason(d, changed, pres, r.raterId, r.targetId) !== null;
  });
}

/** 내가 이 발표에서 평가할 수 있는 구성원 수와 이미 평가한 수 */
export function myProgress(d: DB, project: Project, pres: Presentation, userId: ID) {
  const ratable = crewOf(pres).filter(c => !blockReason(d, project, pres, userId, c.id));
  const rated = ratable.filter(c => d.ratings.some(r => r.presentationId === pres.id && r.targetId === c.id && r.raterId === userId));
  return { ratable: ratable.length, rated: rated.length };
}

/** 참여자 입장에서 본 발표 상태. 화면 전체에서 같은 색·아이콘·문구로 표시한다 */
export type MyStatus = 'TODO' | 'DONE' | 'BLOCKED' | 'MISSED';
export function myStatus(d: DB, project: Project, pres: Presentation, userId: ID): MyStatus {
  const { ratable, rated } = myProgress(d, project, pres, userId);
  if (ratable === 0) return 'BLOCKED';
  if (rated === ratable) return 'DONE';
  // 마감된 평가룸은 모든 발표가 끝난 것으로 보고, 다 평가하지 않은 발표는 '평가 안 함'으로 둔다
  return project.status === 'CLOSED' ? 'MISSED' : 'TODO';
}
export const statusMeta = {
  TODO: { label: '평가 필요', tone: 'amber', icon: 'star' },
  DONE: { label: '평가 완료', tone: 'green', icon: 'checkCircle' },
  BLOCKED: { label: '평가 불가', tone: 'gray', icon: 'lock' },
  MISSED: { label: '평가 안 함', tone: 'gray', icon: 'ban' },
} as const;

export type Cell =
  | { kind: 'SCORE'; userId: ID; rating: Rating; inRange: boolean | null; outOfInput: boolean }
  | { kind: 'NOT_RATED'; userId: ID }   // 평가 안 함 (평균 제외)
  | { kind: 'BLOCKED'; userId: ID; reason: Exclude<Block, null> }; // 평가 불가

/** 결과 한 줄 = 발표 구성원 한 명 */
export interface ResultRow {
  key: string; // presentationId:targetId
  pres: Presentation;
  targetId: ID;
  role: CrewRole;
  count: number; sum: number; avg: number | null;
  inCount: number; inSum: number; inAvg: number | null;
  cells: Cell[]; // 평가자(참여자)별 칸
}

/** 발표 순서 → 구성원 순서(대표·발표자·팀원)로 결과 줄을 만든다. 점수는 볼 수 있는 것만으로 계산된다 */
export function computeResults(d: DB, project: Project): ResultRow[] {
  const { aggMin, aggMax, min, max } = project.settings;
  const hasAgg = aggMin !== null && aggMax !== null;
  const ms = members(d, project.id);
  return presentationsOf(d, project.id).flatMap(pres => crewOf(pres).map(({ id: targetId, role }) => {
    const ratings = d.ratings.filter(r => r.presentationId === pres.id && r.targetId === targetId);
    const scores = ratings.map(r => r.score);
    const inScores = hasAgg ? scores.filter(s => s >= aggMin! && s <= aggMax!) : [];
    const sum = scores.reduce((a, b) => a + b, 0);
    const inSum = inScores.reduce((a, b) => a + b, 0);
    const cells: Cell[] = ms.map(m => {
      const rating = ratings.find(r => r.raterId === m.userId);
      if (rating) return {
        kind: 'SCORE', userId: m.userId, rating,
        inRange: hasAgg ? rating.score >= aggMin! && rating.score <= aggMax! : null,
        outOfInput: rating.score < min || rating.score > max,
      };
      const b = blockReason(d, project, pres, m.userId, targetId);
      if (b) return { kind: 'BLOCKED', userId: m.userId, reason: b };
      return { kind: 'NOT_RATED', userId: m.userId };
    });
    return {
      key: `${pres.id}:${targetId}`, pres, targetId, role, cells,
      count: scores.length, sum, avg: scores.length ? sum / scores.length : null,
      inCount: inScores.length, inSum, inAvg: inScores.length ? inSum / inScores.length : null,
    };
  }));
}

/** 팀 사람들을 조직도 순서(위 = 높은 사람)대로. 같은 순서면 이름순 */
export const byRank = <T extends { rank: number; name: string }>(a: T, b: T) => a.rank - b.rank || a.name.localeCompare(b.name);
export const userOf = (d: DB, id: ID) => d.users.find(u => u.id === id);

/* ---------- 발표 정렬 ---------- */
export type PresSort = 'order' | 'created' | 'team';
export const presSortText: Record<PresSort, string> = { order: '관리자 설정 순', created: '등록순', team: '팀 구조도 순' };

/** 회사 팀 구조도에서 위에서부터 읽은 순서 (상위 팀 → 하위 팀) */
export function teamRank(d: DB) {
  const rank = new Map<ID, number>();
  const walk = (parent: ID | null) => d.teams.filter(t => t.parentId === parent).forEach(t => { rank.set(t.id, rank.size); walk(t.id); });
  walk(null);
  return rank;
}

/** 발표 목록 정렬. 팀 구조도 순은 대표의 팀 기준이고, 같은 팀 안에서는 관리자 설정 순 */
export function sortPresentations(d: DB, project: Project, list: Presentation[], mode: PresSort) {
  if (mode === 'order') return [...list].sort((a, b) => a.order - b.order);
  if (mode === 'created') return [...list].sort((a, b) => a.createdAt - b.createdAt || a.order - b.order);
  const rank = teamRank(d);
  const teamOf = (p: Presentation) => membership(d, project.id, p.leaderId)?.teamIdAtJoin ?? null;
  const rankOf = (p: Presentation) => {
    const t = teamOf(p);
    return t != null && rank.has(t) ? rank.get(t)! : Number.MAX_SAFE_INTEGER;
  };
  return [...list].sort((a, b) => rankOf(a) - rankOf(b) || (teamOf(a) ?? '').localeCompare(teamOf(b) ?? '') || a.order - b.order);
}

/* ---------- 평가룸 접근 ---------- */
/** 평가룸에서 내 자격: 룸 운영자 / 참여자 / 전체 열람(참여하지 않았지만 볼 수만 있음) / 없음 */
export function roomAccess(d: DB, projectId: ID, user: { id: ID; canViewAll: boolean }) {
  const m = membership(d, projectId, user.id);
  if (m) return m.isAdmin ? 'admin' : 'member';
  return user.canViewAll ? 'viewer' : null;
}

export function formatAvg(v: number | null, decimals: boolean) {
  if (v === null) return '—';
  if (!decimals) return String(Math.round(v));
  return String(Math.round(v * 10000) / 10000);
}

/** 파일 크기 표시: 1.2MB, 340KB */
export function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export const presTypeText = { PERSONAL: '개인', TEAM: '팀' } as const;

/** 날짜만: 2026.10.30 */
export function dateText(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function timeText(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 목록용 한 줄 요약: "정예린 외 2명" (대표 기준) */
export function crewSummary(d: DB, p: Presentation) {
  const others = involvedIds(p).length - 1;
  return others > 0 ? `${userName(d, p.leaderId)} 외 ${others}명` : userName(d, p.leaderId);
}
/** 검색용: 구성원 전체 이름 */
export const crewNames = (d: DB, p: Presentation) => involvedIds(p).map(id => userName(d, id));
