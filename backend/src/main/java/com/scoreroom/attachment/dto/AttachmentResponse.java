package com.scoreroom.attachment.dto;

import java.util.UUID;

import com.scoreroom.attachment.domain.Attachment;
import com.scoreroom.common.web.Times;

/** 화면의 Attachment 타입 */
public record AttachmentResponse(UUID id, String name, long size, String contentType, Long uploadedAt, UUID uploadedBy) {

    public static AttachmentResponse from(Attachment a) {
        return new AttachmentResponse(a.getId(), a.getOriginalName(), a.getSizeBytes(), a.getContentType(),
                Times.toMillis(a.getCreatedAt()), a.getUploadedBy());
    }
}
