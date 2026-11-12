package com.scoreroom.log.dto;

import java.util.UUID;

/** 로그 한 줄. 목록에서는 detail 앞부분만 담고 detailTruncated로 알린다 */
public record LogEntryResponse(
        UUID id,
        long createdAt,
        String category,
        String level,
        String action,
        String message,
        UUID actorId,
        String actorName,
        UUID projectId,
        String projectName,
        String requestId,
        String httpMethod,
        String path,
        Integer status,
        String ip,
        String userAgent,
        String errorType,
        String detail,
        boolean detailTruncated) {
}
