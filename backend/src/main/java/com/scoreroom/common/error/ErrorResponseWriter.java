package com.scoreroom.common.error;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.scoreroom.common.web.RequestIdFilter;

import tools.jackson.databind.json.JsonMapper;

/** 컨트롤러 밖(보안 필터)에서도 같은 모양의 오류 응답을 쓴다 */
@Component
public class ErrorResponseWriter {

    private final JsonMapper jsonMapper;

    public ErrorResponseWriter(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, ErrorCode code, String message)
            throws IOException {
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError body = new ApiError(code.name(), message, List.of(), RequestIdFilter.of(request));
        response.getWriter().write(jsonMapper.writeValueAsString(body));
    }
}
