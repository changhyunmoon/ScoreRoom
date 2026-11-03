package com.scoreroom.common.error;

import java.util.List;

/** 모든 오류 응답의 모양 */
public record ApiError(String code, String message, List<FieldError> fieldErrors, String requestId) {

    public record FieldError(String field, String message) {
    }
}
