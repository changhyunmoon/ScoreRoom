package com.scoreroom.project.domain;

import com.scoreroom.common.error.ApiException;

/**
 * 평가룸 설정.
 * - min~max: 점수 입력 범위 (정수)
 * - aggMin~aggMax: 집계 기준 범위. 둘 다 null이면 사용 안 함
 * - allowSelf / allowSameTeam / allowSameCrew: 본인 / 같은 회사 팀 / 같은 발표 구성원 평가 허용
 * - allowEdit: 제출한 점수 수정 허용
 * - showRatingStatus: 참여자에게도 사람별 평가 현황(전체·평가함·평가 불가·미평가 인원)을 보여 줌. 룸 관리자는 항상 본다
 * - countSelf / countSameCrew / countSameTeam: 본인 점수 / 같은 발표 팀원이 준 점수 / 같은 회사 팀원이 준 점수를 집계(평균·순위)에 넣을지
 * - allowAdminRating: 룸 관리자도 평가할지. 끄면 관리자는 평가자에서 빠진다 (관리자는 어떤 경우에도 발표하지 않는다)
 */
public record ProjectSettings(
        int min,
        int max,
        Integer aggMin,
        Integer aggMax,
        boolean allowSelf,
        boolean allowSameTeam,
        boolean allowSameCrew,
        boolean allowEdit,
        boolean showRatingStatus,
        boolean countSelf,
        boolean countSameCrew,
        boolean countSameTeam,
        boolean allowAdminRating) {

    public static ProjectSettings defaults() {
        return new ProjectSettings(0, 100, null, null, true, true, true, true, true, true, true, true, false);
    }

    public boolean hasAggregationRange() {
        return aggMin != null && aggMax != null;
    }

    /** 점수 입력 범위가 바뀌면 기존 평가를 모두 지운다 */
    public boolean rangeChangedFrom(ProjectSettings before) {
        return min != before.min || max != before.max;
    }

    public ProjectSettings withoutAggregation() {
        return new ProjectSettings(min, max, null, null, allowSelf, allowSameTeam, allowSameCrew, allowEdit, showRatingStatus,
                countSelf, countSameCrew, countSameTeam, allowAdminRating);
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
