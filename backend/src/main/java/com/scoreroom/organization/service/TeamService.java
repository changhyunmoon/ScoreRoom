package com.scoreroom.organization.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.service.AuditService;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.organization.domain.Team;
import com.scoreroom.organization.dto.SaveTeamRequest;
import com.scoreroom.organization.dto.TeamResponse;
import com.scoreroom.organization.repository.TeamRepository;

/** 회사 팀 구조도 조회와 시스템 관리자의 팀 관리 */
@Service
public class TeamService {

    private final TeamRepository teams;
    private final SysAdminGuard sysAdminGuard;
    private final AuditService audit;

    public TeamService(TeamRepository teams, SysAdminGuard sysAdminGuard, AuditService audit) {
        this.teams = teams;
        this.sysAdminGuard = sysAdminGuard;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> list() {
        return teams.findByArchivedFalseOrderBySortOrderAscNameAsc().stream().map(TeamResponse::from).toList();
    }

    /** 사용 중인 팀을 찾는다. 없거나 보관된 팀이면 404 */
    @Transactional(readOnly = true)
    public Team requireActive(UUID teamId) {
        return teams.findById(teamId).filter(t -> !t.isArchived())
                .orElseThrow(() -> ApiException.notFound("팀을 찾을 수 없습니다."));
    }

    @Transactional
    public UUID create(UUID actorId, SaveTeamRequest request) {
        sysAdminGuard.require(actorId);
        UUID parentId = request.parentId();
        if (parentId != null) {
            requireActive(parentId);
        }
        int order = (parentId == null ? teams.findMaxRootSortOrder() : teams.findMaxChildSortOrder(parentId)) + 1;
        Team team = teams.save(new Team(request.name().trim(), parentId, order));
        audit.record(actorId, null, "TEAM_CREATED", 1);
        return team.getId();
    }

    @Transactional
    public void update(UUID actorId, UUID teamId, SaveTeamRequest request) {
        sysAdminGuard.require(actorId);
        Team team = requireActive(teamId);
        // 자기 자신이나 하위 팀을 상위 팀으로 지정하면 순환이 생긴다
        for (UUID p = request.parentId(); p != null; p = requireActive(p).getParentId()) {
            if (p.equals(teamId)) {
                throw ApiException.badRequest("하위 팀을 상위 팀으로 지정할 수 없습니다.");
            }
        }
        team.rename(request.name().trim());
        team.moveUnder(request.parentId());
        audit.record(actorId, null, "TEAM_UPDATED", 1);
    }

    /** 하위 팀이나 소속 사용자가 있으면 거절한다. 과거 참여 기록이 가리키는 팀은 보관 처리한다 */
    @Transactional
    public void delete(UUID actorId, UUID teamId) {
        sysAdminGuard.require(actorId);
        Team team = requireActive(teamId);
        if (teams.existsByParentIdAndArchivedFalse(teamId)) {
            throw ApiException.badRequest("하위 팀이 있는 팀은 삭제할 수 없습니다.");
        }
        if (teams.hasUsers(teamId)) {
            throw ApiException.badRequest("소속 사용자가 있는 팀은 삭제할 수 없습니다.");
        }
        if (teams.isReferencedByMemberships(teamId) || teams.existsByParentId(teamId)) {
            team.archive();
        } else {
            teams.delete(team);
        }
        audit.record(actorId, null, "TEAM_DELETED", 1);
    }
}
