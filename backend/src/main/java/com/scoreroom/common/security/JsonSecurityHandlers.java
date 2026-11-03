package com.scoreroom.common.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.stereotype.Component;

import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.error.ErrorResponseWriter;

/** 보안 필터의 401·403을 JSON 오류로 응답한다. CSRF 실패는 별도 코드로 구분한다 */
@Component
public class JsonSecurityHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ErrorResponseWriter errorWriter;

    public JsonSecurityHandlers(ErrorResponseWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        errorWriter.write(request, response, ErrorCode.UNAUTHENTICATED, "로그인이 필요합니다.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
            throws IOException {
        if (e instanceof CsrfException) {
            errorWriter.write(request, response, ErrorCode.CSRF_INVALID, "보안 토큰이 만료되었습니다. 다시 시도해 주세요.");
            return;
        }
        errorWriter.write(request, response, ErrorCode.FORBIDDEN, "권한이 없습니다.");
    }
}
