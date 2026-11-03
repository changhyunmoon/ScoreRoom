package com.scoreroom.user.dto;

import jakarta.validation.constraints.Size;

public record SetPositionRequest(@Size(max = 30, message = "직위는 30자 이하로 입력해 주세요.") String position) {
}
