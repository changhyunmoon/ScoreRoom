package com.scoreroom.user.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 내 정보 수정. 비밀번호는 바꿀 때만 newPassword와 currentPassword를 함께 보낸다 */
public record UpdateProfileRequest(
        @NotBlank(message = "이메일을 입력해 주세요.") String loginId,
        @NotBlank(message = "이름을 입력해 주세요.") @Size(max = 100, message = "이름은 100자 이하로 입력해 주세요.") String name,
        @NotBlank(message = "전화번호를 입력해 주세요.") @Size(max = 30, message = "전화번호는 30자 이하로 입력해 주세요.") String phone,
        UUID teamId,
        @Size(max = 30, message = "직위는 30자 이하로 입력해 주세요.") String position,
        String currentPassword,
        String newPassword) {
}
