package com.scoreroom.bootstrap;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.organization.domain.Team;
import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** /state가 권한에 맞게 걸러서 보내는지 확인한다 */
class StateApiTest extends IntegrationTest {

    private User owner;
    private User rater;
    private User target;
    private UUID room;

    @BeforeEach
    void setUp() throws Exception {
        Team a = fixtures.team("A팀");
        Team b = fixtures.team("B팀");
        Team c = fixtures.team("C팀");
        owner = fixtures.user("owner", a);
        rater = fixtures.user("rater", b);
        target = fixtures.user("target", c);
        room = fixtures.room(owner, rater, target);
        UUID pres = fixtures.personal(room, target);
        for (User u : new User[] { owner, rater }) {
            mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/rating", room, pres),
                    "{\"score\":50,\"feedback\":\"의견\"}").with(as(u))).andExpect(status().isNoContent());
        }
    }

    @Test
    void 일반_참여자는_자기_점수만_보고_다른_사람의_연락처와_평균_점수는_받지_않는다() throws Exception {
        mvc.perform(get("/api/v1/state").with(as(rater)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratings", hasSize(1)))
                .andExpect(jsonPath("$.ratings[0].raterId").value(rater.getId().toString()))
                // 평가 현황(기본 켜짐)은 인원 수만 받는다
                .andExpect(jsonPath("$.summaries", hasSize(1)))
                .andExpect(jsonPath("$.summaries[0].scored").value(2))
                .andExpect(jsonPath("$.summaries[0].avg").doesNotExist())
                .andExpect(jsonPath("$.projects[0].invite").doesNotExist())
                .andExpect(jsonPath("$.users[?(@.id == '" + owner.getId() + "')].phone").value(""))
                .andExpect(jsonPath("$.me.phone").value("010-0000-0000"));
    }

    @Test
    void 룸_관리자는_모든_점수와_집계를_본다() throws Exception {
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratings", hasSize(2)))
                .andExpect(jsonPath("$.summaries", hasSize(1)))
                .andExpect(jsonPath("$.summaries[0].scored").value(2))
                .andExpect(jsonPath("$.summaries[0].avg").value(50.0))
                .andExpect(jsonPath("$.memberships[0].isAdmin").exists());
    }

    @Test
    void 전체_열람_권한자는_참여하지_않은_평가룸의_집계만_본다() throws Exception {
        User viewer = fixtures.user("viewer", null);
        User admin = fixtures.sysAdmin();
        mvc.perform(json(put("/api/v1/admin/users/{u}/view-all", viewer.getId()), "{\"enabled\":true}").with(as(admin)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/state").with(as(fixtures.reload(viewer))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.ratings", hasSize(0)))
                .andExpect(jsonPath("$.summaries", hasSize(1)));
    }
}
