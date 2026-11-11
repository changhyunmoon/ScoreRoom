package com.scoreroom.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 룸 관리자는 마감 전까지 평가룸 이름·설명을 바꿀 수 있다 */
class ProjectInfoTest extends IntegrationTest {

    private User owner;
    private User member;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        member = fixtures.user("member", null);
        room = fixtures.room(owner, member);
    }

    private org.springframework.test.web.servlet.ResultActions update(User actor, String body) throws Exception {
        return mvc.perform(json(put("/api/v1/projects/{p}/info", room), body).with(as(actor)));
    }

    @Test
    void 룸_관리자는_이름과_설명을_바꾼다() throws Exception {
        update(owner, "{\"name\":\"  새 이름  \",\"description\":\" 새 설명 \"}").andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select name from projects where id = ?", String.class, room)).isEqualTo("새 이름");
        assertThat(jdbc.queryForObject("select description from projects where id = ?", String.class, room)).isEqualTo("새 설명");
    }

    @Test
    void 일반_참여자는_바꿀_수_없고_빈_이름은_받지_않는다() throws Exception {
        update(member, "{\"name\":\"바꿈\",\"description\":\"\"}").andExpect(status().isForbidden());
        update(owner, "{\"name\":\"   \",\"description\":\"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("평가룸 이름을 입력해 주세요."));
    }

    @Test
    void 마감된_평가룸은_바꿀_수_없다() throws Exception {
        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        update(owner, "{\"name\":\"바꿈\",\"description\":\"\"}").andExpect(status().isConflict());
    }
}
