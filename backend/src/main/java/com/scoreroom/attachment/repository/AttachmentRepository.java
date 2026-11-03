package com.scoreroom.attachment.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.attachment.domain.Attachment;
import com.scoreroom.attachment.domain.AttachmentStatus;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {

    Optional<Attachment> findByIdAndProjectIdAndPresentationId(UUID id, UUID projectId, UUID presentationId);

    List<Attachment> findByPresentationId(UUID presentationId);

    List<Attachment> findByPresentationIdInAndStatusOrderByCreatedAtAsc(Collection<UUID> presentationIds,
            AttachmentStatus status);

    long countByPresentationIdAndStatusIn(UUID presentationId, Collection<AttachmentStatus> statuses);

    List<Attachment> findByStatusAndCreatedAtBefore(AttachmentStatus status, Instant before);

    @Modifying(flushAutomatically = true)
    @Query("delete from Attachment a where a.id = :id")
    int deleteByIdNow(UUID id);
}
