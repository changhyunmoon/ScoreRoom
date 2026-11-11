package com.scoreroom.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 평가룸 기본 정보(이름·설명) 수정. 만들 때와 같은 규칙으로 검사한다 */
public record UpdateProjectInfoRequest(
        @NotBlank(message = "평가룸 이름을 입력해 주세요.") @Size(max = 200, message = "평가룸 이름은 200자 이하로 입력해 주세요.") String name,
        @Size(max = 2000, message = "설명은 2000자 이하로 입력해 주세요.") String description) {
}
