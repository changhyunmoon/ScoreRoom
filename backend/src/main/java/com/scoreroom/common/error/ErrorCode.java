package com.scoreroom.common.error;

import org.springframework.http.HttpStatus;

/** 오류 응답의 code 값. 화면은 code로 오류 종류를 구분하고 message를 그대로 보여준다 */
public enum ErrorCode {
    /** 입력 형식 오류 */
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    /** 업무 규칙 위반 (예: 마지막 룸 운영자 해제) */
    RULE_VIOLATION(HttpStatus.BAD_REQUEST),
    /** 로그인이 필요하거나 세션이 만료됨 */
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
    /** 이메일 또는 비밀번호 불일치 */
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    /** CSRF 토큰이 없거나 맞지 않음. 토큰을 다시 받아 재시도한다 */
    CSRF_INVALID(HttpStatus.FORBIDDEN),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    /** 중복 또는 다른 변경과 충돌 */
    CONFLICT(HttpStatus.CONFLICT),
    /** 마감된 평가룸에 대한 변경 */
    PROJECT_CLOSED(HttpStatus.CONFLICT),
    /** 영향 확인 이후 데이터가 바뀜. 다시 조회해 확인받는다 */
    VERSION_CONFLICT(HttpStatus.CONFLICT),
    PAYLOAD_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
