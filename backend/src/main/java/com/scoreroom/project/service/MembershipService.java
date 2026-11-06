package com.scoreroom.project.service;

import java.time.Clock;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.notification.service.NotificationService;
import com.scoreroom.organization.repository.TeamRepository;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.presentation.service.PresentationRemover;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.service.UserAccessService;

/** 평가룸 참여자: 참여, 사람 지정 추가, 룸 관리자 지정·해제, 제거 */
@Service
public class MembershipService {

    private final MembershipRepository memberships;
    private final TeamRepository teams;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final RatingRepository ratings;
    private final PresentationRemover presentationRemover;
    private final RoomGuard roomGuard;
    private final UserAccessService userAccess;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public MembershipService(MembershipRepository memberships, TeamRepository teams,
            PresentationRepository presentations, PresentationMemberRepository presentationMembers,
            RatingRepository ratings, PresentationRemover presentationRemover, RoomGuard roomGuard,
            UserAccessService userAccess, NotificationService notifications, AuditService audit, Clock clock) {
        this.memberships = memberships;
        this.teams = teams;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.ratings = ratings;
        this.presentationRemover = presentationRemover;
        this.roomGuard = roomGuard;
        this.userAccess = userAccess;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * 평가룸에 참여시킨다. 지금 회사 팀을 참여 당시 소속으로 기록한다. 이미 참여 중이면 그대로 둔다.
     * 호출하는 쪽이 평가룸을 잠근 상태여야 한다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void join(Project project, User user, boolean admin) {
        if (user.isSysAdmin()) {
            throw ApiException.forbidden("시스템 관리자는 평가룸에 참여할 수 없습니다.");
        }
        if (memberships.existsByProjectIdAndUserId(project.getId(), user.getId())) {
            return;
        }
        String teamName = user.getTeamId() == null ? null
                : teams.findById(user.getTeamId()).map(t -> t.getName()).orElse(null);
        memberships.save(new Membership(project.getId(), user.getId(), user.getTeamId(), teamName, admin, clock.instant()));
    }

    /**
     * 룸 관리자가 사람을 골라 바로 참여시킨다 (받는 사람의 수락 절차 없음). 추가된 사람에게는 초대 알림을 남긴다.
     * 이미 참여 중이거나 비활성 계정은 건너뛰고, 새로 추가한 인원을 돌려준다.
     */
    @Transactional
    public int add(UUID actorId, UUID projectId, List<UUID> userIds) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        if (ids.isEmpty()) {
            throw ApiException.badRequest("초대할 사람을 선택해 주세요.");
        }
        int added = 0;
        for (UUID userId : ids) {
            User user = userAccess.requireOther(userId);
            if (user.isSysAdmin()) {
                throw ApiException.badRequest("시스템 관리자는 초대할 수 없습니다.");
            }
            if (!user.isEnabled() || memberships.existsByProjectIdAndUserId(projectId, userId)) {
                continue;
            }
            join(room.project(), user, false);
            notifications.roomInvited(userId, projectId, actorId);
            added++;
        }
        if (added > 0) {
            audit.record(actorId, projectId, "MEMBERS_ADDED", added);
        }
        return added;
    }

    /**
     * 룸 관리자는 최소 1명이어야 한다.
     * 룸 관리자는 발표하지 않으므로, 발표에 등록된 사람을 관리자로 지정하면 그 발표에서 뺀다(받은 평가 삭제).
     * 관리자 평가를 끈 평가룸이면 그 사람이 준 평가도 지운다. 지울 데이터가 있으면 화면이 확인한 version이 지금과 같아야 한다.
     */
    @Transactional
    public void setAdmin(UUID actorId, UUID projectId, UUID userId, boolean admin, Long expectedVersion) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        Membership target = memberships.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> ApiException.notFound("참여자를 찾을 수 없습니다."));
        if (!admin && target.isAdmin() && memberships.countByProjectIdAndAdminTrue(projectId) <= 1) {
            throw ApiException.badRequest("룸 관리자는 최소 1명이어야 합니다.");
        }
        int removedRatings = 0;
        if (admin && !target.isAdmin()) {
            List<PresentationMember> involved = presentationMembers.findByProjectIdAndUserId(projectId, userId);
            boolean dropGiven = !room.project().settings().allowAdminRating();
            List<UUID> doomed = ratings.findByProjectId(projectId).stream()
                    .filter(r -> r.getTargetId().equals(userId) || (dropGiven && r.getRaterId().equals(userId)))
                    .map(r -> r.getId()).toList();
            if (!involved.isEmpty() || !doomed.isEmpty()) {
                room.requireVersion(expectedVersion);
            }
            removedRatings = doomed.isEmpty() ? 0 : ratings.deleteByIds(doomed);
            removedRatings += leavePresentations(involved, userId);
        }
        target.setAdmin(admin);
        audit.record(actorId, projectId, admin ? "ROOM_ADMIN_GRANTED" : "ROOM_ADMIN_REVOKED", removedRatings);
    }

    /**
     * 참여자를 제거한다. 한 트랜잭션에서:
     * 그 사람이 준·받은 점수 삭제 → 혼자 하는 발표 삭제 → 함께 하는 발표에서 빼고 대표였으면 새 대표 지정(발표자 → 팀원 순).
     * 지울 데이터가 있으면 화면이 확인한 version이 지금과 같아야 한다.
     */
    @Transactional
    public void remove(UUID actorId, UUID projectId, UUID userId, Long expectedVersion) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        Membership target = memberships.findByProjectIdAndUserId(projectId, userId).orElse(null);
        if (target == null) {
            return;
        }
        if (target.isAdmin() && memberships.countByProjectIdAndAdminTrue(projectId) <= 1) {
            throw ApiException.badRequest("마지막 룸 관리자는 제거할 수 없습니다.");
        }
        List<PresentationMember> involved = presentationMembers.findByProjectIdAndUserId(projectId, userId);
        boolean hasRatings = ratings.findByProjectId(projectId).stream()
                .anyMatch(r -> r.getRaterId().equals(userId) || r.getTargetId().equals(userId));
        if (hasRatings || !involved.isEmpty()) {
            room.requireVersion(expectedVersion);
        }

        int removedRatings = ratings.deleteInvolving(projectId, userId);
        removedRatings += leavePresentations(involved, userId);
        memberships.deleteMember(projectId, userId);
        audit.record(actorId, projectId, "MEMBER_REMOVED", removedRatings);
    }

    /** 혼자 하는 발표는 삭제하고, 함께 하는 발표에서는 빼고 대표였으면 새 대표를 정한다. 발표 삭제로 지운 평가 수를 돌려준다 */
    private int leavePresentations(List<PresentationMember> involved, UUID userId) {
        int removedRatings = 0;
        for (PresentationMember row : involved) {
            Presentation presentation = presentations.findById(row.getPresentationId()).orElseThrow();
            List<PresentationMember> crew = presentationMembers.findByPresentationId(presentation.getId());
            if (crew.size() == 1) {
                removedRatings += presentationRemover.remove(presentation);
                continue;
            }
            if (presentation.getLeaderId().equals(userId)) {
                presentation.changeLeader(nextLeader(crew, userId));
            }
            presentationMembers.deleteOne(presentation.getId(), userId);
        }
        return removedRatings;
    }

    /** 남은 구성원 중 발표자 먼저, 없으면 팀원 중 앞 순서 */
    private static UUID nextLeader(List<PresentationMember> crew, UUID leaving) {
        return crew.stream()
                .filter(m -> !m.getUserId().equals(leaving))
                .sorted(Comparator.comparing((PresentationMember m) -> !m.isPresenter())
                        .thenComparingInt(PresentationMember::getSortOrder))
                .map(PresentationMember::getUserId)
                .findFirst()
                .orElseThrow();
    }
}
