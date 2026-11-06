package com.scoreroom.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 평가룸은 시스템 관리자에게 생성 권한을 받은 사람만 만든다 */
class CreateRoomPermissionTest extends IntegrationTest {

    private static final String ROOM = "{\"name\":\"새 평가룸\",\"description\":\"\"}";

    private User admin;
    private User member;

    @BeforeEach
    void setUp() {
        admin = fixtures.sysAdmin();
        member = fixtures.user("member", null);
    }

    @Test
    void 권한이_없으면_평가룸을_만들_수_없다() throws Exception {
        mvc.perform(json(post("/api/v1/projects"), ROOM).with(as(member)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("평가룸을 만들 권한이 없습니다. 시스템 관리자에게 요청해 주세요."));
        assertThat(count("select count(*) from projects")).isZero();
    }

    @Test
    void 시스템_관리자가_권한을_주면_만들_수_있고_회수하면_다시_못_만든다() throws Exception {
        mvc.perform(json(put("/api/v1/admin/users/{u}/create-room", member.getId()), "{\"enabled\":true}").with(as(admin)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/state").with(as(member))).andExpect(jsonPath("$.me.canCreateRoom").value(true));
        mvc.perform(json(post("/api/v1/projects"), ROOM).with(as(member))).andExpect(status().isCreated());

        mvc.perform(json(put("/api/v1/admin/users/{u}/create-room", member.getId()), "{\"enabled\":false}").with(as(admin)))
                .andExpect(status().isNoContent());
        mvc.perform(json(post("/api/v1/projects"), ROOM).with(as(member))).andExpect(status().isForbidden());
        // 회수해도 이미 만든 평가룸은 그대로다
        assertThat(count("select count(*) from projects")).isEqualTo(1);
    }

    @Test
    void 시스템_관리자만_권한을_줄_수_있다() throws Exception {
        User other = fixtures.user("other", null);
        mvc.perform(json(put("/api/v1/admin/users/{u}/create-room", other.getId()), "{\"enabled\":true}").with(as(member)))
                .andExpect(status().isForbidden());
        mvc.perform(json(put("/api/v1/admin/users/{u}/create-room", admin.getId()), "{\"enabled\":true}").with(as(admin)))
                .andExpect(status().isBadRequest());
    }
}
