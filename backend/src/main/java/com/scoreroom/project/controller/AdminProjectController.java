package com.scoreroom.project.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.project.dto.RoomOverviewResponse;
import com.scoreroom.project.service.ProjectRemovalService;

/** 시스템 관리자: 전체 평가룸 목록 (삭제는 DELETE /api/v1/projects/{id}) */
@RestController
@RequestMapping("/api/v1/admin/projects")
public class AdminProjectController {

    private final ProjectRemovalService removalService;

    public AdminProjectController(ProjectRemovalService removalService) {
        this.removalService = removalService;
    }

    @GetMapping
    public List<RoomOverviewResponse> list(@AuthenticationPrincipal AuthenticatedUser me) {
        return removalService.listAll(me.userId());
    }
}
