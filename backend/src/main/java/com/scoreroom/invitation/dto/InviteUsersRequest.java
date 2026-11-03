package com.scoreroom.invitation.dto;

import java.util.List;
import java.util.UUID;

public record InviteUsersRequest(List<UUID> userIds) {
}
