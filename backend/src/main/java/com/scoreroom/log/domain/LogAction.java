package com.scoreroom.log.domain;

import static com.scoreroom.log.domain.LogCategory.*;
import static com.scoreroom.log.domain.LogLevel.*;

import com.scoreroom.common.error.ErrorCode;

/** 로그 항목. 카테고리·화면 이름·등급을 여기 한 곳에서 정하고 화면도 이 목록을 받아 쓴다. 순서가 화면의 칩 순서다 */
public enum LogAction {
    RATING_SUBMITTED(RATING, "점수 제출"),
    RATING_UPDATED(RATING, "점수 수정"),
    RATING_REQUESTED(RATING, "평가 요청 알림"),
    RATINGS_DELETED(RATING, "평가 삭제", WARN),

    PRESENTATION_CREATED(PRESENTATION, "발표 등록"),
    PRESENTATION_UPDATED(PRESENTATION, "발표 수정"),
    PRESENTATION_DELETED(PRESENTATION, "발표 삭제"),
    PRESENTATION_REORDERED(PRESENTATION, "순서 변경"),
    ATTACHMENT_UPLOADED(PRESENTATION, "자료 업로드"),
    ATTACHMENT_DELETED(PRESENTATION, "자료 삭제"),
    PRESENTATION_REQUESTED(PRESENTATION, "발표 등록 요청"),

    PROJECT_CREATED(PROJECT, "평가룸 생성"),
    PROJECT_INFO_CHANGED(PROJECT, "정보 수정"),
    SETTINGS_CHANGED(PROJECT, "설정 변경"),
    INVITE_CODE_ISSUED(PROJECT, "입장 코드 발급"),
    INVITE_CODE_REVOKED(PROJECT, "입장 코드 중지"),
    PROJECT_CLOSED(PROJECT, "마감"),
    PROJECT_DELETED(PROJECT, "평가룸 삭제", WARN),

    MEMBER_JOINED(MEMBER, "참여(입장 코드)"),
    MEMBERS_ADDED(MEMBER, "참여자 추가"),
    MEMBER_REMOVED(MEMBER, "참여자 제거"),
    ROOM_ADMIN_GRANTED(MEMBER, "관리자 지정"),
    ROOM_ADMIN_REVOKED(MEMBER, "관리자 해제"),

    TEAM_CREATED(SYSTEM, "팀 생성"),
    TEAM_UPDATED(SYSTEM, "팀 수정"),
    TEAM_DELETED(SYSTEM, "팀 삭제"),
    USER_CREATED(SYSTEM, "사용자 추가"),
    USER_TEAM_CHANGED(SYSTEM, "팀 변경"),
    USER_POSITION_CHANGED(SYSTEM, "직급 변경"),
    VIEW_ALL_GRANTED(SYSTEM, "열람 권한 부여"),
    VIEW_ALL_REVOKED(SYSTEM, "열람 권한 회수"),
    CREATE_ROOM_GRANTED(SYSTEM, "생성 권한 부여"),
    CREATE_ROOM_REVOKED(SYSTEM, "생성 권한 회수"),
    USER_PASSWORD_RESET(SYSTEM, "비밀번호 초기화"),

    LOGIN_SUCCESS(AUTH, "로그인 성공"),
    LOGIN_FAILED(AUTH, "로그인 실패", WARN),
    LOGIN_RATE_LIMITED(AUTH, "횟수 제한", WARN),
    LOGOUT(AUTH, "로그아웃"),
    SIGNUP(AUTH, "회원가입"),
    PASSWORD_RESET_SELF(AUTH, "비밀번호 찾기"),
    PASSWORD_CHANGED(AUTH, "비밀번호 변경"),

    REJECTED_INVALID(REJECTED, "입력·규칙 오류", WARN),
    REJECTED_UNAUTHENTICATED(REJECTED, "로그인 필요", WARN),
    REJECTED_FORBIDDEN(REJECTED, "권한 없음", WARN),
    REJECTED_NOT_FOUND(REJECTED, "찾을 수 없음", WARN),
    REJECTED_CONFLICT(REJECTED, "충돌·마감", WARN),
    REJECTED_TOO_MANY(REJECTED, "요청 과다", WARN),
    REJECTED_OTHER(REJECTED, "기타 거절", WARN),

    SERVER_ERROR(LogCategory.SERVER_ERROR, "처리 못한 오류", ERROR),
    DATA_CONFLICT(LogCategory.SERVER_ERROR, "DB 제약 위반", WARN),

    CLIENT_ERROR(LogCategory.CLIENT_ERROR, "화면 오류", ERROR);

    private final LogCategory category;
    private final String label;
    private final LogLevel level;

    LogAction(LogCategory category, String label) {
        this(category, label, INFO);
    }

    LogAction(LogCategory category, String label, LogLevel level) {
        this.category = category;
        this.label = label;
        this.level = level;
    }

    public LogCategory category() {
        return category;
    }

    public String label() {
        return label;
    }

    public LogLevel level() {
        return level;
    }

    /** 오류 응답 코드 → 거절 항목 */
    public static LogAction rejectedBy(ErrorCode code) {
        return switch (code) {
            case VALIDATION_FAILED, RULE_VIOLATION, PAYLOAD_TOO_LARGE, METHOD_NOT_ALLOWED -> REJECTED_INVALID;
            case UNAUTHENTICATED, INVALID_CREDENTIALS -> REJECTED_UNAUTHENTICATED;
            case FORBIDDEN, CSRF_INVALID -> REJECTED_FORBIDDEN;
            case NOT_FOUND -> REJECTED_NOT_FOUND;
            case CONFLICT, PROJECT_CLOSED, VERSION_CONFLICT -> REJECTED_CONFLICT;
            case TOO_MANY_REQUESTS -> REJECTED_TOO_MANY;
            default -> REJECTED_OTHER;
        };
    }
}
