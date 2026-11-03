package com.scoreroom.organization.controller;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.IdResponse;
import com.scoreroom.organization.dto.SaveTeamRequest;
import com.scoreroom.organization.dto.TeamResponse;
import com.scoreroom.organization.service.TeamService;

@RestController
@RequestMapping("/api/v1")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    /** 가입 화면에서도 쓰므로 로그인 없이 조회한다 (팀 이름과 계층만) */
    @GetMapping("/teams")
    public List<TeamResponse> list() {
        return teamService.list();
    }

    @PostMapping("/admin/teams")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse create(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody SaveTeamRequest request) {
        return new IdResponse(teamService.create(me.userId(), request));
    }

    @PutMapping("/admin/teams/{teamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID teamId,
            @Valid @RequestBody SaveTeamRequest request) {
        teamService.update(me.userId(), teamId, request);
    }

    @DeleteMapping("/admin/teams/{teamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID teamId) {
        teamService.delete(me.userId(), teamId);
    }
}
