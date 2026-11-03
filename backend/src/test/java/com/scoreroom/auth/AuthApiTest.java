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
    void 시스템_관리자_기능은_일반_사용자에게_403() throws Exception {
        User user = fixtures.user("kim", null);
        mvc.perform(json(post("/api/v1/admin/teams"), "{\"name\":\"새 팀\"}").with(as(user)))
                .andExpect(status().isForbidden());
        User admin = fixtures.sysAdmin();
        mvc.perform(json(post("/api/v1/admin/teams"), "{\"name\":\"새 팀\"}").with(as(admin)))
                .andExpect(status().isCreated());
    }
}
