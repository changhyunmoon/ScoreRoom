package com.scoreroom.presentation.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.domain.PresentationMemberId;

public interface PresentationMemberRepository extends JpaRepository<PresentationMember, PresentationMemberId> {

    List<PresentationMember> findByPresentationId(UUID presentationId);

    List<PresentationMember> findByProjectId(UUID projectId);

    List<PresentationMember> findByProjectIdIn(Collection<UUID> projectIds);

    /** 이 사람이 구성원인 발표들 */
    List<PresentationMember> findByProjectIdAndUserId(UUID projectId, UUID userId);

    @Modifying(flushAutomatically = true)
    @Query("delete from PresentationMember m where m.presentationId = :presentationId")
    int deleteAllOf(UUID presentationId);

    @Modifying(flushAutomatically = true)
    @Query("delete from PresentationMember m where m.presentationId = :presentationId and m.userId = :userId")
    int deleteOne(UUID presentationId, UUID userId);
}
