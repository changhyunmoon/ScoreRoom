package com.scoreroom.presentation.domain;

import java.io.Serializable;
import java.util.UUID;

public record PresentationMemberId(UUID presentationId, UUID userId) implements Serializable {
}
