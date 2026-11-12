package com.scoreroom.project.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
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
    private final LogService logs;
    private final Clock clock;

    public MembershipService(MembershipRepository memberships, TeamRepository teams,
            PresentationRepository presentations, PresentationMemberRepository presentationMembers,
            RatingRepository ratings, PresentationRemover presentationRemover, RoomGuard roomGuard,
            UserAccessService userAccess, NotificationService notifications, LogService logs, Clock clock) {
        this.memberships = memberships;
        this.teams = teams;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.ratings = ratings;
        this.presentationRemover = presentationRemover;
        this.roomGuard = roomGuard;
        this.userAccess = userAccess;
        this.notifications = notifications;
        this.logs = logs;
        this.clock = clock;
    }

    /**
     * 평가룸에 참여시킨다. 지금 회사 팀을 참여 당시 소속으로 기록한다. 이미 참여 중이면 그대로 두고 false를 돌려준다.
     * 호출하는 쪽이 평가룸을 잠근 상태여야 한다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean join(Project project, User user, boolean admin) {
        if (user.isSysAdmin()) {
            throw ApiException.forbidden("시스템 관리자는 평가룸에 참여할 수 없습니다.");
        }
        if (memberships.existsByProjectIdAndUserId(project.getId(), user.getId())) {
            return false;
        }
        String teamName = user.getTeamId() == null ? null
                : teams.findById(user.getTeamId()).map(t -> t.getName()).orElse(null);
        memberships.save(new Membership(project.getId(), user.getId(), user.getTeamId(), teamName, admin, clock.instant()));
        return true;
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
        List<String> names = new ArrayList<>();
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
            names.add(user.getName());
        }
        if (added > 0) {
            logs.activity(actorId, projectId, LogAction.MEMBERS_ADDED,
                    "참여자 " + added + "명 추가: " + String.join(", ", names));
        }
        return added;
    }

    /**
     * 룸 관리자는 최소 1명이어야 한다.
     * 룸 관리자 발표를 끈 평가룸이면, 발표에 등록된 사람을 관리자로 지정할 때 그 발표에서 뺀다
     * (혼자 하는 발표는 받은 평가와 함께 삭제, 팀 발표는 발표와 받은 평가가 남는다. 그 사람이 자기 발표에 준 평가는 지운다).
     * 관리자 평가를 끈 평가룸이면 그 사람이 준 평가도 모두 지운다. 지울 데이터가 있으면 화면이 확인한 version이 지금과 같아야 한다.
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
            List<PresentationMember> involved = room.project().settings().allowAdminPresent()
                    ? List.of() : presentationMembers.findByProjectIdAndUserId(projectId, userId);
            Set<UUID> ownPresentations = involved.stream().map(PresentationMember::getPresentationId)
                    .collect(Collectors.toSet());
            boolean dropGiven = !room.project().settings().allowAdminRating();
            List<UUID> doomed = ratings.findByProjectId(projectId).stream()
                    .filter(r -> r.getRaterId().equals(userId)
                            && (dropGiven || ownPresentations.contains(r.getPresentationId())))
                    .map(r -> r.getId()).toList();
            if (!involved.isEmpty() || !doomed.isEmpty()) {
                room.requireVersion(expectedVersion);
            }
            if (!doomed.isEmpty()) {
                logs.ratingsDeleted(actorId, projectId, "룸 관리자 지정", ratings.findAllById(doomed));
            }
            removedRatings = doomed.isEmpty() ? 0 : ratings.deleteByIds(doomed);
            removedRatings += leavePresentations(involved, userId);
        }
        if (target.isAdmin() == admin) {
            return;
        }
        target.setAdmin(admin);
        logs.activity(actorId, projectId, admin ? LogAction.ROOM_ADMIN_GRANTED : LogAction.ROOM_ADMIN_REVOKED,
                logs.userName(userId) + " 룸 관리자 " + (admin ? "지정" : "해제")
                        + (removedRatings > 0 ? " (평가 " + removedRatings + "건 삭제)" : ""));
    }

    /** 발표 구성원으로 들어 있는 룸 관리자 (룸 관리자 발표를 끌 때 영향 확인용) */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<PresentationMember> adminPresenters(UUID projectId) {
        Set<UUID> admins = memberships.findByProjectId(projectId).stream()
                .filter(Membership::isAdmin).map(Membership::getUserId).collect(Collectors.toSet());
        return presentationMembers.findByProjectId(projectId).stream().filter(pm -> admins.contains(pm.getUserId())).toList();
    }

    /**
     * 룸 관리자 발표를 끌 때: 발표에 들어 있는 관리자를 모두 발표에서 뺀다 (관리자로 지정할 때와 같은 규칙).
     * 그 관리자가 자기 발표에 준 평가도 지운다. 지운 평가 수를 돌려준다. 호출하는 쪽이 평가룸을 잠그고 version을 확인한다
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int removeAdminPresenters(UUID projectId) {
        int removedRatings = 0;
        Map<UUID, List<PresentationMember>> byAdmin = adminPresenters(projectId).stream()
                .collect(Collectors.groupingBy(PresentationMember::getUserId));
        for (Map.Entry<UUID, List<PresentationMember>> e : byAdmin.entrySet()) {
            UUID userId = e.getKey();
            Set<UUID> own = e.getValue().stream().map(PresentationMember::getPresentationId).collect(Collectors.toSet());
            List<UUID> doomed = ratings.findByProjectId(projectId).stream()
                    .filter(r -> r.getRaterId().equals(userId) && own.contains(r.getPresentationId()))
                    .map(r -> r.getId()).toList();
            if (!doomed.isEmpty()) {
                logs.ratingsDeleted(null, projectId, "룸 관리자 발표 끄기", ratings.findAllById(doomed));
            }
            removedRatings += doomed.isEmpty() ? 0 : ratings.deleteByIds(doomed);
            // 앞에서 다른 관리자가 빠지며 발표가 지워졌을 수 있으므로 다시 읽는다
            removedRatings += leavePresentations(presentationMembers.findByProjectIdAndUserId(projectId, userId), userId);
        }
        return removedRatings;
    }

    /**
     * 참여자를 제거한다. 한 트랜잭션에서:
     * 그 사람이 준 점수 삭제 → 혼자 하는 발표 삭제(받은 점수도 함께) → 함께 하는 발표에서 빼고 대표였으면 새 대표 지정(발표자 → 팀원 순).
     * 팀 발표가 받은 점수는 발표에 붙어 있으므로 남는다.
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
                .anyMatch(r -> r.getRaterId().equals(userId));
        if (hasRatings || !involved.isEmpty()) {
            room.requireVersion(expectedVersion);
        }

        String name = logs.userName(userId);
        logs.ratingsDeleted(actorId, projectId, name + " 참여자 제거", ratings.findByProjectId(projectId).stream()
                .filter(r -> r.getRaterId().equals(userId)).toList());
        int removedRatings = ratings.deleteGivenBy(projectId, userId);
        removedRatings += leavePresentations(involved, userId);
        memberships.deleteMember(projectId, userId);
        logs.activity(actorId, projectId, LogAction.MEMBER_REMOVED, name + " 참여자 제거"
                + (removedRatings > 0 ? " (평가 " + removedRatings + "건 삭제)" : ""));
    }

    /** 혼자 하는 발표는 삭제하고, 함께 하는 발표에서는 빼고 대표였으면 새 대표를 정한다. 발표 삭제로 지운 평가 수를 돌려준다 */
    private int leavePresentations(List<PresentationMember> involved, UUID userId) {
        int removedRatings = 0;
        for (PresentationMember row : involved) {
            Presentation presentation = presentations.findById(row.getPresentationId()).orElseThrow();
            List<PresentationMember> crew = presentationMembers.findByPresentationId(presentation.getId());
            if (crew.size() == 1) {
                removedRatings += presentationRemover.remove(presentation, "유일한 구성원 " + logs.userName(userId) + " 빠짐");
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
