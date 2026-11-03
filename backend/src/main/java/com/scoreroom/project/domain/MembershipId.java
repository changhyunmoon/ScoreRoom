package com.scoreroom.project.domain;

import java.io.Serializable;
import java.util.UUID;

public record MembershipId(UUID projectId, UUID userId) implements Serializable {
}
