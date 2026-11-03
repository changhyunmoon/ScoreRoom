package com.scoreroom.auth.controller;

import java.time.Duration;

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
import com.scoreroom.auth.dto.LoginRequest;
import com.scoreroom.auth.dto.SignupRequest;
import com.scoreroom.auth.service.AuthService;
import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.RateLimiter;
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
    private final ProfileService profileService;
    private final SessionLogin sessionLogin;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService authService, ProfileService profileService, SessionLogin sessionLogin,
            RateLimiter rateLimiter) {
        this.authService = authService;
        this.profileService = profileService;
        this.sessionLogin = sessionLogin;
        this.rateLimiter = rateLimiter;
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
        rateLimiter.check("login:ip:" + httpRequest.getRemoteAddr(), 30, Duration.ofMinutes(1));
        rateLimiter.check("login:id:" + LoginIds.normalize(request.loginId()), 10, Duration.ofMinutes(5));
        Authentication authentication = authService.authenticate(request.loginId(), request.password());
        sessionLogin.establish(authentication, httpRequest, httpResponse);
        return profileService.me(((AuthenticatedUser) authentication.getPrincipal()).userId());
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

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        sessionLogin.clear(httpRequest, httpResponse);
    }
}
