package com.scoreroom.invitation.service;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.invitation.domain.Invitation;
import com.scoreroom.invitation.domain.InvitationStatus;
import com.scoreroom.invitation.repository.InvitationRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.service.UserAccessService;

/** 룸 운영자가 사람을 골라 초대하고, 받은 사람이 알림에서 참여하거나 거절한다 */
@Service
public class InvitationService {

    private final InvitationRepository invitations;
    private final ProjectRepository projects;
    private final MembershipRepository memberships;
    private final MembershipService membershipService;
    private final UserAccessService userAccess;
    private final RoomGuard roomGuard;
    private final Clock clock;

    public InvitationService(InvitationRepository invitations, ProjectRepository projects,
            MembershipRepository memberships, MembershipService membershipService, UserAccessService userAccess,
            RoomGuard roomGuard, Clock clock) {
        this.invitations = invitations;
        this.projects = projects;
        this.memberships = memberships;
        this.membershipService = membershipService;
        this.userAccess = userAccess;
        this.roomGuard = roomGuard;
        this.clock = clock;
    }

    /** 이미 참여 중이거나 초대를 기다리는 사람은 건너뛴다. 새로 초대한 인원을 돌려준다 */
    @Transactional
    public int invite(UUID actorId, UUID projectId, List<UUID> userIds) {
        roomGuard.lockAsAdmin(projectId, actorId);
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        if (ids.isEmpty()) {
            throw ApiException.badRequest("초대할 사람을 선택해 주세요.");
        }
        Instant now = clock.instant();
        int invited = 0;
        for (UUID userId : ids) {
            User user = userAccess.requireOther(userId);
            if (user.isSysAdmin()) {
                throw ApiException.badRequest("시스템 관리자는 초대할 수 없습니다.");
            }
            if (!user.isEnabled() || memberships.existsByProjectIdAndUserId(projectId, userId)
                    || invitations.existsByProjectIdAndInviteeIdAndStatus(projectId, userId, InvitationStatus.PENDING)) {
                continue;
            }
            invitations.save(new Invitation(projectId, actorId, userId, now));
            invited++;
        }
        return invited;
    }

    /** 초대 취소 (룸 운영자) */
    @Transactional
    public void cancel(UUID actorId, UUID invitationId) {
        UUID projectId = projectOf(invitationId);
        roomGuard.lockAsAdmin(projectId, actorId);
        requirePending(invitationId).respond(InvitationStatus.CANCELED, clock.instant());
    }

    /** 초대 수락: 평가룸에 참여하고 그 평가룸 ID를 돌려준다 */
    @Transactional
    public UUID accept(UUID actorId, UUID invitationId) {
        UUID projectId = projectOf(invitationId);
        Project project = projects.findByIdForUpdate(projectId)
                .orElseThrow(() -> ApiException.notFound("평가룸을 찾을 수 없습니다."));
        Invitation invitation = requirePending(invitationId);
        if (!invitation.getInviteeId().equals(actorId)) {
            throw ApiException.forbidden("내가 받은 초대가 아닙니다.");
        }
        if (!project.isOpen()) {
            throw new ApiException(ErrorCode.PROJECT_CLOSED, "마감된 평가룸입니다.");
        }
        project.bumpVersion();
        membershipService.join(project, userAccess.require(actorId), false);
        acceptPending(projectId, actorId);
        return projectId;
    }

    @Transactional
    public void decline(UUID actorId, UUID invitationId) {
        Invitation invitation = requirePending(invitationId);
        if (!invitation.getInviteeId().equals(actorId)) {
            throw ApiException.forbidden("내가 받은 초대가 아닙니다.");
        }
        invitation.respond(InvitationStatus.DECLINED, clock.instant());
    }

    /** 다른 경로(입장 코드)로 참여했을 때도 그 평가룸의 대기 중인 초대를 수락 처리한다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void acceptPending(UUID projectId, UUID userId) {
        Instant now = clock.instant();
        invitations.findByProjectIdAndInviteeIdAndStatus(projectId, userId, InvitationStatus.PENDING)
                .forEach(i -> i.respond(InvitationStatus.ACCEPTED, now));
    }

    private UUID projectOf(UUID invitationId) {
        return invitations.findProjectIdById(invitationId).orElseThrow(InvitationService::alreadyHandled);
    }

    private Invitation requirePending(UUID invitationId) {
        return invitations.findById(invitationId)
                .filter(i -> i.getStatus() == InvitationStatus.PENDING)
                .orElseThrow(InvitationService::alreadyHandled);
    }

    private static ApiException alreadyHandled() {
        return ApiException.notFound("초대를 찾을 수 없습니다. 이미 처리됐을 수 있어요.");
    }
}
