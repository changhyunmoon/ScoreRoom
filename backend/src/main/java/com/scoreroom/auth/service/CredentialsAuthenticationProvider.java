package com.scoreroom.auth.service;

import java.util.List;
import java.util.Optional;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.domain.LoginIds;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;

/** 이메일·비밀번호 확인. 성공하면 사용자 ID만 담은 인증 객체를 만든다 */
@Component
public class CredentialsAuthenticationProvider implements AuthenticationProvider {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    /** 없는 계정도 같은 시간이 걸리도록 비교할 해시 (계정 존재 여부 추측 방지) */
    private final String dummyHash;

    public CredentialsAuthenticationProvider(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
    }

    @Override
    @Transactional(readOnly = true)
    public Authentication authenticate(Authentication authentication) {
        String loginId = LoginIds.normalize(authentication.getName());
        String password = String.valueOf(authentication.getCredentials());
        Optional<User> user = users.findByLoginId(loginId);
        boolean matches = passwordEncoder.matches(password, user.map(User::getPasswordHash).orElse(dummyHash));
        if (user.isEmpty() || !matches || !user.get().isEnabled()) {
            throw new BadCredentialsException("invalid credentials");
        }
        return UsernamePasswordAuthenticationToken.authenticated(new AuthenticatedUser(user.get().getId()), null, List.of());
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
