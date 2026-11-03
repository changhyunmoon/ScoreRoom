package com.scoreroom.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 이메일·이름·전화번호로 본인을 확인하고 새 비밀번호로 바꾼다 */
public record RecoverPasswordRequest(
        @NotBlank(message = "이메일을 입력해 주세요.") String loginId,
        @NotBlank(message = "이름을 입력해 주세요.") String name,
        @NotBlank(message = "전화번호를 입력해 주세요.") String phone,
        @NotBlank(message = "새 비밀번호를 입력해 주세요.") String newPassword) {
}
