package com.scoreroom.presentation.dto;

import java.util.List;
import java.util.UUID;

/** 발표 등록을 요청할 참여자들 */
public record PresentationRequestRequest(List<UUID> userIds) {
}
