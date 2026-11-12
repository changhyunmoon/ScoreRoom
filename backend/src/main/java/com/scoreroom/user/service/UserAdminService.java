package com.scoreroom.user.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.common.security.UserSessionRevoker;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.organization.service.TeamService;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.dto.CreateUserRequest;
import com.scoreroom.user.repository.UserRepository;

/** 시스템 관리자의 사용자 관리: 등록, 팀 배정, 팀 안 순서, 직위, 전체 열람 권한, 비밀번호 재설정 */
@Service
public class UserAdminService {

    private final UserRepository users;
    private final UserAccessService userAccess;
    private final UserRegistrar registrar;
    private final TeamService teamService;
    private final SysAdminGuard sysAdminGuard;
    private final UserSessionRevoker sessionRevoker;
    private final LogService logs;

    public UserAdminService(UserRepository users, UserAccessService userAccess, UserRegistrar registrar,
            TeamService teamService, SysAdminGuard sysAdminGuard, UserSessionRevoker sessionRevoker, LogService logs) {
        this.users = users;
        this.userAccess = userAccess;
        this.registrar = registrar;
        this.teamService = teamService;
        this.sysAdminGuard = sysAdminGuard;
        this.sessionRevoker = sessionRevoker;
        this.logs = logs;
    }

    @Transactional
    public UUID addToTeam(UUID actorId, UUID teamId, CreateUserRequest request) {
        sysAdminGuard.require(actorId);
        String teamName = teamService.requireActive(teamId).getName();
        User user = registrar.registerMember(request.loginId(), request.password(), request.name(), request.phone(),
                teamId, request.position());
        logs.activity(actorId, null, LogAction.USER_CREATED,
                user.getName() + " 사용자 추가 (" + teamName + ", " + user.getLoginId() + ")");
        return user.getId();
    }

    @Transactional
    public void setTeam(UUID actorId, UUID userId, UUID teamId) {
        sysAdminGuard.require(actorId);
        User user = requireMemberUser(userId);
        if (Objects.equals(user.getTeamId(), teamId)) {
            return;
        }
        String before = user.getTeamId() == null ? "(소속 없음)" : teamService.requireActive(user.getTeamId()).getName();
        String after = teamId == null ? "(소속 없음)" : teamService.requireActive(teamId).getName();
        user.moveToTeam(teamId, registrar.nextSortOrder(teamId));
        logs.activity(actorId, null, LogAction.USER_TEAM_CHANGED, user.getName() + " 팀 변경: " + before + " → " + after);
    }

    /** 팀 안에서 한 칸 위(-1)·아래(+1)로 옮긴다. 순서를 0부터 다시 매긴 뒤 이웃과 바꾼다 */
    @Transactional
    public void move(UUID actorId, UUID userId, int dir) {
        sysAdminGuard.require(actorId);
        User user = requireMemberUser(userId);
        List<User> list = new ArrayList<>(user.getTeamId() == null
                ? users.findByTeamIdIsNullAndSysAdminFalseOrderBySortOrderAscNameAsc()
                : users.findByTeamIdAndSysAdminFalseOrderBySortOrderAscNameAsc(user.getTeamId()));
        for (int i = 0; i < list.size(); i++) {
            list.get(i).changeSortOrder(i);
        }
        int from = list.indexOf(user);
        int to = from + Integer.signum(dir);
        if (to < 0 || to >= list.size()) {
            return;
        }
        list.get(from).changeSortOrder(to);
        list.get(to).changeSortOrder(from);
    }

    @Transactional
    public void setPosition(UUID actorId, UUID userId, String position) {
        sysAdminGuard.require(actorId);
        User user = requireMemberUser(userId);
        String before = user.getPosition();
        user.changePosition(UserRegistrar.trimToEmpty(position));
        if (!Objects.equals(before, user.getPosition())) {
            logs.activity(actorId, null, LogAction.USER_POSITION_CHANGED, user.getName() + " 직급 변경: "
                    + orNone(before) + " → " + orNone(user.getPosition()));
        }
    }

    private static String orNone(String position) {
        return position == null || position.isEmpty() ? "(없음)" : position;
    }

    @Transactional
    public void setViewAll(UUID actorId, UUID userId, boolean enabled) {
        sysAdminGuard.require(actorId);
        User user = userAccess.requireOther(userId);
        user.setViewAll(enabled);
        logs.activity(actorId, null, enabled ? LogAction.VIEW_ALL_GRANTED : LogAction.VIEW_ALL_REVOKED,
                user.getName() + " 전체 열람 권한 " + (enabled ? "부여" : "회수"));
    }

    /** 평가룸 생성 권한을 주거나 회수한다. 회수해도 이미 만든 평가룸은 그대로다 */
    @Transactional
    public void setCreateRoom(UUID actorId, UUID userId, boolean enabled) {
        sysAdminGuard.require(actorId);
        User user = userAccess.requireOther(userId);
        user.setCreateRoom(enabled);
        logs.activity(actorId, null, enabled ? LogAction.CREATE_ROOM_GRANTED : LogAction.CREATE_ROOM_REVOKED,
                user.getName() + " 평가룸 생성 권한 " + (enabled ? "부여" : "회수"));
    }

    /** 비밀번호를 잊은 사용자를 위한 관리자 재설정. 그 사용자의 모든 세션을 끊는다 */
    @Transactional
    public void resetPassword(UUID actorId, UUID userId, String password) {
        sysAdminGuard.require(actorId);
        User user = userAccess.requireOther(userId);
        user.changePassword(registrar.encode(password));
        sessionRevoker.revokeAll(userId, null);
        logs.activity(actorId, null, LogAction.USER_PASSWORD_RESET, user.getName() + " 비밀번호 초기화");
    }

    private User requireMemberUser(UUID userId) {
        User user = userAccess.requireOther(userId);
        if (user.isSysAdmin()) {
            throw ApiException.notFound("사용자를 찾을 수 없습니다.");
        }
        return user;
    }
}
