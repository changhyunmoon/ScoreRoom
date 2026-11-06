package com.scoreroom.user.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.scoreroom.user.domain.User;

/**
 * 화면의 User 타입. rank는 팀 안 순서(작을수록 위)다.
 * 이메일·전화번호는 본인과 시스템 관리자에게만 채워서 보낸다 (그 외에는 빈 문자열).
 */
public record UserResponse(
        UUID id,
        String loginId,
        String name,
        String phone,
        UUID teamId,
        @JsonProperty("isSysAdmin") boolean isSysAdmin,
        String position,
        int rank,
        boolean canViewAll,
        boolean canCreateRoom) {

    public static UserResponse of(User user, boolean includeContact) {
        return new UserResponse(user.getId(), includeContact ? user.getLoginId() : "", user.getName(),
                includeContact ? user.getPhone() : "", user.getTeamId(), user.isSysAdmin(), user.getPosition(),
                user.getSortOrder(), user.canViewAll(), user.canCreateRoom());
    }
}
