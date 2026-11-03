package com.scoreroom.auth.dto;

/** 로그인 화면에서 보여줄 기능. 회원가입은 운영 정책에 따라 켜고 끈다 */
public record AuthOptionsResponse(boolean signupEnabled) {
}
