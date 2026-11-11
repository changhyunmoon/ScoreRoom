package com.scoreroom.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 룸 관리자는 발표를 아직 평가하지 않은 사람에게 평가 요청 알림을 보낼 수 있다 */
class RatingRequestTest extends IntegrationTest {

    private User owner;
    private User presenter;
    private User rated;
    private User pending;
    private UUID room;
    private UUID pres;

    @BeforeEach
    void setUp() throws Exception {
        owner = fixtures.user("owner", null);
        presenter = fixtures.user("presenter", null);
        rated = fixtures.user("rated", null);
        pending = fixtures.user("pending", null);
        room = fixtures.room(owner, presenter, rated, pending);
        pres = fixtures.personal(room, presenter);
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/rating", room, pres), "{\"score\":70}").with(as(rated)))
                .andExpect(status().isNoContent());
    }

    private ResultActions send(User actor, User... users) throws Exception {
        StringBuilder b = new StringBuilder("{\"userIds\":[");
        for (int i = 0; i < users.length; i++) {
            b.append(i > 0 ? "," : "").append('"').append(users[i].getId()).append('"');
        }
        return mvc.perform(json(post("/api/v1/projects/{p}/presentations/{pr}/rating-requests", room, pres),
                b.append("]}").toString()).with(as(actor)));
    }

    @Test
    void 아직_평가하지_않은_사람에게만_발표와_함께_알림이_간다() throws Exception {
        // 이미 평가한 사람, 본인 발표라 평가할 수 없는 사람은 건너뛴다
        send(owner, rated, presenter, pending).andExpect(status().isOk()).andExpect(jsonPath("$.sent").value(1));
        mvc.perform(get("/api/v1/state").with(as(pending)))
                .andExpect(jsonPath("$.notifications[0].type").value("RATING_REQUESTED"))
                .andExpect(jsonPath("$.notifications[0].presentationId").value(pres.toString()))
                .andExpect(jsonPath("$.notifications[0].presentationTitle").isNotEmpty())
                .andExpect(jsonPath("$.notifications[0].actorName").value(owner.getName()));
        mvc.perform(get("/api/v1/state").with(as(rated))).andExpect(jsonPath("$.notifications.length()").value(0));
    }

    @Test
    void 룸_관리자만_보낼_수_있고_발표가_지워지면_알림의_발표는_비워진다() throws Exception {
        send(rated, pending).andExpect(status().isForbidden());
        send(owner).andExpect(status().isBadRequest());
        send(owner, pending).andExpect(status().isOk());
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}", room, pres).with(as(owner))).andExpect(status().isNoContent());
        assertThat(count("select count(*) from notifications where presentation_id is null and type = 'RATING_REQUESTED'")).isEqualTo(1);
    }
}
