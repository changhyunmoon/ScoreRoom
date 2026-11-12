package com.scoreroom.log.domain;

/** 로그 화면의 카테고리. 순서가 화면의 버튼 순서다 */
public enum LogCategory {
    RATING("평가"),
    PRESENTATION("발표"),
    PROJECT("평가룸"),
    MEMBER("참여자"),
    SYSTEM("시스템 관리"),
    AUTH("로그인"),
    REJECTED("요청 거절"),
    SERVER_ERROR("서버 오류"),
    CLIENT_ERROR("화면 오류");

    private final String label;

    LogCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
