package com.scoreroom.user.controller;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.IdResponse;
import com.scoreroom.common.web.MoveRequest;
import com.scoreroom.user.dto.CreateUserRequest;
import com.scoreroom.user.dto.ResetPasswordRequest;
import com.scoreroom.user.dto.SetPositionRequest;
import com.scoreroom.user.dto.SetTeamRequest;
import com.scoreroom.user.dto.SetViewAllRequest;
import com.scoreroom.user.service.UserAdminService;

/** 시스템 관리자 전용 사용자 관리 */
@RestController
@RequestMapping("/api/v1/admin")
public class UserAdminController {

    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @PostMapping("/teams/{teamId}/users")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse addUser(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID teamId,
            @Valid @RequestBody CreateUserRequest request) {
        return new IdResponse(userAdminService.addToTeam(me.userId(), teamId, request));
    }

    @PutMapping("/users/{userId}/team")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setTeam(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID userId,
            @RequestBody SetTeamRequest request) {
        userAdminService.setTeam(me.userId(), userId, request.teamId());
    }

    @PostMapping("/users/{userId}/move")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void move(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID userId,
            @Valid @RequestBody MoveRequest request) {
        userAdminService.move(me.userId(), userId, request.dir());
    }

    @PutMapping("/users/{userId}/position")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setPosition(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID userId,
            @Valid @RequestBody SetPositionRequest request) {
        userAdminService.setPosition(me.userId(), userId, request.position());
    }

    @PutMapping("/users/{userId}/view-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setViewAll(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID userId,
            @RequestBody SetViewAllRequest request) {
        userAdminService.setViewAll(me.userId(), userId, request.enabled());
    }

    @PutMapping("/users/{userId}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID userId,
            @Valid @RequestBody ResetPasswordRequest request) {
        userAdminService.resetPassword(me.userId(), userId, request.password());
    }
}
