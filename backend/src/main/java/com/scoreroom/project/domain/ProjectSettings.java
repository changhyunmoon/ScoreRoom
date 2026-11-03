package com.scoreroom.project.domain;

import com.scoreroom.common.error.ApiException;

/**
 * 평가룸 설정.
 * - min~max: 점수 입력 범위 (정수)
 * - aggMin~aggMax: 집계 기준 범위. 둘 다 null이면 사용 안 함
 * - allowSelf / allowSameTeam / allowSameCrew: 본인 / 같은 회사 팀 / 같은 발표 구성원 평가 허용
 * - allowEdit: 제출한 점수 수정 허용
 */
public record ProjectSettings(
        int min,
        int max,
        Integer aggMin,
        Integer aggMax,
        boolean allowSelf,
        boolean allowSameTeam,
        boolean allowSameCrew,
        boolean allowEdit) {

    public static ProjectSettings defaults() {
        return new ProjectSettings(0, 100, null, null, false, false, false, true);
    }

    public boolean hasAggregationRange() {
        return aggMin != null && aggMax != null;
    }

    /** 점수 입력 범위가 바뀌면 기존 평가를 모두 지운다 */
    public boolean rangeChangedFrom(ProjectSettings before) {
        return min != before.min || max != before.max;
    }

    public ProjectSettings withoutAggregation() {
        return new ProjectSettings(min, max, null, null, allowSelf, allowSameTeam, allowSameCrew, allowEdit);
    }

    /** 화면(validateSettings)과 같은 순서로 검사한다 */
    public ProjectSettings validate() {
        if (min >= max) {
            throw ApiException.badRequest("점수 최솟값은 최댓값보다 작아야 합니다.");
        }
        if ((aggMin == null) != (aggMax == null)) {
            throw ApiException.badRequest("집계 기준은 최저치·최대치를 함께 설정해야 합니다.");
        }
        if (hasAggregationRange()) {
            if (aggMin > aggMax) {
                throw ApiException.badRequest("집계 기준 최저치가 최대치보다 클 수 없습니다.");
            }
            if (aggMin < min || aggMax > max) {
                throw ApiException.badRequest("집계 기준은 점수 입력 범위 안에 있어야 합니다.");
            }
        }
        return this;
    }
}
