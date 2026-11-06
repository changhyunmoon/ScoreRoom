package com.scoreroom.presentation.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.notification.service.NotificationService;
import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.service.RoomGuard;

/** 룸 관리자가 발표를 아직 등록하지 않은 참여자에게 '발표 등록 요청' 알림을 보낸다 */
@Service
public class PresentationRequestService {

    private final RoomGuard roomGuard;
    private final MembershipRepository memberships;
    private final PresentationMemberRepository presentationMembers;
    private final NotificationService notifications;
    private final AuditService audit;

    public PresentationRequestService(RoomGuard roomGuard, MembershipRepository memberships,
            PresentationMemberRepository presentationMembers, NotificationService notifications, AuditService audit) {
        this.roomGuard = roomGuard;
        this.memberships = memberships;
        this.presentationMembers = presentationMembers;
        this.notifications = notifications;
        this.audit = audit;
    }

    /**
     * 고른 사람 중 이 평가룸 참여자이면서 아직 발표를 등록하지 않은 사람에게만 보낸다 (그 사이 등록했거나 나간 사람은 건너뜀).
     * 실제로 보낸 인원을 돌려준다.
     */
    @Transactional
    public int request(UUID actorId, UUID projectId, List<UUID> userIds) {
        roomGuard.lockAsAdmin(projectId, actorId);
        Set<UUID> ids = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        if (ids.isEmpty()) {
            throw ApiException.badRequest("요청을 보낼 사람을 선택해 주세요.");
        }
        // 룸 관리자는 발표하지 않으므로 요청 대상이 아니다
        Set<UUID> roomMembers = memberships.findByProjectId(projectId).stream()
                .filter(m -> !m.isAdmin())
                .map(Membership::getUserId).collect(Collectors.toSet());
        Set<UUID> registered = presentationMembers.findByProjectId(projectId).stream()
                .map(PresentationMember::getUserId).collect(Collectors.toSet());
        int sent = 0;
        for (UUID userId : ids) {
            if (!roomMembers.contains(userId) || registered.contains(userId) || userId.equals(actorId)) {
                continue;
            }
            notifications.presentationRequested(userId, projectId, actorId);
            sent++;
        }
        if (sent > 0) {
            audit.record(actorId, projectId, "PRESENTATION_REQUESTED", sent);
        }
        return sent;
    }
}
