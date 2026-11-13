package com.scoreroom.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.support.TestFixtures;
import com.scoreroom.user.domain.User;

/** 시스템 관리자 접속 현황: 만료되지 않은 로그인 세션을 사람별로 보여 준다 */
class OnlineUsersTest extends IntegrationTest {

    private Cookie login(String loginId) throws Exception {
        return mvc.perform(json(post("/api/v1/auth/login"),
                        "{\"loginId\":\"" + loginId + "\",\"password\":\"" + TestFixtures.PASSWORD + "\"}").with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("SCOREROOM_SESSION");
    }

    @Test
    void 로그인한_사람이_기기_수와_함께_보이고_로그아웃하면_빠진다() throws Exception {
        User admin = fixtures.sysAdmin();
        User user = fixtures.user("online", null);
        Cookie first = login(user.getLoginId());
        login(user.getLoginId());

        mvc.perform(get("/api/v1/admin/online").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users.length()").value(1))
                .andExpect(jsonPath("$.users[0].name").value(user.getName()))
                .andExpect(jsonPath("$.users[0].active").value(true))
                .andExpect(jsonPath("$.users[0].sessionCount").value(2))
                .andExpect(jsonPath("$.users[0].ip").isNotEmpty());

        mvc.perform(post("/api/v1/auth/logout").cookie(first).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/admin/online").with(as(admin)))
                .andExpect(jsonPath("$.users[0].sessionCount").value(1));
    }

    @Test
    void 룸_관리자는_자기_평가룸_참여자의_접속_여부만_본다() throws Exception {
        User owner = fixtures.user("roomowner", null);
        User member = fixtures.user("roommember", null);
        User outsider = fixtures.user("outsider", null);
        var projectId = fixtures.room(owner, member);
        login(member.getLoginId());
        login(outsider.getLoginId());

        mvc.perform(get("/api/v1/projects/" + projectId + "/online").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(2))
                .andExpect(jsonPath("$.members[0].name").value(member.getName()))
                .andExpect(jsonPath("$.members[0].online").value(true))
                .andExpect(jsonPath("$.members[0].active").value(true))
                .andExpect(jsonPath("$.members[1].name").value(owner.getName()))
                .andExpect(jsonPath("$.members[1].online").value(false))
                .andExpect(jsonPath("$.members[1].roomAdmin").value(true));

        mvc.perform(get("/api/v1/projects/" + projectId + "/online").with(as(member))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/" + projectId + "/online").with(as(outsider))).andExpect(status().isForbidden());
    }

    @Test
    void 일반_사용자는_볼_수_없다() throws Exception {
        User user = fixtures.user("viewer", null);
        mvc.perform(get("/api/v1/admin/online").with(as(user))).andExpect(status().isForbidden());
    }
}
