package com.scoreroom.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.support.TestFixtures;
import com.scoreroom.user.domain.User;

class AuthApiTest extends IntegrationTest {

    private static final String LOGIN = "{\"loginId\":\" Kim@Example.com \",\"password\":\"" + TestFixtures.PASSWORD + "\"}";

    @Test
    void 로그인은_CSRF_토큰이_있어야_한다() throws Exception {
        fixtures.user("kim", null);
        mvc.perform(json(post("/api/v1/auth/login"), LOGIN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void 잘못된_비밀번호는_401() throws Exception {
        fixtures.user("kim", null);
        mvc.perform(json(post("/api/v1/auth/login"), "{\"loginId\":\"kim@example.com\",\"password\":\"wrong-pass\"}").with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void 로그인_세션으로_내_정보를_보고_로그아웃하면_401() throws Exception {
        fixtures.user("kim", null);
        Cookie session = mvc.perform(json(post("/api/v1/auth/login"), LOGIN).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value("kim@example.com"))
                .andReturn().getResponse().getCookie("SCOREROOM_SESSION");
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        assertThat(session.getSecure()).isTrue();

        mvc.perform(get("/api/v1/me").cookie(session)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/logout").cookie(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void 비밀번호는_해시로만_저장한다() {
        User user = fixtures.user("kim", null);
        String hash = jdbc.queryForObject("select password_hash from users where id = ?", String.class, user.getId());
        assertThat(hash).startsWith("{bcrypt}").doesNotContain(TestFixtures.PASSWORD);
    }

    @Test
    void 비밀번호_변경은_현재_비밀번호를_확인한다() throws Exception {
        User user = fixtures.user("kim", null);
        String body = "{\"loginId\":\"kim@example.com\",\"name\":\"김\",\"phone\":\"010\",\"currentPassword\":\"wrong-pass\",\"newPassword\":\"new-password1\"}";
        mvc.perform(json(put("/api/v1/me"), body).with(as(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("현재 비밀번호가 맞지 않습니다."));
    }

    @Test
    void 이름과_전화번호로_이메일을_가려서_찾는다() throws Exception {
        fixtures.user("kimchulsoo", null);
        String body = "{\"name\":\"사용자 kimchulsoo\",\"phone\":\"01000000000\"}";
        mvc.perform(json(post("/api/v1/auth/find-ids"), body).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginIds[0]").value("ki********@example.com"));
        mvc.perform(json(post("/api/v1/auth/find-ids"), "{\"name\":\"사용자 kimchulsoo\",\"phone\":\"010-1111-2222\"}").with(csrf()))
                .andExpect(jsonPath("$.loginIds").isEmpty());
    }

    @Test
    void 본인_확인이_맞으면_비밀번호를_재설정하고_새_비밀번호로_로그인한다() throws Exception {
        fixtures.user("kim", null);
        String wrong = "{\"loginId\":\"kim@example.com\",\"name\":\"다른 이름\",\"phone\":\"010-0000-0000\",\"newPassword\":\"new-password1\"}";
        mvc.perform(json(post("/api/v1/auth/reset-password"), wrong).with(csrf())).andExpect(status().isBadRequest());

        String ok = "{\"loginId\":\"kim@example.com\",\"name\":\"사용자 kim\",\"phone\":\"010-0000-0000\",\"newPassword\":\"new-password1\"}";
        mvc.perform(json(post("/api/v1/auth/reset-password"), ok).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(json(post("/api/v1/auth/login"), "{\"loginId\":\"kim@example.com\",\"password\":\"new-password1\"}").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void 시스템_관리자는_본인_확인으로_재설정할_수_없다() throws Exception {
        fixtures.sysAdmin();
        String body = "{\"loginId\":\"admin@example.com\",\"name\":\"관리자\",\"phone\":\"\",\"newPassword\":\"new-password1\"}";
        mvc.perform(json(post("/api/v1/auth/reset-password"), body).with(csrf())).andExpect(status().isBadRequest());
    }

    @Test
    void 비밀번호를_바꾸면_지금_기기와_다른_기기_모두_로그아웃된다() throws Exception {
        fixtures.user("kim", null);
        Cookie here = mvc.perform(json(post("/api/v1/auth/login"), LOGIN).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("SCOREROOM_SESSION");
        Cookie other = mvc.perform(json(post("/api/v1/auth/login"), LOGIN).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("SCOREROOM_SESSION");

        String body = "{\"loginId\":\"kim@example.com\",\"name\":\"김\",\"phone\":\"010\",\"currentPassword\":\""
                + TestFixtures.PASSWORD + "\",\"newPassword\":\"new-password1\"}";
        mvc.perform(json(put("/api/v1/me"), body).cookie(here).with(csrf())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/me").cookie(here)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me").cookie(other)).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/v1/auth/login"), "{\"loginId\":\"kim@example.com\",\"password\":\"new-password1\"}")
                .with(csrf())).andExpect(status().isOk());
        assertThat(count("select count(*) from system_logs where action = 'PASSWORD_CHANGED'")).isEqualTo(1);
    }

    @Test
    void 시스템_관리자_기능은_일반_사용자에게_403() throws Exception {
        User user = fixtures.user("kim", null);
        mvc.perform(json(post("/api/v1/admin/teams"), "{\"name\":\"새 팀\"}").with(as(user)))
                .andExpect(status().isForbidden());
        User admin = fixtures.sysAdmin();
        mvc.perform(json(post("/api/v1/admin/teams"), "{\"name\":\"새 팀\"}").with(as(admin)))
                .andExpect(status().isCreated());
    }
}
