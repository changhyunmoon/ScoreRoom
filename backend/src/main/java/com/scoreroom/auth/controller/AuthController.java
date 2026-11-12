package com.scoreroom.auth.controller;

import java.time.Duration;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.auth.dto.AuthOptionsResponse;
import com.scoreroom.auth.dto.CsrfResponse;
import com.scoreroom.auth.dto.FindLoginIdsRequest;
import com.scoreroom.auth.dto.FindLoginIdsResponse;
import com.scoreroom.auth.dto.LoginRequest;
import com.scoreroom.auth.dto.RecoverPasswordRequest;
import com.scoreroom.auth.dto.SignupRequest;
import com.scoreroom.auth.service.AccountRecoveryService;
import com.scoreroom.auth.service.AuthService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.RateLimiter;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.user.domain.LoginIds;
import com.scoreroom.user.dto.UserResponse;
import com.scoreroom.user.service.ProfileService;

/**
 * 세션 인증. 화면은 시작할 때와 로그인·로그아웃 뒤에 /auth/csrf로 토큰을 새로 받는다.
 * 로그인·가입도 CSRF 토큰이 있어야 한다.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final AccountRecoveryService recoveryService;
    private final ProfileService profileService;
    private final SessionLogin sessionLogin;
    private final RateLimiter rateLimiter;
    private final LogService logs;

    public AuthController(AuthService authService, AccountRecoveryService recoveryService, ProfileService profileService,
            SessionLogin sessionLogin, RateLimiter rateLimiter, LogService logs) {
        this.authService = authService;
        this.recoveryService = recoveryService;
        this.profileService = profileService;
        this.sessionLogin = sessionLogin;
        this.rateLimiter = rateLimiter;
        this.logs = logs;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @GetMapping("/options")
    public AuthOptionsResponse options() {
        return new AuthOptionsResponse(authService.isSignupEnabled());
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String loginId = LoginIds.normalize(request.loginId());
        try {
            rateLimiter.check("login:ip:" + httpRequest.getRemoteAddr(), 30, Duration.ofMinutes(1));
            rateLimiter.check("login:id:" + loginId, 10, Duration.ofMinutes(5));
        } catch (ApiException e) {
            logs.auth(LogAction.LOGIN_RATE_LIMITED, null, "로그인 시도 횟수 초과: " + loginId);
            throw e;
        }
        Authentication authentication;
        try {
            authentication = authService.authenticate(request.loginId(), request.password());
        } catch (ApiException e) {
            logs.auth(LogAction.LOGIN_FAILED, null, "로그인 실패: " + loginId);
            throw e;
        }
        sessionLogin.establish(authentication, httpRequest, httpResponse);
        UUID userId = ((AuthenticatedUser) authentication.getPrincipal()).userId();
        UserResponse me = profileService.me(userId);
        logs.auth(LogAction.LOGIN_SUCCESS, userId, me.name() + " 로그인 (" + loginId + ")");
        return me;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse signup(@Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        rateLimiter.check("signup:ip:" + httpRequest.getRemoteAddr(), 5, Duration.ofMinutes(10));
        Authentication authentication = authService.signup(request);
        sessionLogin.establish(authentication, httpRequest, httpResponse);
        return profileService.me(((AuthenticatedUser) authentication.getPrincipal()).userId());
    }

    /** 이메일 찾기: 이름·전화번호가 맞는 계정의 이메일을 일부 가려서 돌려준다 */
    @PostMapping("/find-ids")
    public FindLoginIdsResponse findLoginIds(@Valid @RequestBody FindLoginIdsRequest request,
            HttpServletRequest httpRequest) {
        rateLimiter.check("find-ids:ip:" + httpRequest.getRemoteAddr(), 10, Duration.ofMinutes(10));
        return new FindLoginIdsResponse(recoveryService.findLoginIds(request.name(), request.phone()));
    }

    /** 비밀번호 재설정: 이메일·이름·전화번호가 모두 맞으면 새 비밀번호로 바꾸고 기존 로그인을 끊는다 */
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody RecoverPasswordRequest request, HttpServletRequest httpRequest) {
        rateLimiter.check("reset-password:ip:" + httpRequest.getRemoteAddr(), 10, Duration.ofMinutes(10));
        rateLimiter.check("reset-password:id:" + LoginIds.normalize(request.loginId()), 5, Duration.ofMinutes(10));
        recoveryService.resetPassword(request.loginId(), request.name(), request.phone(), request.newPassword());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        UUID userId = LogService.currentActor();
        if (userId != null) {
            logs.auth(LogAction.LOGOUT, userId, logs.userName(userId) + " 로그아웃");
        }
        sessionLogin.clear(httpRequest, httpResponse);
    }
}
