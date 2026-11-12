package com.scoreroom.project.service;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.presentation.service.PresentationRemover;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.dto.RoomOverviewResponse;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.user.service.UserAccessService;

/**
 * 평가룸 삭제와 시스템 관리자용 평가룸 목록.
 * 삭제는 그 평가룸의 룸 관리자 또는 시스템 관리자만 할 수 있고, 마감된 평가룸도 지울 수 있다.
 * 발표(평가·자료·구성원) → 남은 평가 → 입장 코드·알림 → 참여자 → 평가룸 순서로 지우고, 자료 파일은 커밋 후 지운다.
 * 감사 기록은 남기되 평가룸 연결만 끊는다.
 */
@Service
public class ProjectRemovalService {

    private final ProjectRepository projects;
    private final MembershipRepository memberships;
    private final PresentationRepository presentations;
    private final PresentationRemover presentationRemover;
    private final RatingRepository ratings;
    private final UserAccessService userAccess;
    private final SysAdminGuard sysAdminGuard;
    private final LogService logs;
    private final JdbcTemplate jdbc;

    public ProjectRemovalService(ProjectRepository projects, MembershipRepository memberships, PresentationRepository presentations,
            PresentationRemover presentationRemover, RatingRepository ratings, UserAccessService userAccess,
            SysAdminGuard sysAdminGuard, LogService logs,
            JdbcTemplate jdbc) {
        this.projects = projects;
        this.memberships = memberships;
        this.presentations = presentations;
        this.presentationRemover = presentationRemover;
        this.ratings = ratings;
        this.userAccess = userAccess;
        this.sysAdminGuard = sysAdminGuard;
        this.logs = logs;
        this.jdbc = jdbc;
    }

    @Transactional
    public void delete(UUID actorId, UUID projectId) {
        boolean sysAdmin = userAccess.require(actorId).isSysAdmin();
        Project project = projects.findByIdForUpdate(projectId)
                .orElseThrow(() -> ApiException.notFound("평가룸을 찾을 수 없습니다."));
        boolean roomAdmin = memberships.findByProjectIdAndUserId(projectId, actorId).map(m -> m.isAdmin()).orElse(false);
        if (!sysAdmin && !roomAdmin) {
            throw ApiException.forbidden("룸 관리자 또는 시스템 관리자만 평가룸을 삭제할 수 있습니다.");
        }
        // 지우기 전에 남긴다 (로그는 FK가 없어 평가룸이 지워져도 남는다)
        List<Presentation> all = presentations.findByProjectIdIn(List.of(projectId));
        List<Rating> allRatings = ratings.findByProjectId(projectId);
        logs.activity(actorId, projectId, LogAction.PROJECT_DELETED,
                "'" + project.getName() + "' 평가룸 삭제 (" + (sysAdmin ? "시스템 관리자" : "룸 관리자") + ") · 참여자 "
                        + memberships.findByProjectId(projectId).size() + "명 · 발표 " + all.size() + "개 · 평가 "
                        + allRatings.size() + "건",
                allRatings.isEmpty() ? null : "삭제된 평가\n" + logs.describeRatings(allRatings));
        for (Presentation p : all) {
            presentationRemover.remove(p, null);
        }
        jdbc.update("delete from ratings where project_id = ?", projectId);
        jdbc.update("delete from invite_codes where project_id = ?", projectId);
        jdbc.update("delete from notifications where project_id = ?", projectId);
        jdbc.update("update audit_events set project_id = null where project_id = ?", projectId);
        jdbc.update("delete from memberships where project_id = ?", projectId);
        jdbc.update("delete from projects where id = ?", project.getId());
    }

    /** 시스템 관리자: 모든 평가룸 (최근 만든 순) */
    @Transactional(readOnly = true)
    public List<RoomOverviewResponse> listAll(UUID actorId) {
        sysAdminGuard.require(actorId);
        return jdbc.query("""
                select p.id, p.name, p.description, p.status, p.created_at, u.name as creator,
                  (select count(*) from memberships m where m.project_id = p.id) as members,
                  (select count(*) from presentations pr where pr.project_id = p.id) as presentations,
                  (select count(*) from ratings r where r.project_id = p.id) as ratings,
                  (select string_agg(au.name, ', ' order by au.name) from memberships am join users au on au.id = am.user_id
                     where am.project_id = p.id and am.is_admin) as admins
                from projects p left join users u on u.id = p.created_by
                order by p.created_at desc
                """, (rs, i) -> new RoomOverviewResponse(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"), rs.getString("status"),
                rs.getTimestamp("created_at").getTime(), rs.getString("creator"), rs.getString("admins"),
                rs.getInt("members"), rs.getInt("presentations"), rs.getInt("ratings")));
    }
}
