package com.scoreroom.user.controller;

import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.dto.RoomOnlineResponse;
import com.scoreroom.user.service.OnlineUserService;

/** 룸 관리자: 이 평가룸 참여자의 접속 현황 (보기만) */
@RestController
public class RoomOnlineController {

    private final OnlineUserService onlineUsers;

    public RoomOnlineController(OnlineUserService onlineUsers) {
        this.onlineUsers = onlineUsers;
    }

    @GetMapping("/api/v1/projects/{projectId}/online")
    public RoomOnlineResponse list(@PathVariable UUID projectId, @AuthenticationPrincipal AuthenticatedUser me) {
        return onlineUsers.listRoom(projectId, me.userId());
    }
}
