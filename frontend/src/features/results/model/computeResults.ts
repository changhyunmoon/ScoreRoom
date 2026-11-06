// 결과 표의 줄과 평가자별 칸. 인원·평균·순위는 서버 집계(Summary)를 쓰고,
// 평가자별 점수·합계는 룸 운영자에게만 내려오는 점수로 계산한다
import type { ID } from '../../../shared/lib/types';
import { crewOf, involvedIds, presentationsOf, type CrewRole, type Presentation } from '../../presentations';
import { members, membership, type Project } from '../../projects';
import { blockReason, type Block, type Rating } from '../../ratings';
import type { DB } from '../../session';

export type Cell =
  | { kind: 'SCORE'; userId: ID; rating: Rating; inRange: boolean | null; outOfInput: boolean; counted: boolean } // counted: 집계(평균·순위)에 넣는 점수인지
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

/**
 * 이 점수를 집계(평균·순위)에 넣을지. 서버(RoomRoster.counts)와 같은 규칙:
 * 본인 점수는 본인 설정만 따르고, 그 밖에는 같은 발표 팀원·같은 회사 팀원 설정 중 하나라도 빼라고 하면 뺀다
 */
export function isCounted(d: DB, project: Project, pres: Presentation, raterId: ID, targetId: ID) {
  const s = project.settings;
  if (raterId === targetId) return s.countSelf;
  if (!s.countSameCrew && involvedIds(pres).includes(raterId)) return false;
  const raterTeam = membership(d, project.id, raterId)?.teamIdAtJoin ?? null;
  return s.countSameTeam || raterTeam === null || raterTeam !== (membership(d, project.id, targetId)?.teamIdAtJoin ?? null);
}

/** 발표 순서 → 구성원 순서(대표·발표자·팀원)로 결과 줄을 만든다. 점수는 볼 수 있는 것만으로 계산된다 */
export function computeResults(d: DB, project: Project): ResultRow[] {
  const { aggMin, aggMax, min, max } = project.settings;
  const hasAgg = aggMin !== null && aggMax !== null;
  const ms = members(d, project.id);
  return presentationsOf(d, project.id).flatMap(pres => crewOf(pres).map(({ id: targetId, role }) => {
    const ratings = d.ratings.filter(r => r.presentationId === pres.id && r.targetId === targetId);
    // 평균·합계에는 집계에 넣는 점수만. count(평가함)는 제출한 사람 모두
    const counted = new Set(ratings.filter(r => isCounted(d, project, pres, r.raterId, targetId)).map(r => r.raterId));
    const scores = ratings.filter(r => counted.has(r.raterId)).map(r => r.score);
    const inScores = hasAgg ? scores.filter(s => s >= aggMin! && s <= aggMax!) : [];
    const sum = scores.reduce((a, b) => a + b, 0);
    const inSum = inScores.reduce((a, b) => a + b, 0);
    const cells: Cell[] = ms.map(m => {
      const rating = ratings.find(r => r.raterId === m.userId);
      if (rating) return {
        kind: 'SCORE', userId: m.userId, rating,
        inRange: hasAgg ? rating.score >= aggMin! && rating.score <= aggMax! : null,
        outOfInput: rating.score < min || rating.score > max,
        counted: counted.has(m.userId),
      };
      const b = blockReason(d, project, pres, m.userId, targetId);
      if (b) return { kind: 'BLOCKED', userId: m.userId, reason: b };
      return { kind: 'NOT_RATED', userId: m.userId };
    });
    return {
      key: `${pres.id}:${targetId}`, pres, targetId, role, cells,
      count: ratings.length, sum, avg: scores.length ? sum / scores.length : null,
      // 집계 기준을 쓰는데 점수가 모두 기준 밖이면 합계·평균 0 (점수가 하나도 없으면 평균 없음). 서버와 같은 규칙
      inCount: inScores.length, inSum, inAvg: !hasAgg || !scores.length ? null : inScores.length ? inSum / inScores.length : 0,
    };
  }));
}

/** 평균이 높은 순으로 순위를 매긴다. 같은 평균은 같은 순위(1, 1, 3), 평균이 없으면 순위 없음. 표와 이미지가 같은 함수를 쓴다 */
export function rankBy<T extends { key: string }>(rows: T[], value: (r: T) => number | null) {
  const vals = rows.map(r => ({ key: r.key, v: value(r) })).filter((x): x is { key: string; v: number } => x.v !== null);
  return new Map(vals.map(x => [x.key, 1 + vals.filter(y => y.v > x.v).length]));
}
