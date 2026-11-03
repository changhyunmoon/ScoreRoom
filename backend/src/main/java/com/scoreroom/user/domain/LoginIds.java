package com.scoreroom.user.domain;

import java.util.Locale;
import java.util.regex.Pattern;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;

/** 로그인 ID(이메일)는 앞뒤 공백을 지우고 소문자로 저장·비교한다 */
public final class LoginIds {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private LoginIds() {
    }

    public static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }

    /** 정규화한 뒤 이메일 형식을 확인한다 */
    public static String normalizeValid(String raw) {
        String value = normalize(raw);
        if (!EMAIL.matcher(value).matches() || value.length() > 254) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "이메일 주소 형식이 올바르지 않습니다.");
        }
        return value;
    }
}
