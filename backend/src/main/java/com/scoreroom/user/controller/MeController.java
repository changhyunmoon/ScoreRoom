package com.scoreroom.user.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.dto.UpdateProfileRequest;
import com.scoreroom.user.dto.UserResponse;
import com.scoreroom.user.service.ProfileService;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final ProfileService profileService;

    public MeController(ProfileService profileService) {
        this.profileService = profileService;
    }

    /** 새로 고침했을 때 로그인 상태를 확인한다. 로그인하지 않았으면 401 */
    @GetMapping
    public UserResponse me(@AuthenticationPrincipal AuthenticatedUser me) {
        return profileService.me(me.userId());
    }

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody UpdateProfileRequest request,
            HttpServletRequest httpRequest) {
        profileService.update(me.userId(), request, httpRequest.getSession().getId());
    }
}
