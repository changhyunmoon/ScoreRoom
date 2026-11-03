package com.scoreroom.presentation.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;

/** 드래그로 바꾼 전체 발표 순서 */
public record ReorderPresentationsRequest(@NotNull(message = "발표 순서를 보내 주세요.") List<UUID> ids) {
}
