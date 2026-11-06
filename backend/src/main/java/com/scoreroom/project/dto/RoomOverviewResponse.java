package com.scoreroom.project.dto;

import java.util.UUID;

/** 시스템 관리자 화면의 평가룸 한 줄 */
public record RoomOverviewResponse(
        UUID id,
        String name,
        String description,
        String status,
        long createdAt,
        String creatorName,
        String adminNames,
        int memberCount,
        int presentationCount,
        int ratingCount) {
}
