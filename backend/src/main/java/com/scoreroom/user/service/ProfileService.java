package com.scoreroom.user.service;

import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.UserSessionRevoker;
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

    public ProfileService(UserAccessService userAccess, UserRegistrar registrar, TeamService teamService,
            UserSessionRevoker sessionRevoker) {
        this.userAccess = userAccess;
        this.registrar = registrar;
        this.teamService = teamService;
        this.sessionRevoker = sessionRevoker;
    }

    @Transactional(readOnly = true)
    public UserResponse me(UUID userId) {
        return UserResponse.of(userAccess.require(userId), true);
    }

    /**
     * 비밀번호를 바꾸면 현재 비밀번호를 확인하고, 지금 쓰는 세션을 뺀 나머지 세션을 끊는다.
     * 팀을 옮기면 새 팀의 맨 아래로 간다. 평가룸 참여 당시 소속(스냅샷)은 바뀌지 않는다.
     */
    @Transactional
    public void update(UUID userId, UpdateProfileRequest request, String currentSessionId) {
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
        }
    }
}
