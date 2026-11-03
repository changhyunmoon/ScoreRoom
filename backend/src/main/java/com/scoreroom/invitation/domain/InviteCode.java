package com.scoreroom.invitation.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 평가룸별 현재 입장 코드 하나. 재발급하면 같은 행을 새 코드로 바꿔 이전 코드는 바로 무효가 된다 */
@Entity
@Table(name = "invite_codes")
public class InviteCode extends PersistableEntity<UUID> {

    /** 헷갈리는 글자(0, O, 1, I)를 뺀 문자 */
    public static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    public static final int LENGTH = 6;

    @Id
    @Column(name = "project_id")
    private UUID projectId;

    @Column(nullable = false)
    private String code;

    @Column(name = "issued_by", nullable = false)
    private UUID issuedBy;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected InviteCode() {
    }

    public InviteCode(UUID projectId) {
        this.projectId = projectId;
    }

    /** expiresAt이 null이면 중지할 때까지 무기한 */
    public void reissue(String code, UUID issuedBy, Instant now, Instant expiresAt) {
        this.code = code;
        this.issuedBy = issuedBy;
        this.issuedAt = now;
        this.expiresAt = expiresAt;
        this.revokedAt = null;
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(now));
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(Instant now) {
        return expiresAt != null && !expiresAt.isAfter(now);
    }

    public void revoke(Instant now) {
        this.revokedAt = now;
    }

    @Override
    public UUID getId() {
        return projectId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getCode() {
        return code;
    }

    public UUID getIssuedBy() {
        return issuedBy;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
