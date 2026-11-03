package com.scoreroom.presentation.controller;

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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.IdResponse;
import com.scoreroom.common.web.MoveRequest;
import com.scoreroom.presentation.dto.ReorderPresentationsRequest;
import com.scoreroom.presentation.dto.SavePresentationRequest;
import com.scoreroom.presentation.service.PresentationService;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/presentations")
public class PresentationController {

    private final PresentationService presentationService;

    public PresentationController(PresentationService presentationService) {
        this.presentationService = presentationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse create(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @Valid @RequestBody SavePresentationRequest request) {
        return new IdResponse(presentationService.create(me.userId(), projectId, request));
    }

    /** /order가 /{presentationId}보다 먼저 맞도록 경로를 따로 둔다 */
    @PutMapping("/order")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @Valid @RequestBody ReorderPresentationsRequest request) {
        presentationService.reorder(me.userId(), projectId, request.ids());
    }

    @PutMapping("/{presentationId}")
    public IdResponse update(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @Valid @RequestBody SavePresentationRequest request) {
        presentationService.update(me.userId(), projectId, presentationId, request);
        return new IdResponse(presentationId);
    }

    @DeleteMapping("/{presentationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId) {
        presentationService.delete(me.userId(), projectId, presentationId);
    }

    @PostMapping("/{presentationId}/move")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void move(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @Valid @RequestBody MoveRequest request) {
        presentationService.move(me.userId(), projectId, presentationId, request.dir());
    }
}
