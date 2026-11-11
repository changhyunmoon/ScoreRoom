package com.scoreroom.rating.dto;

import java.util.List;
import java.util.UUID;

/** 이 발표를 평가해 달라고 요청할 참여자들 */
public record RatingRequestRequest(List<UUID> userIds) {
}
