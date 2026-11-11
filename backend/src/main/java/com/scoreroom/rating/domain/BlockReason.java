package com.scoreroom.rating.domain;

/** 평가할 수 없는 이유 */
public enum BlockReason {
    SELF("본인 발표는 평가할 수 없습니다."),
    SAME_TEAM("같은 회사 팀의 발표라 평가할 수 없습니다."),
    ADMIN("룸 관리자는 평가하지 않는 평가룸입니다.");

    private final String message;

    BlockReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
