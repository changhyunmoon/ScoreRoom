package com.scoreroom.common.web;

import java.time.Instant;

/** API의 시각은 epoch milliseconds로 주고받는다 (화면의 Date 계산과 호환) */
public final class Times {

    private Times() {
    }

    public static Long toMillis(Instant instant) {
        return instant == null ? null : instant.toEpochMilli();
    }
}
