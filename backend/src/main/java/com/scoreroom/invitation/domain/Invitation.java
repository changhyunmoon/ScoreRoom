package com.scoreroom.invitation.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 룸 운영자가 사용자에게 보낸 평가룸 초대. 받은 사람은 알림에서 참여하거나 거절한다 */
@Entity
@Table(name = "invitations")
public class Invitation extends PersistableEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "inviter_id", nullable = false)
    private UUID inviterId;

    @Column(name = "invitee_id", nullable = false)
    private UUID inviteeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvitationStatus status = InvitationStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    protected Invitation() {
    }

    public Invitation(UUID projectId, UUID inviterId, UUID inviteeId, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.inviterId = inviterId;
        this.inviteeId = inviteeId;
        this.createdAt = createdAt;
    }

    public void respond(InvitationStatus status, Instant now) {
        this.status = status;
        this.respondedAt = now;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getInviterId() {
        return inviterId;
    }

    public UUID getInviteeId() {
        return inviteeId;
    }

    public InvitationStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
