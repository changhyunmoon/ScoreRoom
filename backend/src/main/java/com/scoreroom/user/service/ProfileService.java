package com.scoreroom.user.service;

import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.UserSessionRevoker;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.organization.service.TeamService;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.dto.UpdateProfileRequest;
import com.scoreroom.user.dto.UserResponse;

/** 내 정보 조회와 수정 */
@Service
public class ProfileService {

    private final UserAccessService userAccess;
    private final UserRegistrar registrar;
    private final TeamService teamService;
    private final UserSessionRevoker sessionRevoker;
    private final LogService logs;

    public ProfileService(UserAccessService userAccess, UserRegistrar registrar, TeamService teamService,
            UserSessionRevoker sessionRevoker, LogService logs) {
        this.userAccess = userAccess;
        this.registrar = registrar;
        this.teamService = teamService;
        this.sessionRevoker = sessionRevoker;
        this.logs = logs;
    }

    @Transactional(readOnly = true)
    public UserResponse me(UUID userId) {
        return UserResponse.of(userAccess.require(userId), true);
    }

    /**
     * 비밀번호를 바꾸면 현재 비밀번호를 확인하고, 다른 기기의 세션을 모두 끊는다.
     * 지금 쓰는 세션은 컨트롤러가 응답 전에 끊는다 (새 비밀번호로 다시 로그인). 비밀번호를 바꿨으면 true.
     * 팀을 옮기면 새 팀의 맨 아래로 간다. 평가룸 참여 당시 소속(스냅샷)은 바뀌지 않는다.
     */
    @Transactional
    public boolean update(UUID userId, UpdateProfileRequest request, String currentSessionId) {
        User user = userAccess.require(userId);
        String loginId = registrar.requireUnusedLoginId(request.loginId(), userId);
        if (!user.isSysAdmin()) {
            UUID teamId = request.teamId();
            if (!Objects.equals(teamId, user.getTeamId())) {
                if (teamId != null) {
                    teamService.requireActive(teamId);
                }
                user.moveToTeam(teamId, registrar.nextSortOrder(teamId));
            }
            user.changePosition(UserRegistrar.trimToEmpty(request.position()));
        }
        user.updateContact(loginId, request.name().trim(), request.phone().trim());

        if (request.newPassword() != null && !request.newPassword().isEmpty()) {
            if (!registrar.matches(request.currentPassword(), user.getPasswordHash())) {
                throw ApiException.badRequest("현재 비밀번호가 맞지 않습니다.");
            }
            user.changePassword(registrar.encode(request.newPassword()));
            sessionRevoker.revokeAll(userId, currentSessionId);
            logs.activity(userId, null, LogAction.PASSWORD_CHANGED, user.getName() + " 비밀번호 변경 (모든 기기 로그아웃)");
            return true;
        }
        return false;
    }
}
