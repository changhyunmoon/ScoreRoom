package com.scoreroom.log.dto;

/** 화면(브라우저)에서 난 오류. 길이는 서버에서 잘라 저장한다 */
public record ClientErrorRequest(String message, String stack, String url, String componentStack) {
}
