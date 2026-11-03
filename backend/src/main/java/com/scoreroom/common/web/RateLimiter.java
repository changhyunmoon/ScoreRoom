package com.scoreroom.common.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;

/**
 * 로그인·가입·입장 코드처럼 추측 공격을 받을 수 있는 요청의 횟수 제한.
 * 서버 한 대 기준의 메모리 고정 창 방식이다. 서버를 여러 대로 늘리면 공유 저장소로 바꾼다.
 */
@Component
public class RateLimiter {

    private record Window(Instant start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** key의 요청이 window 동안 limit번을 넘으면 429를 던진다 */
    public void check(String key, int limit, Duration window) {
        Instant now = clock.instant();
        Window current = windows.compute(key, (k, w) -> w == null || w.start().plus(window).isBefore(now)
                ? new Window(now, 1)
                : new Window(w.start(), w.count() + 1));
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> e.getValue().start().plus(window).isBefore(now));
        }
        if (current.count() > limit) {
            throw new ApiException(ErrorCode.TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
    }
}
