package com.scoreroom.user.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.security.UserAccessLookup;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;

/** 다른 모듈이 로그인 사용자의 현재 상태를 확인할 때 쓰는 진입점 */
@Service
public class UserAccessService implements UserAccessLookup {

    private final UserRepository users;

    public UserAccessService(UserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isActive(UUID userId) {
        return users.existsByIdAndEnabledTrue(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isSysAdmin(UUID userId) {
        return users.existsByIdAndSysAdminTrue(userId);
    }

    /** 로그인 사용자를 불러온다. 보안 필터가 이미 활성 여부를 확인했다 */
    @Transactional(readOnly = true)
    public User require(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED, "로그인이 필요합니다."));
    }

    @Transactional(readOnly = true)
    public User requireOther(UUID userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
    }
}
