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
import com.scoreroom.project.dto.CreateProjectRequest;
import com.scoreroom.project.dto.RemovedResponse;
import com.scoreroom.project.dto.SetAdminRequest;
import com.scoreroom.project.dto.UpdateSettingsRequest;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.project.service.ProjectService;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final MembershipService membershipService;

    public ProjectController(ProjectService projectService, MembershipService membershipService) {
        this.projectService = projectService;
        this.membershipService = membershipService;
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

    @PostMapping("/{projectId}/close")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void close(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId) {
        projectService.close(me.userId(), projectId);
    }

    @PutMapping("/{projectId}/members/{userId}/admin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setAdmin(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID userId, @RequestBody SetAdminRequest request) {
        membershipService.setAdmin(me.userId(), projectId, userId, request.isAdmin());
    }

    /** expectedVersion: 화면이 제거 영향(지울 평가·발표)을 보여줄 때 본 평가룸 version */
    @DeleteMapping("/{projectId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID userId, @RequestParam(required = false) Long expectedVersion) {
        membershipService.remove(me.userId(), projectId, userId, expectedVersion);
    }
}
