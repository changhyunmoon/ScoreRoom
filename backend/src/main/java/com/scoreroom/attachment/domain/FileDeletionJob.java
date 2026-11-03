package com.scoreroom.attachment.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/**
 * 메타데이터를 지운 뒤 실제 파일을 지우는 작업. 원본 행이 지워진 뒤에도 남아야 하므로 FK가 없다.
 * DB 롤백이 파일 삭제를 되돌리지 못하므로, 원본 삭제와 같은 트랜잭션에 기록하고 커밋 후 처리한다.
 */
@Entity
@Table(name = "file_deletion_jobs")
public class FileDeletionJob extends PersistableEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "last_error_code")
    private String lastErrorCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FileDeletionJob() {
    }

    public FileDeletionJob(String storageKey, Instant now) {
        this.id = UUID.randomUUID();
        this.storageKey = storageKey;
        this.nextAttemptAt = now;
        this.createdAt = now;
    }

    /** 실패하면 1, 2, 4 ... 최대 60분 뒤 다시 시도한다 */
    public void recordFailure(String errorCode, Instant now) {
        this.attemptCount++;
        this.lastErrorCode = errorCode.length() > 100 ? errorCode.substring(0, 100) : errorCode;
        long minutes = Math.min(60, 1L << Math.min(attemptCount - 1, 6));
        this.nextAttemptAt = now.plus(Duration.ofMinutes(minutes));
    }

    @Override
    public UUID getId() {
        return id;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public int getAttemptCount() {
        return attemptCount;
    }
}
