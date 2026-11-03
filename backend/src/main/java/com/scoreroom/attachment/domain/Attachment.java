package com.scoreroom.attachment.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.TimestampedEntity;

/** 발표 자료 메타데이터. 파일 본문은 FileStorage에 storageKey로 저장한다 */
@Entity
@Table(name = "attachments")
public class Attachment extends TimestampedEntity<UUID> {

    /** 파일 하나당 최대 크기와 발표당 최대 개수 */
    public static final long MAX_BYTES = 50L * 1024 * 1024;
    public static final int MAX_PER_PRESENTATION = 10;

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "presentation_id", nullable = false)
    private UUID presentationId;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttachmentStatus status = AttachmentStatus.STAGING;

    protected Attachment() {
    }

    public Attachment(UUID projectId, UUID presentationId, String storageKey, String originalName, long sizeBytes,
            String contentType, UUID uploadedBy) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.presentationId = presentationId;
        this.storageKey = storageKey;
        this.originalName = originalName;
        this.sizeBytes = sizeBytes;
        this.contentType = contentType;
        this.uploadedBy = uploadedBy;
    }

    public void markReady() {
        this.status = AttachmentStatus.READY;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getPresentationId() {
        return presentationId;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getOriginalName() {
        return originalName;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public String getContentType() {
        return contentType;
    }

    public UUID getUploadedBy() {
        return uploadedBy;
    }

    public AttachmentStatus getStatus() {
        return status;
    }
}
