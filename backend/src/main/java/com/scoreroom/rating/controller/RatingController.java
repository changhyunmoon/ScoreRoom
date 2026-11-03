package com.scoreroom.rating.controller;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.rating.dto.SubmitRatingRequest;
import com.scoreroom.rating.service.RatingService;

@RestController
public class RatingController {

    private final RatingService ratingService;

    public RatingController(RatingService ratingService) {
        this.ratingService = ratingService;
    }

    @PutMapping("/api/v1/projects/{projectId}/presentations/{presentationId}/ratings/{targetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submit(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @PathVariable UUID targetId,
            @Valid @RequestBody SubmitRatingRequest request) {
        ratingService.submit(me.userId(), projectId, presentationId, targetId, request);
    }
}
