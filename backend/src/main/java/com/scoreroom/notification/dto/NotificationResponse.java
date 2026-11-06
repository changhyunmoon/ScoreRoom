package com.scoreroom.notification.dto;

import java.util.UUID;

/** 화면 알림 한 건. readAt이 null이면 아직 읽지 않음 */
public record NotificationResponse(UUID id, String type, UUID projectId, String projectName, UUID actorId,
        String actorName, Long createdAt, Long readAt) {
}
