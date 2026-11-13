package com.scoreroom.user.dto;

import java.util.List;
import java.util.UUID;

/**
 * 룸 관리자 접속 현황: 이 평가룸 참여자만, 로그인 여부와 마지막 활동. 시각은 epoch milliseconds.
 * online: 만료되지 않은 로그인이 있음, active: 마지막 활동이 1분 이내
 */
public record RoomOnlineResponse(long serverTime, List<Member> members) {

    public record Member(
            UUID userId,
            String name,
            String teamName,
            String position,
            boolean roomAdmin,
            boolean online,
            boolean active,
            Long lastAccessAt) {
    }
}
