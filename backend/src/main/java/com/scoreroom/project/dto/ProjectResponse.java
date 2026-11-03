package com.scoreroom.project.dto;

import java.util.UUID;

import com.scoreroom.common.web.Times;
import com.scoreroom.invitation.dto.InviteCodeResponse;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.domain.ProjectStatus;

/**
 * 화면의 Project 타입. 입장 코드(invite)는 룸 운영자에게만 채운다.
 * version: 위험한 변경을 확인받을 때 함께 보내는 값
 */
public record ProjectResponse(
        UUID id,
        String name,
        String description,
        UUID createdBy,
        Long createdAt,
        ProjectStatus status,
        Long closedAt,
        ProjectSettings settings,
        InviteCodeResponse invite,
        long version) {

    public static ProjectResponse of(Project p, InviteCodeResponse invite) {
        return new ProjectResponse(p.getId(), p.getName(), p.getDescription(), p.getCreatedBy(),
                Times.toMillis(p.getCreatedAt()), p.getStatus(), Times.toMillis(p.getClosedAt()), p.settings(), invite,
                p.getVersion());
    }
}
