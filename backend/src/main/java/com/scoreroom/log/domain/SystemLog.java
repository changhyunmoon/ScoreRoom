package com.scoreroom.log.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 로그 한 줄. 평가룸·사용자가 지워져도 남도록 이름을 그때 값으로 함께 저장한다 */
@Entity
@Table(name = "system_logs")
public class SystemLog extends PersistableEntity<UUID> {

    public static final int MESSAGE_MAX = 500;
    public static final int DETAIL_MAX = 100_000;

    @Id
    private UUID id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogLevel level;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String message;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "project_name")
    private String projectName;

    @Column(name = "request_id")
    private String requestId;

    @Column(name = "http_method")
    private String httpMethod;

    private String path;

    private Integer status;

    private String ip;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "error_type")
    private String errorType;

    private String detail;

    protected SystemLog() {
    }

    public SystemLog(LogAction action, String message, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.createdAt = createdAt;
        this.category = action.category();
        this.level = action.level();
        this.action = action.name();
        this.message = cut(message, MESSAGE_MAX);
    }

    public SystemLog actor(UUID id, String name) {
        this.actorId = id;
        this.actorName = cut(name, 100);
        return this;
    }

    public SystemLog project(UUID id, String name) {
        this.projectId = id;
        this.projectName = cut(name, 200);
        return this;
    }

    public SystemLog request(String requestId, String method, String path, String ip, String userAgent) {
        this.requestId = cut(requestId, 16);
        this.httpMethod = cut(method, 10);
        this.path = cut(path, 300);
        this.ip = cut(ip, 64);
        this.userAgent = cut(userAgent, 300);
        return this;
    }

    public SystemLog status(Integer status) {
        this.status = status;
        return this;
    }

    public SystemLog error(String errorType) {
        this.errorType = cut(errorType, 200);
        return this;
    }

    public SystemLog detail(String detail) {
        this.detail = cut(detail, DETAIL_MAX);
        return this;
    }

    public UUID getActorId() {
        return actorId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public static String cut(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
