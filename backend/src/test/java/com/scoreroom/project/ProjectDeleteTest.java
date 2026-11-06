package com.scoreroom.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 평가룸 삭제: 룸 관리자 또는 시스템 관리자만, 하위 데이터를 모두 지운다 */
class ProjectDeleteTest extends IntegrationTest {

    private User owner;
    private User a;
    private User b;
    private UUID room;

    @BeforeEach
    void setUp() throws Exception {
        owner = fixtures.user("owner", null);
        a = fixtures.user("a", null);
        b = fixtures.user("b", null);
        room = fixtures.room(owner, a, b);
        UUID pres = fixtures.teamPresentation(room, a, List.of(), List.of(b));
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, a.getId()), "{\"score\":80}")
                .with(as(owner)));
        mvc.perform(json(post("/api/v1/projects/{p}/invite", room), "{\"minutes\":null}").with(as(owner)));
        mvc.perform(json(post("/api/v1/projects/{p}/presentation-requests", room), "{\"userIds\":[\"" + a.getId() + "\"]}")
                .with(as(owner)));
    }

    private void assertGone() {
        for (String table : List.of("projects", "memberships", "presentations", "presentation_members", "ratings", "invite_codes",
                "notifications")) {
            assertThat(count("select count(*) from " + table)).as(table).isZero();
        }
        assertThat(count("select count(*) from audit_events where action = 'PROJECT_DELETED'")).isEqualTo(1);
    }

    @Test
    void 룸_관리자는_평가룸을_삭제하고_하위_데이터가_모두_지워진다() throws Exception {
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        mvc.perform(delete("/api/v1/projects/{p}", room).with(as(owner))).andExpect(status().isNoContent());
        assertGone();
    }

    @Test
    void 마감된_평가룸도_삭제할_수_있다() throws Exception {
        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/projects/{p}", room).with(as(owner))).andExpect(status().isNoContent());
        assertGone();
    }

    @Test
    void 참여자는_삭제할_수_없다() throws Exception {
        mvc.perform(delete("/api/v1/projects/{p}", room).with(as(a))).andExpect(status().isForbidden());
        assertThat(count("select count(*) from projects")).isEqualTo(1);
    }

    @Test
    void 시스템_관리자는_전체_평가룸을_보고_삭제할_수_있다() throws Exception {
        User sys = fixtures.sysAdmin();
        mvc.perform(get("/api/v1/admin/projects").with(as(sys)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].memberCount").value(3))
                .andExpect(jsonPath("$[0].presentationCount").value(1))
                .andExpect(jsonPath("$[0].ratingCount").value(1))
                .andExpect(jsonPath("$[0].adminNames").value(owner.getName()));
        mvc.perform(get("/api/v1/admin/projects").with(as(owner))).andExpect(status().isForbidden());

        mvc.perform(delete("/api/v1/projects/{p}", room).with(as(sys))).andExpect(status().isNoContent());
        assertGone();
    }
}
