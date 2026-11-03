package com.scoreroom.user.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.common.security.UserSessionRevoker;
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
    private final AuditService audit;

    public UserAdminService(UserRepository users, UserAccessService userAccess, UserRegistrar registrar,
            TeamService teamService, SysAdminGuard sysAdminGuard, UserSessionRevoker sessionRevoker, AuditService audit) {
        this.users = users;
        this.userAccess = userAccess;
        this.registrar = registrar;
        this.teamService = teamService;
        this.sysAdminGuard = sysAdminGuard;
        this.sessionRevoker = sessionRevoker;
        this.audit = audit;
    }

    @Transactional
    public UUID addToTeam(UUID actorId, UUID teamId, CreateUserRequest request) {
        sysAdminGuard.require(actorId);
        teamService.requireActive(teamId);
        User user = registrar.registerMember(request.loginId(), request.password(), request.name(), request.phone(),
                teamId, request.position());
        audit.record(actorId, null, "USER_CREATED", 1);
        return user.getId();
    }

    @Transactional
    public void setTeam(UUID actorId, UUID userId, UUID teamId) {
        sysAdminGuard.require(actorId);
        User user = requireMemberUser(userId);
        if (Objects.equals(user.getTeamId(), teamId)) {
            return;
        }
        if (teamId != null) {
            teamService.requireActive(teamId);
        }
        user.moveToTeam(teamId, registrar.nextSortOrder(teamId));
        audit.record(actorId, null, "USER_TEAM_CHANGED", 1);
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
        requireMemberUser(userId).changePosition(UserRegistrar.trimToEmpty(position));
    }

    @Transactional
    public void setViewAll(UUID actorId, UUID userId, boolean enabled) {
        sysAdminGuard.require(actorId);
        userAccess.requireOther(userId).setViewAll(enabled);
        audit.record(actorId, null, enabled ? "VIEW_ALL_GRANTED" : "VIEW_ALL_REVOKED", 1);
    }

    /** 비밀번호를 잊은 사용자를 위한 관리자 재설정. 그 사용자의 모든 세션을 끊는다 */
    @Transactional
    public void resetPassword(UUID actorId, UUID userId, String password) {
        sysAdminGuard.require(actorId);
        User user = userAccess.requireOther(userId);
        user.changePassword(registrar.encode(password));
        sessionRevoker.revokeAll(userId, null);
        audit.record(actorId, null, "USER_PASSWORD_RESET", 1);
    }

    private User requireMemberUser(UUID userId) {
        User user = userAccess.requireOther(userId);
        if (user.isSysAdmin()) {
            throw ApiException.notFound("사용자를 찾을 수 없습니다.");
        }
        return user;
    }
}
