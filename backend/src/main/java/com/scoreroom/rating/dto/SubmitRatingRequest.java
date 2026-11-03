package com.scoreroom.rating.dto;

import jakarta.validation.constraints.NotNull;

/** 점수(정수, 필수)와 피드백(선택, 1000자 이하). 평가자는 로그인 세션에서 정한다 */
public record SubmitRatingRequest(@NotNull(message = "점수를 입력해 주세요.") Integer score, String feedback) {
}
