package com.scoreroom.notification.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 사용자 한 명에게 보여 줄 알림. 수락·거절 같은 응답 없이 읽음 여부만 남긴다 */
@Entity
@Table(name = "notifications")
public class Notification extends PersistableEntity<UUID> {

    /** 룸 관리자가 평가룸에 바로 추가함 */
    public static final String ROOM_INVITED = "ROOM_INVITED";
    /** 룸 관리자가 발표를 등록해 달라고 요청함 */
    public static final String PRESENTATION_REQUESTED = "PRESENTATION_REQUESTED";
    /** 룸 관리자가 아직 평가하지 않은 발표를 평가해 달라고 요청함 */
    public static final String RATING_REQUESTED = "RATING_REQUESTED";

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String type;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    /** 평가 요청 알림이 가리키는 발표 (그 밖의 알림은 null, 발표가 지워지면 null) */
    @Column(name = "presentation_id")
    private UUID presentationId;

    protected Notification() {
    }

    /** 룸 관리자가 이 발표를 평가해 달라고 요청함 */
    public static Notification ratingRequested(UUID userId, UUID projectId, UUID presentationId, UUID actorId, Instant now) {
        Notification n = of(RATING_REQUESTED, userId, projectId, actorId, now);
        n.presentationId = presentationId;
        return n;
    }

    public static Notification roomInvited(UUID userId, UUID projectId, UUID actorId, Instant now) {
        return of(ROOM_INVITED, userId, projectId, actorId, now);
    }

    public static Notification presentationRequested(UUID userId, UUID projectId, UUID actorId, Instant now) {
        return of(PRESENTATION_REQUESTED, userId, projectId, actorId, now);
    }

    private static Notification of(String type, UUID userId, UUID projectId, UUID actorId, Instant now) {
        Notification n = new Notification();
        n.id = UUID.randomUUID();
        n.userId = userId;
        n.type = type;
        n.projectId = projectId;
        n.actorId = actorId;
        n.createdAt = now;
        return n;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getType() {
        return type;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getActorId() {
        return actorId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public UUID getPresentationId() {
        return presentationId;
    }
}
