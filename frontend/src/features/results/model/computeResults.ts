// 결과 표의 줄과 평가자별 칸. 인원·평균·순위는 서버 집계(Summary)를 쓰고,
// 평가자별 점수·합계는 룸 관리자에게만 내려오는 점수로 계산한다
import type { ID } from '../../../shared/lib/types';
import { involvedIds, presentationsOf, type Presentation } from '../../presentations';
import { members, membership, type Project } from '../../projects';
import { blockReason, type Block, type Rating } from '../../ratings';
import type { DB } from '../../session';

export type Cell =
  // counted: 집계(평균·순위)에 넣는 점수인지, trimmed: 극단값 제외로 전체 평균에서 뺀 최고점(HIGH)·최저점(LOW),
  // inTrimmed: 집계 기준 범위 안 점수 중 극단값이라 집계 기준 평균에서 뺀 점수
  | { kind: 'SCORE'; userId: ID; rating: Rating; inRange: boolean | null; outOfInput: boolean; counted: boolean; trimmed: Trim; inTrimmed: Trim }
  | { kind: 'NOT_RATED'; userId: ID }   // 평가 안 함 (평균 제외)
  | { kind: 'BLOCKED'; userId: ID; reason: Exclude<Block, null> }; // 평가 불가

export type Trim = 'HIGH' | 'LOW' | null;

/** 결과 한 줄 = 발표 하나 (팀 발표도 한 줄) */
export interface ResultRow {
  key: string; // presentationId
  pres: Presentation;
  count: number; sum: number; avg: number | null;
  /** 집계에 넣는 점수 개수 (극단값을 빼기 전). 뺄 수 있는 개수를 알려 줄 때 쓴다 */
  countedCount: number;
  inCount: number; inSum: number; inAvg: number | null;
  cells: Cell[]; // 평가자(참여자)별 칸
}

/**
 * 이 점수를 집계(평균·순위)에 넣을지. 서버(RoomRoster.counts)와 같은 규칙:
 * 본인 발표(구성원이 준 점수)는 본인 설정만 따르고, 그 밖에는 구성원 중 같은 회사 팀인 사람이 있으면 같은 팀 설정을 따른다.
 * 룸 관리자 점수를 빼기로 했으면 관리자 점수는 뺀다
 */
export function isCounted(d: DB, project: Project, pres: Presentation, raterId: ID) {
  const s = project.settings;
  if (!s.countAdmin && membership(d, project.id, raterId)?.isAdmin) return false;
  const crew = involvedIds(pres);
  if (crew.includes(raterId)) return s.countSelf;
  const raterTeam = membership(d, project.id, raterId)?.teamIdAtJoin ?? null;
  return s.countSameTeam || raterTeam === null || !crew.some(id => membership(d, project.id, id)?.teamIdAtJoin === raterTeam);
}

/**
 * 극단값 제외 (서버 SummaryCalculator.trim과 같은 규칙): 점수가 빼는 개수의 합보다 많으면 낮은 점수 trimBottom개, 높은 점수 trimTop개를 뺀다.
 * 같은 점수가 여럿이어도 개수만큼만 뺀다. 같은 점수 중 어느 칸을 뺀 것으로 표시할지는 들어온 순서(표의 평가자 순서)로 정한다 (평균은 같다)
 */
export function trimScores<T>(items: T[], score: (x: T) => number, s: Project['settings']): { kept: T[]; low: T[]; high: T[] } {
  if ((s.trimTop <= 0 && s.trimBottom <= 0) || items.length <= s.trimTop + s.trimBottom) return { kept: items, low: [], high: [] };
  const sorted = [...items].sort((a, b) => score(a) - score(b));
  return {
    low: sorted.slice(0, s.trimBottom),
    kept: sorted.slice(s.trimBottom, sorted.length - s.trimTop),
    high: sorted.slice(sorted.length - s.trimTop),
  };
}

/** 발표 순서대로 결과 줄을 만든다. 점수는 볼 수 있는 것만으로 계산된다 */
export function computeResults(d: DB, project: Project): ResultRow[] {
  const { aggMin, aggMax, min, max } = project.settings;
  const hasAgg = aggMin !== null && aggMax !== null;
  // 평가자로 세는 사람만 칸으로 만든다. 관리자 평가를 껐거나 룸 관리자가 준 점수를 미포함하면 룸 관리자는 빠진다 (서버 RoomRoster.raters와 같은 규칙)
  const { allowAdminRating, countAdmin } = project.settings;
  const ms = members(d, project.id).filter(m => !m.isAdmin || (allowAdminRating && countAdmin));
  const raterIds = new Set(ms.map(m => m.userId));
  return presentationsOf(d, project.id).map(pres => {
    // 평가자로 세지 않는 사람(빠진 룸 관리자)이 준 점수는 평가함·평균에서 모두 뺀다
    const ratings = d.ratings.filter(r => r.presentationId === pres.id && raterIds.has(r.raterId));
    // 평균·합계에는 집계에 넣는 점수만. count(평가함)는 평가자로 세는 사람이 제출한 점수 모두
    const counted = new Set(ratings.filter(r => isCounted(d, project, pres, r.raterId)).map(r => r.raterId));
    // 표의 평가자 순서로 둔다 (같은 점수 중 어느 칸을 극단값으로 표시할지 고정)
    const countedRatings = ms.flatMap(m => ratings.filter(r => r.raterId === m.userId && counted.has(r.raterId)));
    const inRatings = hasAgg ? countedRatings.filter(r => r.score >= aggMin! && r.score <= aggMax!) : [];
    // 극단값 제외는 전체 점수와 집계 기준 안 점수에 각각 적용한다 (서버와 같은 규칙)
    const trim = trimScores(countedRatings, r => r.score, project.settings);
    const inTrim = trimScores(inRatings, r => r.score, project.settings);
    const inKept = inTrim.kept.map(r => r.score);
    const inLow = new Set(inTrim.low.map(r => r.raterId));
    const inHigh = new Set(inTrim.high.map(r => r.raterId));
    const scores = trim.kept.map(r => r.score);
    const low = new Set(trim.low.map(r => r.raterId));
    const high = new Set(trim.high.map(r => r.raterId));
    const sum = scores.reduce((a, b) => a + b, 0);
    const inSum = inKept.reduce((a, b) => a + b, 0);
    const cells: Cell[] = ms.map(m => {
      const rating = ratings.find(r => r.raterId === m.userId);
      if (rating) return {
        kind: 'SCORE', userId: m.userId, rating,
        inRange: hasAgg ? rating.score >= aggMin! && rating.score <= aggMax! : null,
        outOfInput: rating.score < min || rating.score > max,
        counted: counted.has(m.userId),
        trimmed: high.has(m.userId) ? 'HIGH' : low.has(m.userId) ? 'LOW' : null,
        inTrimmed: inHigh.has(m.userId) ? 'HIGH' : inLow.has(m.userId) ? 'LOW' : null,
      };
      const b = blockReason(d, project, pres, m.userId);
      if (b) return { kind: 'BLOCKED', userId: m.userId, reason: b };
      return { kind: 'NOT_RATED', userId: m.userId };
    });
    return {
      key: pres.id, pres, cells, countedCount: countedRatings.length,
      count: ratings.length, sum, avg: scores.length ? sum / scores.length : null,
      // 집계 기준을 쓰는데 점수가 모두 기준 밖이면 합계·평균 0 (점수가 하나도 없으면 평균 없음). 서버와 같은 규칙
      // 합계·평균은 극단값을 뺀 점수로, inCount는 빼기 전 기준 안 제출 수 (서버 inCount와 같음)
      inCount: inRatings.length, inSum, inAvg: !hasAgg || !scores.length ? null : inKept.length ? inSum / inKept.length : 0,
    };
  });
}

/** 평균이 높은 순으로 순위를 매긴다. 같은 평균은 같은 순위(1, 1, 3), 평균이 없으면 순위 없음. 표와 이미지가 같은 함수를 쓴다 */
export function rankBy<T extends { key: string }>(rows: T[], value: (r: T) => number | null) {
  const vals = rows.map(r => ({ key: r.key, v: value(r) })).filter((x): x is { key: string; v: number } => x.v !== null);
  return new Map(vals.map(x => [x.key, 1 + vals.filter(y => y.v > x.v).length]));
}
