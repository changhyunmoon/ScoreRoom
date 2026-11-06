package com.scoreroom.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 룸 관리자는 발표 미등록자에게 발표 등록 요청 알림을 보낼 수 있다 */
class PresentationRequestTest extends IntegrationTest {

    private User owner;
    private User registered;
    private User pending;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        registered = fixtures.user("registered", null);
        pending = fixtures.user("pending", null);
        room = fixtures.room(owner, registered, pending);
        fixtures.personal(room, registered);
    }

    private String body(User... users) {
        StringBuilder b = new StringBuilder("{\"userIds\":[");
        for (int i = 0; i < users.length; i++) {
            b.append(i > 0 ? "," : "").append('"').append(users[i].getId()).append('"');
        }
        return b.append("]}").toString();
    }

    @Test
    void 미등록자에게만_알림이_가고_등록한_사람은_건너뛴다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/presentation-requests", room), body(registered, pending)).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(1));
        mvc.perform(get("/api/v1/state").with(as(pending)))
                .andExpect(jsonPath("$.notifications[0].type").value("PRESENTATION_REQUESTED"))
                .andExpect(jsonPath("$.notifications[0].projectId").value(room.toString()))
                .andExpect(jsonPath("$.notifications[0].actorName").value(owner.getName()));
        mvc.perform(get("/api/v1/state").with(as(registered)))
                .andExpect(jsonPath("$.notifications.length()").value(0));
    }

    @Test
    void 룸_관리자만_보낼_수_있다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/presentation-requests", room), body(pending)).with(as(registered)))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/v1/projects/{p}/presentation-requests", room), "{\"userIds\":[]}").with(as(owner)))
                .andExpect(status().isBadRequest());
    }
}
