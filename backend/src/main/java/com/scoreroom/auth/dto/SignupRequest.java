package com.scoreroom.auth.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "이메일을 입력해 주세요.") String loginId,
        @NotBlank(message = "비밀번호를 입력해 주세요.") String password,
        @NotBlank(message = "이름을 입력해 주세요.") @Size(max = 100, message = "이름은 100자 이하로 입력해 주세요.") String name,
        @NotBlank(message = "전화번호를 입력해 주세요.") @Size(max = 30, message = "전화번호는 30자 이하로 입력해 주세요.") String phone,
        @NotNull(message = "회사 팀을 선택해 주세요.") UUID teamId,
        @Size(max = 30, message = "직위는 30자 이하로 입력해 주세요.") String position) {
}
