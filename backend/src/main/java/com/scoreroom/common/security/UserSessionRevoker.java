package com.scoreroom.common.security;

import java.util.UUID;

import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.stereotype.Component;

/** 비밀번호를 바꾸거나 재설정하면 그 사용자의 다른 세션을 끊는다 */
@Component
public class UserSessionRevoker {

    private final FindByIndexNameSessionRepository<?> sessions;

    public UserSessionRevoker(FindByIndexNameSessionRepository<?> sessions) {
        this.sessions = sessions;
    }

    /** keepSessionId가 null이면 모든 세션을 끊는다 */
    public void revokeAll(UUID userId, String keepSessionId) {
        sessions.findByPrincipalName(userId.toString()).keySet().stream()
                .filter(id -> !id.equals(keepSessionId))
                .forEach(sessions::deleteById);
    }
}
