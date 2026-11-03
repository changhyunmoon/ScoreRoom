package com.scoreroom.attachment.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.attachment.domain.FileDeletionJob;

public interface FileDeletionJobRepository extends JpaRepository<FileDeletionJob, UUID> {

    List<FileDeletionJob> findTop50ByNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(Instant now);

    @Modifying
    @Query("delete from FileDeletionJob j where j.id = :id")
    int deleteByIdNow(UUID id);
}
