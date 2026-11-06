package com.scoreroom.project.dto;

import jakarta.validation.constraints.NotNull;

import com.scoreroom.project.domain.ProjectSettings;

/**
 * 평가룸 설정 변경. 평가 규칙 값을 보내지 않으면 지금 값을 유지한다.
 * expectedVersion: 화면이 영향(지울 평가 수)을 보여줄 때 본 평가룸 version. 평가를 지우는 변경에만 필요하다.
 */
public record UpdateSettingsRequest(
        @NotNull(message = "점수 최솟값을 입력해 주세요.") Integer min,
        @NotNull(message = "점수 최댓값을 입력해 주세요.") Integer max,
        Integer aggMin,
        Integer aggMax,
        Boolean allowSelf,
        Boolean allowSameTeam,
        Boolean allowSameCrew,
        Boolean allowEdit,
        Boolean showRatingStatus,
        Boolean countSelf,
        Boolean countSameCrew,
        Boolean countSameTeam,
        Boolean allowAdminRating,
        Long expectedVersion) {

    public ProjectSettings toSettings(ProjectSettings current) {
        return new ProjectSettings(min, max, aggMin, aggMax,
                allowSelf != null ? allowSelf : current.allowSelf(),
                allowSameTeam != null ? allowSameTeam : current.allowSameTeam(),
                allowSameCrew != null ? allowSameCrew : current.allowSameCrew(),
                allowEdit != null ? allowEdit : current.allowEdit(),
                showRatingStatus != null ? showRatingStatus : current.showRatingStatus(),
                countSelf != null ? countSelf : current.countSelf(),
                countSameCrew != null ? countSameCrew : current.countSameCrew(),
                countSameTeam != null ? countSameTeam : current.countSameTeam(),
                allowAdminRating != null ? allowAdminRating : current.allowAdminRating());
    }
}
