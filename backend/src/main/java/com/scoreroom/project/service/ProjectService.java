package com.scoreroom.project.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.invitation.repository.InvitationRepository;
import com.scoreroom.invitation.repository.InviteCodeRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.dto.CreateProjectRequest;
import com.scoreroom.project.dto.UpdateSettingsRequest;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.rating.service.RatingService;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.service.UserAccessService;

/** 평가룸 생성, 설정, 마감 */
@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final RatingRepository ratings;
    private final RatingService ratingService;
    private final InviteCodeRepository inviteCodes;
    private final InvitationRepository invitations;
    private final MembershipService membershipService;
    private final UserAccessService userAccess;
    private final RoomGuard roomGuard;
    private final AuditService audit;
    private final Clock clock;

    public ProjectService(ProjectRepository projects, RatingRepository ratings, RatingService ratingService,
            InviteCodeRepository inviteCodes, InvitationRepository invitations, MembershipService membershipService,
            UserAccessService userAccess, RoomGuard roomGuard, AuditService audit, Clock clock) {
        this.projects = projects;
        this.ratings = ratings;
        this.ratingService = ratingService;
        this.inviteCodes = inviteCodes;
        this.invitations = invitations;
        this.membershipService = membershipService;
        this.userAccess = userAccess;
        this.roomGuard = roomGuard;
        this.audit = audit;
        this.clock = clock;
    }

    /** 만든 사람은 룸 운영자가 된다 */
    @Transactional
    public UUID create(UUID actorId, CreateProjectRequest request) {
        User actor = userAccess.require(actorId);
        if (actor.isSysAdmin()) {
            throw ApiException.forbidden("시스템 관리자는 평가룸에 참여할 수 없습니다.");
        }
        String description = request.description() == null ? "" : request.description().trim();
        Project project = projects.save(new Project(request.name().trim(), description, actorId));
        membershipService.join(project, actor, true);
        return project.getId();
    }

    /**
     * 점수 입력 범위가 바뀌면 이 평가룸의 모든 평가를 지우고 집계 기준을 '사용 안 함'으로 되돌린다.
     * 그 밖에는 새 평가 규칙에 맞지 않게 되는 평가만 지운다. 지울 평가가 있으면 화면이 확인한 version이 필요하다.
     * 지운 평가 건수를 돌려준다.
     */
    @Transactional
    public int updateSettings(UUID actorId, UUID projectId, UpdateSettingsRequest request) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        Project project = room.project();
        ProjectSettings current = project.settings();
        ProjectSettings next = request.toSettings(current);
        boolean reset = next.rangeChangedFrom(current);
        if (reset) {
            next = next.withoutAggregation();
        }
        next.validate();

        int removed;
        if (reset) {
            if (ratings.countByProjectId(projectId) > 0) {
                room.requireVersion(request.expectedVersion());
            }
            removed = ratings.deleteAllInProject(projectId);
        } else {
            List<UUID> blocked = ratingService.findBlockedBy(projectId, next);
            if (!blocked.isEmpty()) {
                room.requireVersion(request.expectedVersion());
            }
            removed = blocked.isEmpty() ? 0 : ratings.deleteByIds(blocked);
        }
        project.applySettings(next);
        audit.record(actorId, projectId, "SETTINGS_CHANGED", removed);
        return removed;
    }

    /** 마감하면 평가를 받지 않고, 입장 코드와 대기 중인 초대를 무효로 한다. 다시 열 수 없다 */
    @Transactional
    public void close(UUID actorId, UUID projectId) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        Instant now = clock.instant();
        room.project().close(now);
        inviteCodes.revokeFor(projectId, now);
        invitations.cancelPending(projectId, now);
        audit.record(actorId, projectId, "PROJECT_CLOSED", 0);
    }
}
