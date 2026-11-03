package com.scoreroom.invitation.controller;

import java.time.Duration;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.IdResponse;
import com.scoreroom.common.web.RateLimiter;
import com.scoreroom.invitation.dto.IssueInviteCodeRequest;
import com.scoreroom.invitation.dto.JoinByCodeRequest;
import com.scoreroom.invitation.service.InviteCodeService;

@RestController
@RequestMapping("/api/v1/projects")
public class InviteCodeController {

    private final InviteCodeService inviteCodeService;
    private final RateLimiter rateLimiter;

    public InviteCodeController(InviteCodeService inviteCodeService, RateLimiter rateLimiter) {
        this.inviteCodeService = inviteCodeService;
        this.rateLimiter = rateLimiter;
    }

    /** 코드 추측을 막기 위해 사용자별 입장 시도 횟수를 제한한다 */
    @PostMapping("/join")
    public IdResponse join(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody JoinByCodeRequest request) {
        rateLimiter.check("join:" + me.userId(), 10, Duration.ofMinutes(1));
        return new IdResponse(inviteCodeService.join(me.userId(), request.code()));
    }

    @PostMapping("/{projectId}/invite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void issue(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @RequestBody IssueInviteCodeRequest request) {
        inviteCodeService.issue(me.userId(), projectId, request.minutes());
    }

    @DeleteMapping("/{projectId}/invite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId) {
        inviteCodeService.revoke(me.userId(), projectId);
    }
}
