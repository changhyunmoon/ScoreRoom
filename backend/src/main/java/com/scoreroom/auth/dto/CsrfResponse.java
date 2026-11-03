package com.scoreroom.auth.dto;

/** 쓰기 요청마다 headerName 헤더에 token 값을 실어 보낸다 */
public record CsrfResponse(String headerName, String token) {
}
