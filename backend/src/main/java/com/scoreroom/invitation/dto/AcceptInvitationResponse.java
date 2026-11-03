package com.scoreroom.invitation.dto;

import java.util.UUID;

/** 초대를 수락해 참여한 평가룸 */
public record AcceptInvitationResponse(UUID projectId) {
}
