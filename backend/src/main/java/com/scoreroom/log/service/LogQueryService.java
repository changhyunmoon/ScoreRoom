package com.scoreroom.log.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.domain.LogCategory;
import com.scoreroom.log.dto.LogActionsResponse;
import com.scoreroom.log.dto.LogEntryResponse;
import com.scoreroom.log.dto.LogPageResponse;
import com.scoreroom.log.dto.LogQuery;
import com.scoreroom.log.dto.LogSummaryResponse;

/** 시스템 관리자 로그 화면의 조회. 최신순, (created_at, id) 커서로 넘긴다 */
@Service
@Transactional(readOnly = true)
public class LogQueryService {

    public static final int LIST_DETAIL_MAX = 300;
    private static final int MAX_SIZE = 200;

    private final NamedParameterJdbcTemplate jdbc;
    private final SysAdminGuard sysAdminGuard;
    private final Clock clock;

    public LogQueryService(NamedParameterJdbcTemplate jdbc, SysAdminGuard sysAdminGuard, Clock clock) {
        this.jdbc = jdbc;
        this.sysAdminGuard = sysAdminGuard;
        this.clock = clock;
    }

    public LogActionsResponse actions(UUID actorId) {
        sysAdminGuard.require(actorId);
        return new LogActionsResponse(
                Arrays.stream(LogCategory.values()).map(c -> new LogActionsResponse.Category(c.name(), c.label())).toList(),
                Arrays.stream(LogAction.values()).map(a -> new LogActionsResponse.Action(
                        a.name(), a.category().name(), a.label(), a.level().name())).toList());
    }

    public LogPageResponse list(UUID actorId, LogQuery query, String cursor, int size) {
        sysAdminGuard.require(actorId);
        int limit = Math.clamp(size, 1, MAX_SIZE);
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = where(query, params);
        if (cursor != null && !cursor.isBlank()) {
            // 커서는 앞 페이지 마지막 로그의 ID. 시각을 DB 정밀도(마이크로초) 그대로 비교하려고 DB에서 다시 읽는다
            where.append(" and (created_at, id) < (select c.created_at, c.id from system_logs c where c.id = :cursorId)");
            params.addValue("cursorId", parseCursor(cursor));
        }
        params.addValue("limit", limit + 1);
        List<LogEntryResponse> rows = jdbc.query("""
                select id, created_at, category, level, action, message, actor_id, actor_name, project_id, project_name,
                       request_id, http_method, path, status, ip, user_agent, error_type,
                       left(detail, %d) as detail, length(detail) > %d as detail_truncated
                from system_logs
                """.formatted(LIST_DETAIL_MAX, LIST_DETAIL_MAX)
                + where + " order by created_at desc, id desc limit :limit", params, LogQueryService::row);
        String next = null;
        if (rows.size() > limit) {
            rows = new ArrayList<>(rows.subList(0, limit));
            LogEntryResponse last = rows.getLast();
            next = last.id().toString();
        }
        return new LogPageResponse(rows, next);
    }

    public LogEntryResponse get(UUID actorId, UUID id) {
        sysAdminGuard.require(actorId);
        List<LogEntryResponse> rows = jdbc.query("""
                select id, created_at, category, level, action, message, actor_id, actor_name, project_id, project_name,
                       request_id, http_method, path, status, ip, user_agent, error_type, detail, false as detail_truncated
                from system_logs where id = :id
                """, new MapSqlParameterSource("id", id), LogQueryService::row);
        if (rows.isEmpty()) {
            throw ApiException.notFound("로그를 찾을 수 없습니다. 보관 기간이 지나 지워졌을 수 있습니다.");
        }
        return rows.getFirst();
    }

    /** 카테고리·항목 건수. 기간·평가룸·검색어만 적용한다 (버튼마다 건수를 보여 주므로 카테고리·항목 조건은 빼고 센다) */
    public LogSummaryResponse summary(UUID actorId, LogQuery query) {
        sysAdminGuard.require(actorId);
        LogQuery scope = new LogQuery(null, null, null, query.projectId(), query.from(), query.to(), query.q());
        Map<String, Long> byCategory = new LinkedHashMap<>();
        Map<String, Long> byAction = new LinkedHashMap<>();
        count(scope, byCategory, byAction);

        Map<String, Long> recentCategory = new LinkedHashMap<>();
        Map<String, Long> recentAction = new LinkedHashMap<>();
        Instant now = clock.instant();
        count(new LogQuery(null, null, null, null, now.minus(Duration.ofHours(24)), null, null),
                recentCategory, recentAction);

        Long lastServerError = jdbc.query(
                "select max(created_at) from system_logs where category = 'SERVER_ERROR' and level = 'ERROR'",
                new MapSqlParameterSource(), rs -> {
                    rs.next();
                    Timestamp t = rs.getTimestamp(1);
                    return t == null ? null : t.getTime();
                });
        return new LogSummaryResponse(byCategory, byAction, recentCategory, recentAction, lastServerError);
    }

    private void count(LogQuery query, Map<String, Long> byCategory, Map<String, Long> byAction) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String sql = "select category, action, count(*) as n from system_logs" + where(query, params)
                + " group by category, action";
        jdbc.query(sql, params, rs -> {
            String category = rs.getString("category");
            String action = rs.getString("action");
            long n = rs.getLong("n");
            byCategory.merge(category, n, Long::sum);
            byAction.merge(action, n, Long::sum);
        });
    }

    private static StringBuilder where(LogQuery query, MapSqlParameterSource params) {
        StringBuilder where = new StringBuilder(" where 1 = 1");
        if (notEmpty(query.categories())) {
            where.append(" and category in (:categories)");
            params.addValue("categories", query.categories());
        }
        if (notEmpty(query.actions())) {
            where.append(" and action in (:actions)");
            params.addValue("actions", query.actions());
        }
        if (notEmpty(query.levels())) {
            where.append(" and level in (:levels)");
            params.addValue("levels", query.levels());
        }
        if (query.projectId() != null) {
            where.append(" and project_id = :projectId");
            params.addValue("projectId", query.projectId());
        }
        if (query.from() != null) {
            where.append(" and created_at >= :from");
            params.addValue("from", Timestamp.from(query.from()));
        }
        if (query.to() != null) {
            where.append(" and created_at < :to");
            params.addValue("to", Timestamp.from(query.to()));
        }
        if (query.q() != null && !query.q().isBlank()) {
            where.append(" and (actor_name ilike :q escape '\\' or project_name ilike :q escape '\\'"
                    + " or message ilike :q escape '\\' or request_id ilike :q escape '\\')");
            params.addValue("q", "%" + escapeLike(query.q().trim()) + "%");
        }
        return where;
    }

    private static boolean notEmpty(List<String> values) {
        return values != null && !values.isEmpty();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static LogEntryResponse row(ResultSet rs, int i) throws SQLException {
        return new LogEntryResponse(
                rs.getObject("id", UUID.class),
                rs.getTimestamp("created_at").getTime(),
                rs.getString("category"),
                rs.getString("level"),
                rs.getString("action"),
                rs.getString("message"),
                rs.getObject("actor_id", UUID.class),
                rs.getString("actor_name"),
                rs.getObject("project_id", UUID.class),
                rs.getString("project_name"),
                rs.getString("request_id"),
                rs.getString("http_method"),
                rs.getString("path"),
                (Integer) rs.getObject("status"),
                rs.getString("ip"),
                rs.getString("user_agent"),
                rs.getString("error_type"),
                rs.getString("detail"),
                rs.getBoolean("detail_truncated"));
    }

    private static UUID parseCursor(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "페이지 정보가 올바르지 않습니다.");
        }
    }
}
