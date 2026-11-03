package com.scoreroom.common.security;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.scoreroom.common.error.ApiException;

/** 시스템 관리자 전용 기능의 권한 확인 */
@Component
public class SysAdminGuard {

    private final UserAccessLookup lookup;

    public SysAdminGuard(UserAccessLookup lookup) {
        this.lookup = lookup;
    }

    public void require(UUID actorId) {
        if (!lookup.isSysAdmin(actorId)) {
            throw ApiException.forbidden("시스템 관리자만 가능합니다.");
        }
    }
}
