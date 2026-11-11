package com.scoreroom.rating.controller;

import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.presentation.dto.SentResponse;
import com.scoreroom.rating.dto.RatingRequestRequest;
import com.scoreroom.rating.service.RatingRequestService;

@RestController
public class RatingRequestController {

    private final RatingRequestService requestService;

    public RatingRequestController(RatingRequestService requestService) {
        this.requestService = requestService;
    }

    /** 룸 관리자: 이 발표를 아직 평가하지 않은 사람에게 평가 요청 알림을 보낸다 */
    @PostMapping("/api/v1/projects/{projectId}/presentations/{presentationId}/rating-requests")
    public SentResponse request(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @RequestBody RatingRequestRequest request) {
        return new SentResponse(requestService.request(me.userId(), projectId, presentationId, request.userIds()));
    }
}
