import type { Settings } from './types';

/** 화면에서 바로 보여줄 입력 검사 (서버도 같은 순서로 검사한다) */
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

/** 점수 입력 범위가 바뀌는지 (바뀌면 기존 평가가 모두 지워진다) */
export const rangeChanged = (before: Settings, after: Pick<Settings, 'min' | 'max'>) =>
  before.min !== after.min || before.max !== after.max;
