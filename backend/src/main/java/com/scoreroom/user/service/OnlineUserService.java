package com.scoreroom.user.service;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.SysAdminGuard;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.user.dto.OnlineUsersResponse;
import com.scoreroom.user.dto.OnlineUsersResponse.OnlineUser;
import com.scoreroom.user.dto.RoomOnlineResponse;

/**
 * 지금 로그인해 있는 사람. 로그인 세션 표(spring_session)에서 만료되지 않은 세션을 사람별로 묶는다.
 * 세션의 PRINCIPAL_NAME은 사용자 ID다 (UserSessionRevoker와 같은 값).
 */
@Service
@Transactional(readOnly = true)
public class OnlineUserService {

    /** 화면은 15초마다 서버에 확인 요청을 보낸다. 1분 넘게 요청이 없으면 창을 닫았거나 다른 탭을 보고 있는 것으로 본다 */
    public static final Duration ACTIVE_WITHIN = Duration.ofMinutes(1);

    private final NamedParameterJdbcTemplate jdbc;
    private final SysAdminGuard sysAdminGuard;
    private final RoomGuard roomGuard;
    private final Clock clock;

    public OnlineUserService(NamedParameterJdbcTemplate jdbc, SysAdminGuard sysAdminGuard, RoomGuard roomGuard, Clock clock) {
        this.jdbc = jdbc;
        this.sysAdminGuard = sysAdminGuard;
        this.roomGuard = roomGuard;
        this.clock = clock;
    }

    /** 룸 관리자: 이 평가룸 참여자만, 로그인하지 않은 사람도 함께. 접속 위치(IP·브라우저)는 보여 주지 않는다 */
    public RoomOnlineResponse listRoom(UUID projectId, UUID actorId) {
        if (!roomGuard.requireMember(projectId, actorId).isAdmin()) {
            throw ApiException.forbidden("룸 관리자만 가능합니다.");
        }
        long now = clock.millis();
        long activeSince = now - ACTIVE_WITHIN.toMillis();
        List<RoomOnlineResponse.Member> members = jdbc.query("""
                with live as (
                    select principal_name, max(last_access_time) as last_access
                    from spring_session
                    where expiry_time > :now
                    group by principal_name
                )
                select u.id, u.name, t.name as team_name, u.position, m.is_admin, live.last_access
                from memberships m
                join users u on u.id = m.user_id
                left join teams t on t.id = u.team_id
                left join live on live.principal_name = u.id::text
                where m.project_id = :projectId
                order by (live.last_access is not null) desc, u.name
                """, new MapSqlParameterSource("now", now).addValue("activeSince", activeSince).addValue("projectId", projectId),
                (rs, i) -> {
                    long last = rs.getLong("last_access");
                    boolean online = !rs.wasNull();
                    return new RoomOnlineResponse.Member(
                            rs.getObject("id", UUID.class),
                            rs.getString("name"),
                            rs.getString("team_name"),
                            rs.getString("position"),
                            rs.getBoolean("is_admin"),
                            online,
                            online && last >= activeSince,
                            online ? last : null);
                });
        return new RoomOnlineResponse(now, members);
    }

    public OnlineUsersResponse list(UUID actorId) {
        sysAdminGuard.require(actorId);
        long now = clock.millis();
        long activeSince = now - ACTIVE_WITHIN.toMillis();
        List<OnlineUser> users = jdbc.query("""
                with live as (
                    select principal_name::uuid as user_id, count(*) as sessions,
                           min(creation_time) as login_at, max(last_access_time) as last_access
                    from spring_session
                    where expiry_time > :now
                      and principal_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                    group by principal_name
                )
                select u.id, u.name, u.login_id, t.name as team_name, u.position, u.is_sys_admin,
                       live.sessions, live.login_at, live.last_access, last_login.ip, last_login.user_agent
                from live
                join users u on u.id = live.user_id
                left join teams t on t.id = u.team_id
                left join lateral (
                    select l.ip, l.user_agent from system_logs l
                    where l.actor_id = u.id and l.action = 'LOGIN_SUCCESS'
                    order by l.created_at desc limit 1
                ) last_login on true
                order by (live.last_access >= :activeSince) desc, live.last_access desc, u.name
                """, new MapSqlParameterSource("now", now).addValue("activeSince", activeSince),
                (rs, i) -> new OnlineUser(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("login_id"),
                        rs.getString("team_name"),
                        rs.getString("position"),
                        rs.getBoolean("is_sys_admin"),
                        rs.getInt("sessions"),
                        rs.getLong("login_at"),
                        rs.getLong("last_access"),
                        rs.getLong("last_access") >= activeSince,
                        rs.getString("ip"),
                        rs.getString("user_agent")));
        return new OnlineUsersResponse(now, users);
    }
}
