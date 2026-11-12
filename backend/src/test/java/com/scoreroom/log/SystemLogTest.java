package com.scoreroom.log;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.log.service.LogRetentionJob;
import com.scoreroom.organization.domain.Team;
import com.scoreroom.support.IntegrationTest;
import com.scoreroom.support.TestFixtures;
import com.scoreroom.user.domain.User;

class SystemLogTest extends IntegrationTest {

    @Autowired
    private LogRetentionJob retentionJob;

    /** 서버 오류(500)를 일부러 내는 테스트 전용 주소 */
    @TestConfiguration
    static class BoomConfig {
        @Bean
        BoomController boomController() {
            return new BoomController();
        }
    }

    @RestController
    static class BoomController {
        @GetMapping("/api/v1/test-boom")
        String boom() {
            throw new IllegalStateException("일부러 낸 오류");
        }
    }

    private Map<String, Object> last(String action) {
        return jdbc.queryForMap("select * from system_logs where action = ? order by created_at desc limit 1", action);
    }

    @Test
    void 점수_제출과_수정은_점수와_피드백을_남긴다() throws Exception {
        Team a = fixtures.team("A팀");
        Team b = fixtures.team("B팀");
        User owner = fixtures.user("owner", a);
        User other = fixtures.user("other", b);
        UUID room = fixtures.room(owner, other);
        UUID pres = fixtures.personal(room, other);

        String path = "/api/v1/projects/{p}/presentations/{pr}/rating";
        mvc.perform(json(put(path, room, pres), "{\"score\":70,\"feedback\":\"처음 의견\"}").with(as(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(json(put(path, room, pres), "{\"score\":80,\"feedback\":\"바꾼 의견\"}").with(as(owner)))
                .andExpect(status().isNoContent());

        Map<String, Object> submitted = last("RATING_SUBMITTED");
        assertThat(submitted.get("category")).isEqualTo("RATING");
        assertThat(submitted.get("project_id")).isEqualTo(room);
        assertThat((String) submitted.get("message")).contains("70점 제출");
        assertThat((String) submitted.get("detail")).contains("처음 의견");

        Map<String, Object> updated = last("RATING_UPDATED");
        assertThat((String) updated.get("message")).contains("70점 → 80점");
        assertThat((String) updated.get("detail")).contains("처음 의견").contains("바꾼 의견");
        assertThat(updated.get("actor_name")).isEqualTo(owner.getName());
        assertThat(updated.get("request_id")).isNotNull();
    }

    @Test
    void 거절된_요청은_작업_기록_없이_거절_기록만_남는다() throws Exception {
        Team a = fixtures.team("A팀");
        User owner = fixtures.user("owner", a);
        User same = fixtures.user("same", a);
        UUID room = fixtures.room(owner, same);
        UUID mine = fixtures.personal(room, same);

        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/rating", room, mine), "{\"score\":70}")
                .with(as(same))).andExpect(status().isBadRequest());

        assertThat(count("select count(*) from system_logs where category = 'RATING'")).isZero();
        Map<String, Object> rejected = last("REJECTED_INVALID");
        assertThat(rejected.get("level")).isEqualTo("WARN");
        assertThat(rejected.get("status")).isEqualTo(400);
        assertThat(rejected.get("project_id")).isEqualTo(room);
        assertThat((String) rejected.get("message")).contains("본인 발표");
    }

    @Test
    void 서버_오류는_요청_ID와_스택을_남긴다() throws Exception {
        User user = fixtures.user("kim", null);
        String requestId = mvc.perform(get("/api/v1/test-boom").with(as(user)))
                .andExpect(status().isInternalServerError())
                .andReturn().getResponse().getHeader("X-Request-Id");

        Map<String, Object> error = last("SERVER_ERROR");
        assertThat(error.get("level")).isEqualTo("ERROR");
        assertThat(error.get("request_id")).isEqualTo(requestId);
        assertThat(error.get("error_type")).isEqualTo(IllegalStateException.class.getName());
        assertThat((String) error.get("message")).contains("일부러 낸 오류");
        assertThat((String) error.get("detail")).contains("BoomController");
        assertThat(count("select count(*) from system_logs where category = 'REJECTED'")).isZero();
    }

    @Test
    void 로그인_성공_실패를_남기고_비밀번호는_남기지_않는다() throws Exception {
        fixtures.user("kim", null);
        mvc.perform(json(post("/api/v1/auth/login"), "{\"loginId\":\"kim@example.com\",\"password\":\"wrong-secret-9\"}")
                .with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/v1/auth/login"),
                "{\"loginId\":\"kim@example.com\",\"password\":\"" + TestFixtures.PASSWORD + "\"}").with(csrf()))
                .andExpect(status().isOk());

        assertThat((String) last("LOGIN_FAILED").get("message")).contains("kim@example.com");
        assertThat(last("LOGIN_SUCCESS").get("actor_id")).isNotNull();
        // 로그인 실패는 거절 기록과 겹쳐 남기지 않는다
        assertThat(count("select count(*) from system_logs where category = 'REJECTED'")).isZero();
        assertThat(count("select count(*) from system_logs where concat_ws(' ', message, detail) like '%wrong-secret-9%'"
                + " or concat_ws(' ', message, detail) like ?", "%" + TestFixtures.PASSWORD + "%")).isZero();
    }

    @Test
    void 화면_오류를_받아_평가룸과_묶는다() throws Exception {
        UUID projectId = UUID.randomUUID();
        String body = """
                {"message":"TypeError: x is undefined","stack":"at Foo (app.js:1:2)",
                 "url":"http://localhost:5173/p/%s/admin?tab=1","componentStack":"in Foo"}
                """.formatted(projectId);
        mvc.perform(json(post("/api/v1/client-errors"), body).with(csrf())).andExpect(status().isNoContent());

        Map<String, Object> error = last("CLIENT_ERROR");
        assertThat(error.get("category")).isEqualTo("CLIENT_ERROR");
        assertThat(error.get("project_id")).isEqualTo(projectId);
        assertThat(error.get("error_type")).isEqualTo("TypeError");
        assertThat((String) error.get("message")).contains("/p/" + projectId + "/admin");
        assertThat((String) error.get("detail")).contains("app.js:1:2").contains("in Foo");
    }

    @Test
    void 로그_조회는_시스템_관리자만_하고_필터와_페이지가_동작한다() throws Exception {
        User admin = fixtures.sysAdmin();
        User user = fixtures.user("kim", null);
        mvc.perform(get("/api/v1/admin/logs").with(as(user))).andExpect(status().isForbidden());

        for (int i = 0; i < 3; i++) {
            mvc.perform(json(post("/api/v1/client-errors"), "{\"message\":\"오류 " + i + "\",\"url\":\"http://x/\"}")
                    .with(csrf())).andExpect(status().isNoContent());
        }
        mvc.perform(json(post("/api/v1/auth/login"), "{\"loginId\":\"kim@example.com\",\"password\":\"wrong-pass-1\"}")
                .with(csrf())).andExpect(status().isUnauthorized());

        String cursor = com.jayway.jsonpath.JsonPath.read(mvc.perform(
                        get("/api/v1/admin/logs").param("category", "CLIENT_ERROR").param("size", "2").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].message").value("오류 2 · /"))
                .andReturn().getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(get("/api/v1/admin/logs").param("category", "CLIENT_ERROR").param("size", "2")
                        .param("cursor", cursor).with(as(admin)))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].message").value("오류 0 · /"))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());

        mvc.perform(get("/api/v1/admin/logs").param("q", "kim@").with(as(admin)))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].action").value("LOGIN_FAILED"));

        mvc.perform(get("/api/v1/admin/logs/summary").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byCategory.CLIENT_ERROR").value(3))
                .andExpect(jsonPath("$.last24hByAction.LOGIN_FAILED").value(1));
        mvc.perform(get("/api/v1/admin/logs/actions").with(as(admin)))
                .andExpect(jsonPath("$.categories[0].code").value("RATING"))
                .andExpect(jsonPath("$.actions[0].label").value("점수 제출"));
    }

    @Test
    void 보관_기간이_지난_로그는_지운다() {
        jdbc.update("insert into system_logs (id, created_at, category, level, action, message)"
                + " values (?, now() - interval '31 days', 'SYSTEM', 'INFO', 'TEAM_CREATED', '오래된 기록')", UUID.randomUUID());
        jdbc.update("insert into system_logs (id, created_at, category, level, action, message)"
                + " values (?, now() - interval '29 days', 'SYSTEM', 'INFO', 'TEAM_CREATED', '남을 기록')", UUID.randomUUID());

        assertThat(retentionJob.purge()).isEqualTo(1);
        assertThat(jdbc.queryForList("select message from system_logs", String.class)).isEqualTo(List.of("남을 기록"));
    }
}
