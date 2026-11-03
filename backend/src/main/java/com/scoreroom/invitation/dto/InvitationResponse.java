package com.scoreroom.invitation.dto;

import java.util.UUID;

/** 화면의 Invitation 타입 (대기 중인 초대) */
public record InvitationResponse(UUID id, UUID projectId, String projectName, UUID inviterId, String inviterName,
        UUID inviteeId, Long createdAt) {
}
