package com.scoreroom.project.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.scoreroom.common.web.Times;
import com.scoreroom.project.domain.Membership;

/** 화면의 Membership 타입. teamIdAtJoin은 참여 당시 회사 팀 */
public record MembershipResponse(UUID projectId, UUID userId, UUID teamIdAtJoin, String teamNameAtJoin,
        @JsonProperty("isAdmin") boolean isAdmin, Long joinedAt) {

    public static MembershipResponse from(Membership m) {
        return new MembershipResponse(m.getProjectId(), m.getUserId(), m.getTeamIdAtJoin(), m.getTeamNameAtJoin(),
                m.isAdmin(), Times.toMillis(m.getJoinedAt()));
    }
}
