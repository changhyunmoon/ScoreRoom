package com.scoreroom.log.controller;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.log.dto.LogActionsResponse;
import com.scoreroom.log.dto.LogEntryResponse;
import com.scoreroom.log.dto.LogPageResponse;
import com.scoreroom.log.dto.LogQuery;
import com.scoreroom.log.dto.LogSummaryResponse;
import com.scoreroom.log.service.LogQueryService;

/** 시스템 관리자: 로그 조회. category·action·level은 쉼표로 여러 개, from·to는 epoch milliseconds */
@RestController
@RequestMapping("/api/v1/admin/logs")
public class AdminLogController {

    private final LogQueryService queryService;

    public AdminLogController(LogQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public LogPageResponse list(@AuthenticationPrincipal AuthenticatedUser me,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> action,
            @RequestParam(required = false) List<String> level,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int size) {
        return queryService.list(me.userId(), new LogQuery(category, action, level, projectId, instant(from), instant(to), q), cursor, size);
    }

    @GetMapping("/summary")
    public LogSummaryResponse summary(@AuthenticationPrincipal AuthenticatedUser me,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(required = false) String q) {
        return queryService.summary(me.userId(), new LogQuery(null, null, null, projectId, instant(from), instant(to), q));
    }

    @GetMapping("/actions")
    public LogActionsResponse actions(@AuthenticationPrincipal AuthenticatedUser me) {
        return queryService.actions(me.userId());
    }

    private static Instant instant(Long millis) {
        return millis == null ? null : Instant.ofEpochMilli(millis);
    }

    @GetMapping("/{id}")
    public LogEntryResponse get(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id) {
        return queryService.get(me.userId(), id);
    }
}
