package com.scoreroom.project.dto;

import java.util.List;
import java.util.UUID;

/** 룸 운영자가 조직도에서 고른 사람들 */
public record AddMembersRequest(List<UUID> userIds) {
}
