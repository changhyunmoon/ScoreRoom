package com.scoreroom.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.dto.OnlineUsersResponse;
import com.scoreroom.user.service.OnlineUserService;

/** 시스템 관리자: 지금 로그인해 있는 사람 (보기만) */
@RestController
@RequestMapping("/api/v1/admin/online")
public class AdminOnlineController {

    private final OnlineUserService onlineUsers;

    public AdminOnlineController(OnlineUserService onlineUsers) {
        this.onlineUsers = onlineUsers;
    }

    @GetMapping
    public OnlineUsersResponse list(@AuthenticationPrincipal AuthenticatedUser me) {
        return onlineUsers.list(me.userId());
    }
}
