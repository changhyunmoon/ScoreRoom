package com.scoreroom.log.dto;

import java.util.Map;

/**
 * byCategory·byAction: 고른 기간·평가룸 기준 건수 (카테고리 버튼·항목 칩).
 * last24hByCategory·last24hByAction: 최근 24시간 건수 (요약 카드).
 */
public record LogSummaryResponse(
        Map<String, Long> byCategory,
        Map<String, Long> byAction,
        Map<String, Long> last24hByCategory,
        Map<String, Long> last24hByAction,
        Long lastServerErrorAt) {
}
