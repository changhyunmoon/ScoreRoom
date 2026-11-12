package com.scoreroom.log.dto;

import java.util.List;

/** nextCursor가 null이면 마지막 페이지 */
public record LogPageResponse(List<LogEntryResponse> items, String nextCursor) {
}
