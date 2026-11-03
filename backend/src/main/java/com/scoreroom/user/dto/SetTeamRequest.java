package com.scoreroom.user.dto;

import java.util.UUID;

/** teamId가 null이면 소속 없음 */
public record SetTeamRequest(UUID teamId) {
}
