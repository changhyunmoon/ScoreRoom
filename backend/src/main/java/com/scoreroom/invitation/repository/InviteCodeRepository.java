package com.scoreroom.invitation.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.invitation.domain.InviteCode;

public interface InviteCodeRepository extends JpaRepository<InviteCode, UUID> {

    Optional<InviteCode> findByCode(String code);

    boolean existsByCode(String code);

    List<InviteCode> findByProjectIdIn(Collection<UUID> projectIds);

    @Modifying(flushAutomatically = true)
    @Query("update InviteCode c set c.revokedAt = :now where c.projectId = :projectId and c.revokedAt is null")
    int revokeFor(UUID projectId, Instant now);
}
