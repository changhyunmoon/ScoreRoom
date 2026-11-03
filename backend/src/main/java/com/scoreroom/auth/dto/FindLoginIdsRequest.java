package com.scoreroom.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record FindLoginIdsRequest(
        @NotBlank(message = "이름을 입력해 주세요.") String name,
        @NotBlank(message = "전화번호를 입력해 주세요.") String phone) {
}
