package com.scoreroom.invitation.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.invitation.domain.Invitation;
import com.scoreroom.invitation.domain.InvitationStatus;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {

    /** 평가룸을 먼저 잠그기 위해 초대 행을 읽지 않고 평가룸 ID만 찾는다 */
    @Query("select i.projectId from Invitation i where i.id = :id")
    Optional<UUID> findProjectIdById(UUID id);

    boolean existsByProjectIdAndInviteeIdAndStatus(UUID projectId, UUID inviteeId, InvitationStatus status);

    List<Invitation> findByProjectIdAndInviteeIdAndStatus(UUID projectId, UUID inviteeId, InvitationStatus status);

    /** 화면 알림용: 내가 받은 것 + 내가 운영하는 평가룸에서 보낸 것 */
    @Query("select i from Invitation i where i.status = com.scoreroom.invitation.domain.InvitationStatus.PENDING "
            + "and (i.inviteeId = :userId or i.projectId in :adminProjectIds) order by i.createdAt desc")
    List<Invitation> findPendingVisibleTo(UUID userId, Collection<UUID> adminProjectIds);

    @Modifying(flushAutomatically = true)
    @Query("update Invitation i set i.status = com.scoreroom.invitation.domain.InvitationStatus.CANCELED, "
            + "i.respondedAt = :now where i.projectId = :projectId "
            + "and i.status = com.scoreroom.invitation.domain.InvitationStatus.PENDING")
    int cancelPending(UUID projectId, Instant now);
}
