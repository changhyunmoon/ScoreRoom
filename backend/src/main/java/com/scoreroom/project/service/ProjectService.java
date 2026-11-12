package com.scoreroom.project.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.log.service.SettingsDiff;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.invitation.repository.InviteCodeRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.dto.CreateProjectRequest;
import com.scoreroom.project.dto.UpdateProjectInfoRequest;
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
    private final MembershipService membershipService;
    private final UserAccessService userAccess;
    private final RoomGuard roomGuard;
    private final LogService logs;
    private final Clock clock;

    public ProjectService(ProjectRepository projects, RatingRepository ratings, RatingService ratingService,
            InviteCodeRepository inviteCodes, MembershipService membershipService,
            UserAccessService userAccess, RoomGuard roomGuard, LogService logs, Clock clock) {
        this.projects = projects;
        this.ratings = ratings;
        this.ratingService = ratingService;
        this.inviteCodes = inviteCodes;
        this.membershipService = membershipService;
        this.userAccess = userAccess;
        this.roomGuard = roomGuard;
        this.logs = logs;
        this.clock = clock;
    }

    /** 시스템 관리자에게 평가룸 생성 권한을 받은 사람만 만든다. 만든 사람은 룸 관리자가 된다 */
    @Transactional
    public UUID create(UUID actorId, CreateProjectRequest request) {
        User actor = userAccess.require(actorId);
        if (actor.isSysAdmin()) {
            throw ApiException.forbidden("시스템 관리자는 평가룸에 참여할 수 없습니다.");
        }
        if (!actor.canCreateRoom()) {
            throw ApiException.forbidden("평가룸을 만들 권한이 없습니다. 시스템 관리자에게 요청해 주세요.");
        }
        String description = request.description() == null ? "" : request.description().trim();
        Project project = projects.save(new Project(request.name().trim(), description, actorId));
        membershipService.join(project, actor, true);
        logs.activity(actorId, project.getId(), LogAction.PROJECT_CREATED, "'" + project.getName() + "' 평가룸 생성",
                description.isEmpty() ? null : "설명: " + description);
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

        // 룸 관리자 발표를 끄면 발표에 들어 있는 관리자를 발표에서 뺀다 (관리자로 지정할 때와 같은 규칙)
        int removedByAdminPresent = 0;
        if (current.allowAdminPresent() && !next.allowAdminPresent()
                && !membershipService.adminPresenters(projectId).isEmpty()) {
            room.requireVersion(request.expectedVersion());
            removedByAdminPresent = membershipService.removeAdminPresenters(projectId);
        }

        int removed;
        if (reset) {
            if (ratings.countByProjectId(projectId) > 0) {
                room.requireVersion(request.expectedVersion());
            }
            logs.ratingsDeleted(actorId, projectId, "점수 입력 범위 변경", ratings.findByProjectId(projectId));
            removed = ratings.deleteAllInProject(projectId);
        } else {
            List<UUID> blocked = ratingService.findBlockedBy(projectId, next);
            if (!blocked.isEmpty()) {
                room.requireVersion(request.expectedVersion());
                logs.ratingsDeleted(actorId, projectId, "평가 규칙 변경", ratings.findAllById(blocked));
            }
            removed = blocked.isEmpty() ? 0 : ratings.deleteByIds(blocked);
        }
        removed += removedByAdminPresent;
        project.applySettings(next);
        List<String> changes = SettingsDiff.of(current, next);
        if (!changes.isEmpty() || removed > 0) {
            logs.activity(actorId, projectId, LogAction.SETTINGS_CHANGED,
                    "설정 변경: " + (changes.isEmpty() ? "변경 없음" : String.join(" · ", changes))
                            + (removed > 0 ? " (평가 " + removed + "건 삭제)" : ""),
                    String.join("\n", changes));
        }
        return removed;
    }

    /** 평가룸 이름·설명 수정 (룸 관리자, 마감 전). 평가·설정에는 영향이 없다 */
    @Transactional
    public void updateInfo(UUID actorId, UUID projectId, UpdateProjectInfoRequest request) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("평가룸 이름을 입력해 주세요.");
        }
        String description = request.description() == null ? "" : request.description().trim();
        String beforeName = room.project().getName();
        String beforeDescription = room.project().getDescription();
        room.project().describe(name, description);
        List<String> changes = new ArrayList<>();
        if (!beforeName.equals(name)) {
            changes.add("이름 '" + beforeName + "' → '" + name + "'");
        }
        if (!Objects.equals(beforeDescription, description)) {
            changes.add("설명 '" + beforeDescription + "' → '" + description + "'");
        }
        if (!changes.isEmpty()) {
            logs.activity(actorId, projectId, LogAction.PROJECT_INFO_CHANGED, "정보 수정: " + String.join(" · ", changes));
        }
    }

    /** 마감하면 평가를 받지 않고, 입장 코드를 무효로 한다. 다시 열 수 없다 */
    @Transactional
    public void close(UUID actorId, UUID projectId) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        Instant now = clock.instant();
        room.project().close(now);
        inviteCodes.revokeFor(projectId, now);
        logs.activity(actorId, projectId, LogAction.PROJECT_CLOSED, "'" + room.project().getName() + "' 평가룸 마감");
    }
}
