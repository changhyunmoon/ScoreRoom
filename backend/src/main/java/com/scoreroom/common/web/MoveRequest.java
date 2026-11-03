package com.scoreroom.common.web;

import jakarta.validation.constraints.NotNull;

/** 목록에서 한 칸 옮기기. dir: -1 위로, 1 아래로 */
public record MoveRequest(@NotNull(message = "이동 방향을 정해 주세요.") Integer dir) {
}
