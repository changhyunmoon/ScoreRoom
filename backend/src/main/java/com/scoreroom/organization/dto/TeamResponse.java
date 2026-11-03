package com.scoreroom.organization.dto;

import java.util.UUID;

import com.scoreroom.organization.domain.Team;

public record TeamResponse(UUID id, String name, UUID parentId) {

    public static TeamResponse from(Team team) {
        return new TeamResponse(team.getId(), team.getName(), team.getParentId());
    }
}
