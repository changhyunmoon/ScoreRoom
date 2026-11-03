package com.scoreroom.auth.service;

import java.util.List;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.auth.dto.SignupRequest;
import com.scoreroom.common.config.AppProperties;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.service.UserRegistrar;

/** 자격 증명 확인과 가입. 세션 저장은 컨트롤러의 SessionLogin이 맡는다 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRegistrar registrar;
    private final AppProperties properties;

    public AuthService(CredentialsAuthenticationProvider credentialsProvider, UserRegistrar registrar,
            AppProperties properties) {
        this.authenticationManager = new ProviderManager(credentialsProvider);
        this.registrar = registrar;
        this.properties = properties;
    }

    public Authentication authenticate(String loginId, String password) {
        try {
            return authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(loginId, password));
        } catch (AuthenticationException e) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }
    }

    public boolean isSignupEnabled() {
        return properties.auth().signupEnabled();
    }

    /** 공개 가입. 운영 가입 정책이 정해지기 전에는 설정으로 꺼 둔다 */
    @Transactional
    public Authentication signup(SignupRequest request) {
        if (!isSignupEnabled()) {
            throw new ApiException(ErrorCode.FORBIDDEN, "회원가입은 시스템 관리자에게 요청해 주세요.");
        }
        User user = registrar.registerMember(request.loginId(), request.password(), request.name(), request.phone(),
                request.teamId(), request.position());
        return UsernamePasswordAuthenticationToken.authenticated(new AuthenticatedUser(user.getId()), null, List.of());
    }
}
