package com.scoreroom.invitation.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinByCodeRequest(@NotBlank(message = "입장 코드를 입력해 주세요.") String code) {
}
