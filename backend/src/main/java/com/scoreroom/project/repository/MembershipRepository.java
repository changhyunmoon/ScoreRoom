package com.scoreroom.project.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.MembershipId;

public interface MembershipRepository extends JpaRepository<Membership, MembershipId> {

    Optional<Membership> findByProjectIdAndUserId(UUID projectId, UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    List<Membership> findByProjectId(UUID projectId);

    List<Membership> findByUserId(UUID userId);

    List<Membership> findByProjectIdIn(Collection<UUID> projectIds);

    long countByProjectIdAndAdminTrue(UUID projectId);

    @Modifying(flushAutomatically = true)
    @Query("delete from Membership m where m.projectId = :projectId and m.userId = :userId")
    int deleteMember(UUID projectId, UUID userId);
}
