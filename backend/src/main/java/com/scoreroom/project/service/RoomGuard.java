package com.scoreroom.project.service;

import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.user.domain.User;

/**
 * 평가룸 접근 확인의 단일 진입점.
 * 쓰기 작업은 평가룸 행을 잠근 뒤 참여·운영 권한과 진행 중 여부를 다시 확인하고 version을 올린다.
 * 잠금 순서는 항상 평가룸 → 발표 → 평가/초대 등 하위 행이다.
 */
@Component
public class RoomGuard {

    /** 잠근 평가룸, 내 참여 정보, 이번 작업 전의 version */
    public record RoomWrite(Project project, Membership membership, long previousVersion) {

        public UUID projectId() {
            return project.getId();
        }

        /** 위험한 변경을 확인받은 뒤 그 사이 데이터가 바뀌었으면 거절한다 */
        public void requireVersion(Long expectedVersion) {
            if (expectedVersion == null || expectedVersion != previousVersion) {
                throw new ApiException(ErrorCode.VERSION_CONFLICT, "그 사이 평가룸 데이터가 바뀌었습니다. 영향 범위를 다시 확인해 주세요.");
            }
        }
    }

    private final ProjectRepository projects;
    private final MembershipRepository memberships;

    public RoomGuard(ProjectRepository projects, MembershipRepository memberships) {
        this.projects = projects;
        this.memberships = memberships;
    }

    /** 진행 중인 평가룸의 참여자로서 쓰기 */
    @Transactional(propagation = Propagation.MANDATORY)
    public RoomWrite lockAsMember(UUID projectId, UUID actorId) {
        Project project = projects.findByIdForUpdate(projectId).orElseThrow(RoomGuard::projectNotFound);
        Membership membership = requireMember(projectId, actorId);
        return beginWrite(project, membership);
    }

    /** 진행 중인 평가룸의 룸 관리자로서 쓰기 */
    @Transactional(propagation = Propagation.MANDATORY)
    public RoomWrite lockAsAdmin(UUID projectId, UUID actorId) {
        RoomWrite write = lockAsMember(projectId, actorId);
        if (!write.membership().isAdmin()) {
            throw ApiException.forbidden("룸 관리자만 가능합니다.");
        }
        return write;
    }

    /** 참여자이거나 전체 열람 권한이 있으면 읽을 수 있다 (시스템 관리자는 평가룸을 보지 않는다) */
    @Transactional(readOnly = true)
    public Project requireViewable(UUID projectId, User actor) {
        Project project = projects.findById(projectId).orElseThrow(RoomGuard::projectNotFound);
        boolean member = memberships.existsByProjectIdAndUserId(projectId, actor.getId());
        if (!member && !(actor.canViewAll() && !actor.isSysAdmin())) {
            throw ApiException.forbidden("평가룸 참여자가 아닙니다.");
        }
        return project;
    }

    public Membership requireMember(UUID projectId, UUID userId) {
        return memberships.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> ApiException.forbidden("평가룸 참여자가 아닙니다."));
    }

    private static RoomWrite beginWrite(Project project, Membership membership) {
        if (!project.isOpen()) {
            throw new ApiException(ErrorCode.PROJECT_CLOSED, "마감된 평가룸입니다.");
        }
        long previous = project.getVersion();
        project.bumpVersion();
        return new RoomWrite(project, membership, previous);
    }

    private static ApiException projectNotFound() {
        return ApiException.notFound("평가룸을 찾을 수 없습니다.");
    }
}
