package com.scoreroom.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 시스템 관리자가 팀에 새 사용자를 등록한다 */
public record CreateUserRequest(
        @NotBlank(message = "이메일을 입력해 주세요.") String loginId,
        @NotBlank(message = "초기 비밀번호를 입력해 주세요.") String password,
        @NotBlank(message = "이름을 입력해 주세요.") @Size(max = 100, message = "이름은 100자 이하로 입력해 주세요.") String name,
        @NotBlank(message = "전화번호를 입력해 주세요.") @Size(max = 30, message = "전화번호는 30자 이하로 입력해 주세요.") String phone,
        @Size(max = 30, message = "직위는 30자 이하로 입력해 주세요.") String position) {
}
