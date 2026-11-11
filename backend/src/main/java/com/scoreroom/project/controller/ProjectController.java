package com.scoreroom.project.controller;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.IdResponse;
import com.scoreroom.project.dto.AddMembersRequest;
import com.scoreroom.project.dto.AddedResponse;
import com.scoreroom.project.dto.CreateProjectRequest;
import com.scoreroom.project.dto.RemovedResponse;
import com.scoreroom.project.dto.SetAdminRequest;
import com.scoreroom.project.dto.UpdateProjectInfoRequest;
import com.scoreroom.project.dto.UpdateSettingsRequest;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.project.service.ProjectRemovalService;
import com.scoreroom.project.service.ProjectService;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final MembershipService membershipService;
    private final ProjectRemovalService removalService;

    public ProjectController(ProjectService projectService, MembershipService membershipService, ProjectRemovalService removalService) {
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.removalService = removalService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse create(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody CreateProjectRequest request) {
        return new IdResponse(projectService.create(me.userId(), request));
    }

    @PutMapping("/{projectId}/settings")
    public RemovedResponse updateSettings(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @Valid @RequestBody UpdateSettingsRequest request) {
        return new RemovedResponse(projectService.updateSettings(me.userId(), projectId, request));
    }

    /** 평가룸 이름·설명 수정 (룸 관리자, 마감 전) */
    @PutMapping("/{projectId}/info")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateInfo(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @Valid @RequestBody UpdateProjectInfoRequest request) {
        projectService.updateInfo(me.userId(), projectId, request);
    }

    @PostMapping("/{projectId}/close")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void close(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId) {
        projectService.close(me.userId(), projectId);
    }

    /** 평가룸 삭제: 룸 관리자 또는 시스템 관리자. 발표·평가·자료·참여자를 모두 지우고 되돌릴 수 없다 */
    @DeleteMapping("/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId) {
        removalService.delete(me.userId(), projectId);
    }

    /** 사람 지정 초대: 고른 사람을 바로 참여자로 추가한다 */
    @PostMapping("/{projectId}/members")
    public AddedResponse addMembers(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @RequestBody AddMembersRequest request) {
        return new AddedResponse(membershipService.add(me.userId(), projectId, request.userIds()));
    }

    @PutMapping("/{projectId}/members/{userId}/admin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setAdmin(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID userId, @RequestBody SetAdminRequest request) {
        membershipService.setAdmin(me.userId(), projectId, userId, request.isAdmin(), request.expectedVersion());
    }

    /** expectedVersion: 화면이 제거 영향(지울 평가·발표)을 보여줄 때 본 평가룸 version */
    @DeleteMapping("/{projectId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID userId, @RequestParam(required = false) Long expectedVersion) {
        membershipService.remove(me.userId(), projectId, userId, expectedVersion);
    }
}
