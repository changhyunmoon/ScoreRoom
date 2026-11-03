package com.scoreroom.common.security;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

/**
 * 세션에 저장하는 로그인 주체. 사용자 ID만 둔다.
 * 시스템 관리자·전체 열람 권한은 요청마다 DB의 현재 값으로 확인해 회수가 바로 반영되게 한다.
 * getName()은 Spring Session이 사용자별 세션을 찾는 색인으로 쓴다.
 */
public record AuthenticatedUser(UUID userId) implements Principal, Serializable {

    @Override
    public String getName() {
        return userId.toString();
    }
}
