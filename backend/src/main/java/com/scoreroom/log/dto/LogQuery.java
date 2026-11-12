package com.scoreroom.log.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 로그 목록 조건. 비어 있는 조건은 쓰지 않는다 */
public record LogQuery(
        List<String> categories,
        List<String> actions,
        List<String> levels,
        UUID projectId,
        Instant from,
        Instant to,
        String q) {
}
