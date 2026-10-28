// 평가 가능 여부와 결과 집계 규칙. 실제 구현에서는 서버(rating/result 패키지)에서 동일하게 계산한다.
import { involvedIds, type DB, type ID, type Presentation, type Project, type Rating, type RatingHistory } from './store';

export const members = (d: DB, pid: ID) => d.memberships.filter(m => m.projectId === pid);
export const membership = (d: DB, pid: ID, userId: ID) => d.memberships.find(m => m.projectId === pid && m.userId === userId);
export const userName = (d: DB, id: ID) => d.users.find(u => u.id === id)?.name ?? '(알 수 없음)';
export const teamName = (d: DB, id: ID | null) => (id ? d.teams.find(t => t.id === id)?.name ?? '(삭제된 팀)' : '소속 없음');
export const presentationsOf = (d: DB, pid: ID) =>
  d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);

export type Block = 'SELF' | 'SAME_TEAM' | 'SCHEDULED' | null;

/** 평가 불가 사유. null이면 평가 가능 */
export function blockReason(d: DB, project: Project, pres: Presentation, userId: ID): Block {
  const team = involvedIds(pres);
  if (team.includes(userId)) return 'SELF';
  if (!project.settings.allowSameTeam) {
    const myTeam = membership(d, project.id, userId)?.teamIdAtJoin;
    if (myTeam && team.some(id => membership(d, project.id, id)?.teamIdAtJoin === myTeam)) return 'SAME_TEAM';
  }
  if (pres.status === 'SCHEDULED') return 'SCHEDULED';
  return null;
}
export const blockText: Record<Exclude<Block, null>, string> = {
  SELF: '내가 대표·발표자·팀원으로 참여한 발표라 평가할 수 없습니다.',
  SAME_TEAM: '같은 팀 발표라 평가할 수 없습니다.',
  SCHEDULED: '아직 시작되지 않은 발표입니다.',
};

/** 참여자 입장에서 본 발표 상태. 화면 전체에서 같은 색·아이콘·문구로 표시한다 */
export type MyStatus = 'TODO' | 'DONE' | 'BLOCKED' | 'SCHEDULED';
export function myStatus(d: DB, project: Project, pres: Presentation, userId: ID): MyStatus {
  if (d.ratings.some(r => r.presentationId === pres.id && r.raterId === userId)) return 'DONE';
  if (pres.status === 'SCHEDULED') return 'SCHEDULED';
  return blockReason(d, project, pres, userId) ? 'BLOCKED' : 'TODO';
}
export const statusMeta = {
  TODO: { label: '평가 필요', tone: 'amber', icon: 'star' },
  DONE: { label: '평가 완료', tone: 'green', icon: 'checkCircle' },
  BLOCKED: { label: '평가 불가', tone: 'gray', icon: 'lock' },
  SCHEDULED: { label: '발표 전', tone: 'blue', icon: 'clock' },
} as const;

export type Cell =
  | { kind: 'SCORE'; userId: ID; rating: Rating; history: RatingHistory[]; inRange: boolean | null; outOfInput: boolean }
  | { kind: 'NOT_RATED'; userId: ID }   // 평가 안 함 (평균 제외)
  | { kind: 'BLOCKED'; userId: ID; reason: 'SELF' | 'SAME_TEAM' } // 평가 불가
  | { kind: 'PENDING'; userId: ID };    // 발표 전

export interface ResultRow {
  pres: Presentation;
  count: number; sum: number; avg: number | null;
  inCount: number; inSum: number; inAvg: number | null;
  cells: Cell[];
}

export function computeResults(d: DB, project: Project): ResultRow[] {
  const { aggMin, aggMax, min, max } = project.settings;
  const hasAgg = aggMin !== null && aggMax !== null;
  const ms = members(d, project.id);
  return presentationsOf(d, project.id).map(pres => {
    const ratings = d.ratings.filter(r => r.presentationId === pres.id);
    const scores = ratings.map(r => r.score);
    const inScores = hasAgg ? scores.filter(s => s >= aggMin! && s <= aggMax!) : [];
    const sum = scores.reduce((a, b) => a + b, 0);
    const inSum = inScores.reduce((a, b) => a + b, 0);
    const cells: Cell[] = ms.map(m => {
      const rating = ratings.find(r => r.raterId === m.userId);
      if (rating) return {
        kind: 'SCORE', userId: m.userId, rating,
        history: d.history.filter(h => h.ratingId === rating.id).sort((a, b) => a.at - b.at),
        inRange: hasAgg ? rating.score >= aggMin! && rating.score <= aggMax! : null,
        outOfInput: rating.score < min || rating.score > max,
      };
      const b = blockReason(d, project, pres, m.userId);
      if (b === 'SELF' || b === 'SAME_TEAM') return { kind: 'BLOCKED', userId: m.userId, reason: b };
      if (b === 'SCHEDULED') return { kind: 'PENDING', userId: m.userId };
      return { kind: 'NOT_RATED', userId: m.userId };
    });
    return {
      pres, cells,
      count: scores.length, sum, avg: scores.length ? sum / scores.length : null,
      inCount: inScores.length, inSum, inAvg: inScores.length ? inSum / inScores.length : null,
    };
  });
}

export function formatAvg(v: number | null, decimals: boolean) {
  if (v === null) return '—';
  if (!decimals) return String(Math.round(v));
  return String(Math.round(v * 10000) / 10000);
}

export const presTypeText = { PERSONAL: '개인', TEAM: '회사 팀', FREE: '자유 구성' } as const;

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
