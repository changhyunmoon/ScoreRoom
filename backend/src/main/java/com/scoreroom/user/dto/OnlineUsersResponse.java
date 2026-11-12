package com.scoreroom.user.dto;

import java.util.List;
import java.util.UUID;

/**
 * 시스템 관리자 접속 현황. 시각은 epoch milliseconds.
 * active: 마지막 활동이 1분 이내 (화면이 열려 있으면 15초마다 서버에 확인 요청을 보낸다)
 */
public record OnlineUsersResponse(long serverTime, List<OnlineUser> users) {

    public record OnlineUser(
            UUID userId,
            String name,
            String loginId,
            String teamName,
            String position,
            boolean sysAdmin,
            int sessionCount,
            long loginAt,
            long lastAccessAt,
            boolean active,
            String ip,
            String userAgent) {
    }
}
