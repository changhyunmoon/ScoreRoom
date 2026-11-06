package com.scoreroom.presentation.controller;

import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.presentation.dto.PresentationRequestRequest;
import com.scoreroom.presentation.dto.SentResponse;
import com.scoreroom.presentation.service.PresentationRequestService;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/presentation-requests")
public class PresentationRequestController {

    private final PresentationRequestService requestService;

    public PresentationRequestController(PresentationRequestService requestService) {
        this.requestService = requestService;
    }

    /** 룸 관리자: 발표 미등록자에게 발표 등록 요청 알림을 보낸다 */
    @PostMapping
    public SentResponse request(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @RequestBody PresentationRequestRequest request) {
        return new SentResponse(requestService.request(me.userId(), projectId, request.userIds()));
    }
}
