package com.scoreroom.user.dto;

import jakarta.validation.constraints.NotBlank;

public record ResetPasswordRequest(@NotBlank(message = "새 비밀번호를 입력해 주세요.") String password) {
}
