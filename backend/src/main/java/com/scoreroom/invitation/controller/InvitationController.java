package com.scoreroom.invitation.controller;

import java.util.UUID;

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
import com.scoreroom.invitation.dto.AcceptInvitationResponse;
import com.scoreroom.invitation.dto.InviteUsersRequest;
import com.scoreroom.invitation.dto.InvitedResponse;
import com.scoreroom.invitation.service.InvitationService;

@RestController
@RequestMapping("/api/v1")
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @PostMapping("/projects/{projectId}/invitations")
    public InvitedResponse invite(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @RequestBody InviteUsersRequest request) {
        return new InvitedResponse(invitationService.invite(me.userId(), projectId, request.userIds()));
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public AcceptInvitationResponse accept(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID invitationId) {
        return new AcceptInvitationResponse(invitationService.accept(me.userId(), invitationId));
    }

    @PostMapping("/invitations/{invitationId}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID invitationId) {
        invitationService.decline(me.userId(), invitationId);
    }

    @DeleteMapping("/invitations/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID invitationId) {
        invitationService.cancel(me.userId(), invitationId);
    }
}
