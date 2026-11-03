package com.scoreroom.common.security;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.error.ErrorResponseWriter;

/** 비활성화되거나 삭제된 계정의 세션은 즉시 끊는다 */
class ActiveUserFilter extends OncePerRequestFilter {

    private final UserAccessLookup checker;
    private final ErrorResponseWriter errorWriter;

    ActiveUserFilter(UserAccessLookup checker, ErrorResponseWriter errorWriter) {
        this.checker = checker;
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                && !checker.isActive(user.userId())) {
            SecurityContextHolder.clearContext();
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            errorWriter.write(request, response, ErrorCode.UNAUTHENTICATED, "로그인이 만료되었습니다. 다시 로그인해 주세요.");
            return;
        }
        chain.doFilter(request, response);
    }
}
