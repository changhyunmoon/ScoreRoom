package com.scoreroom.audit.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 관리 작업 기록. 점수·피드백 원문이나 비밀번호는 남기지 않고 작업 종류와 영향 건수만 남긴다 */
@Entity
@Table(name = "audit_events")
public class AuditEvent extends PersistableEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(nullable = false)
    private String action;

    @Column(name = "affected_count", nullable = false)
    private int affectedCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuditEvent() {
    }

    public AuditEvent(UUID actorId, UUID projectId, String action, int affectedCount, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.actorId = actorId;
        this.projectId = projectId;
        this.action = action;
        this.affectedCount = affectedCount;
        this.createdAt = createdAt;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getActorId() {
        return actorId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getAction() {
        return action;
    }

    public int getAffectedCount() {
        return affectedCount;
    }
}
