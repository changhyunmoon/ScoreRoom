package com.scoreroom.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

class InvitationApiTest extends IntegrationTest {

    private User owner;
    private User guest;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        guest = fixtures.user("guest", null);
        room = fixtures.room(owner);
    }

    @Test
    void 입장_코드로_한_번만_참여하고_중지하면_더_참여할_수_없다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/invite", room), "{\"minutes\":null}").with(as(owner)))
                .andExpect(status().isNoContent());
        String code = jdbc.queryForObject("select code from invite_codes where project_id = ?", String.class, room);

        for (int i = 0; i < 2; i++) {
            mvc.perform(json(post("/api/v1/projects/join"), "{\"code\":\"" + code.toLowerCase() + "\"}").with(as(guest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(room.toString()));
        }
        assertThat(count("select count(*) from memberships where project_id = ?", room)).isEqualTo(2);

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/projects/{p}/invite", room)
                .with(as(owner))).andExpect(status().isNoContent());
        User late = fixtures.user("late", null);
        mvc.perform(json(post("/api/v1/projects/join"), "{\"code\":\"" + code + "\"}").with(as(late)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("사용이 중지된 입장 코드입니다."));
    }

    @Test
    void 사람을_지정해_초대하면_수락_없이_바로_참여하고_이미_참여한_사람은_건너뛴다() throws Exception {
        String body = "{\"userIds\":[\"" + guest.getId() + "\"]}";
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), body).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(1));
        assertThat(count("select count(*) from memberships where project_id = ? and user_id = ?", room, guest.getId()))
                .isEqualTo(1);
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), body).with(as(owner)))
                .andExpect(jsonPath("$.added").value(0));
    }

    @Test
    void 추가된_사람에게_초대_알림이_가고_읽으면_읽음으로_바뀐다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + guest.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isOk());

        mvc.perform(get("/api/v1/state").with(as(guest)))
                .andExpect(jsonPath("$.notifications.length()").value(1))
                .andExpect(jsonPath("$.notifications[0].type").value("ROOM_INVITED"))
                .andExpect(jsonPath("$.notifications[0].projectId").value(room.toString()))
                .andExpect(jsonPath("$.notifications[0].actorName").value(owner.getName()))
                .andExpect(jsonPath("$.notifications[0].readAt").doesNotExist());
        // 초대한 사람에게는 알림이 없다
        mvc.perform(get("/api/v1/state").with(as(owner))).andExpect(jsonPath("$.notifications.length()").value(0));

        mvc.perform(post("/api/v1/notifications/read").with(as(guest))).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/state").with(as(guest))).andExpect(jsonPath("$.notifications[0].readAt").isNumber());
    }

    @Test
    void 룸_운영자만_사람을_추가하고_시스템_관리자는_추가할_수_없다() throws Exception {
        User other = fixtures.user("other", null);
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + other.getId() + "\"]}")
                .with(as(guest))).andExpect(status().isForbidden());

        User admin = fixtures.sysAdmin();
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + admin.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[]}")
                .with(as(owner))).andExpect(status().isBadRequest());
    }

    @Test
    void 마감된_평가룸에는_사람을_추가할_수_없다() throws Exception {
        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + guest.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isConflict());
        assertThat(count("select count(*) from memberships where project_id = ?", room)).isEqualTo(1);
    }
}
