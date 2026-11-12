package com.scoreroom.log.controller;

import java.time.Duration;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.web.RateLimiter;
import com.scoreroom.log.dto.ClientErrorRequest;
import com.scoreroom.log.service.LogService;

/** 화면(브라우저) 오류 수집. 로그인 전 화면에서도 보낼 수 있다 (CSRF 토큰은 필요) */
@RestController
@RequestMapping("/api/v1/client-errors")
public class ClientErrorController {

    private final LogService logs;
    private final RateLimiter rateLimiter;

    public ClientErrorController(LogService logs, RateLimiter rateLimiter) {
        this.logs = logs;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@RequestBody ClientErrorRequest request, HttpServletRequest httpRequest) {
        try {
            rateLimiter.check("client-error:ip:" + httpRequest.getRemoteAddr(), 20, Duration.ofMinutes(1));
        } catch (ApiException e) {
            return; // 같은 오류가 반복되는 화면이 로그를 덮지 않게 조용히 버린다
        }
        logs.clientError(request.message(), request.stack(), request.url(), request.componentStack());
    }
}
