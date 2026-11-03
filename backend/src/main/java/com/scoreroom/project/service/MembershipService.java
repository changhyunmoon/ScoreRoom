package com.scoreroom.project.service;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
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

/** 평가룸 참여자: 참여, 룸 운영자 지정·해제, 제거 */
@Service
public class MembershipService {

    private final MembershipRepository memberships;
    private final TeamRepository teams;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final RatingRepository ratings;
    private final PresentationRemover presentationRemover;
    private final RoomGuard roomGuard;
    private final AuditService audit;
    private final Clock clock;

    public MembershipService(MembershipRepository memberships, TeamRepository teams,
            PresentationRepository presentations, PresentationMemberRepository presentationMembers,
            RatingRepository ratings, PresentationRemover presentationRemover, RoomGuard roomGuard, AuditService audit,
            Clock clock) {
        this.memberships = memberships;
        this.teams = teams;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.ratings = ratings;
        this.presentationRemover = presentationRemover;
        this.roomGuard = roomGuard;
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

    /** 룸 운영자는 최소 1명이어야 한다 */
    @Transactional
    public void setAdmin(UUID actorId, UUID projectId, UUID userId, boolean admin) {
        roomGuard.lockAsAdmin(projectId, actorId);
        Membership target = memberships.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> ApiException.notFound("참여자를 찾을 수 없습니다."));
        if (!admin && target.isAdmin() && memberships.countByProjectIdAndAdminTrue(projectId) <= 1) {
            throw ApiException.badRequest("룸 운영자는 최소 1명이어야 합니다.");
        }
        target.setAdmin(admin);
        audit.record(actorId, projectId, admin ? "ROOM_ADMIN_GRANTED" : "ROOM_ADMIN_REVOKED", 1);
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
            throw ApiException.badRequest("마지막 룸 운영자는 제거할 수 없습니다.");
        }
        List<PresentationMember> involved = presentationMembers.findByProjectIdAndUserId(projectId, userId);
        boolean hasRatings = ratings.findByProjectId(projectId).stream()
                .anyMatch(r -> r.getRaterId().equals(userId) || r.getTargetId().equals(userId));
        if (hasRatings || !involved.isEmpty()) {
            room.requireVersion(expectedVersion);
        }

        int removedRatings = ratings.deleteInvolving(projectId, userId);
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
        memberships.deleteMember(projectId, userId);
        audit.record(actorId, projectId, "MEMBER_REMOVED", removedRatings);
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
