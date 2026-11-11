package com.scoreroom.notification.dto;

import java.util.UUID;

/**
 * 화면 알림 한 건. readAt이 null이면 아직 읽지 않음.
 * presentationId / presentationTitle: 평가 요청 알림이 가리키는 발표 (그 밖의 알림이거나 발표가 지워졌으면 null)
 */
public record NotificationResponse(UUID id, String type, UUID projectId, String projectName, UUID actorId,
        String actorName, Long createdAt, Long readAt, UUID presentationId, String presentationTitle) {
}
