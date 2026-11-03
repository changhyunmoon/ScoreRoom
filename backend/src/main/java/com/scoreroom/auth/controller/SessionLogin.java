package com.scoreroom.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/**
 * 인증 결과를 세션에 저장하고 지운다.
 * Spring Security의 폼 로그인과 같은 순서(세션 ID 교체 → CSRF 토큰 교체 → SecurityContext 저장)를 따른다.
 */
@Component
class SessionLogin {

    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextRepository contextRepository;
    private final SecurityContextHolderStrategy holder = SecurityContextHolder.getContextHolderStrategy();

    SessionLogin(SessionAuthenticationStrategy sessionStrategy, SecurityContextRepository contextRepository) {
        this.sessionStrategy = sessionStrategy;
        this.contextRepository = contextRepository;
    }

    void establish(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true);
        sessionStrategy.onAuthentication(authentication, request, response);
        SecurityContext context = holder.createEmptyContext();
        context.setAuthentication(authentication);
        holder.setContext(context);
        contextRepository.saveContext(context, request, response);
    }

    void clear(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response, holder.getContext().getAuthentication());
    }
}
