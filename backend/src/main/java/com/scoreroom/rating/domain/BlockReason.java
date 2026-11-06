package com.scoreroom.rating.domain;

/** 평가할 수 없는 이유 */
public enum BlockReason {
    SELF("본인은 평가할 수 없습니다."),
    SAME_CREW("같은 발표의 팀원은 평가할 수 없습니다."),
    SAME_TEAM("같은 회사 팀이라 평가할 수 없습니다."),
    ADMIN("룸 관리자는 평가하지 않는 평가룸입니다.");

    private final String message;

    BlockReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
