package com.scoreroom.common.security;

import java.util.UUID;

/**
 * 로그인 사용자의 현재 상태를 DB에서 확인한다 (user 모듈이 구현).
 * 권한을 세션에 복사하지 않으므로 회수가 다음 요청부터 바로 반영된다.
 */
public interface UserAccessLookup {

    /** 존재하고 사용 가능한 계정인지 */
    boolean isActive(UUID userId);

    /** 시스템 관리자인지 */
    boolean isSysAdmin(UUID userId);
}
