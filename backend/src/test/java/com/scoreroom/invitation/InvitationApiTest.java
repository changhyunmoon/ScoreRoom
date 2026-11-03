package com.scoreroom.invitation;

import static org.assertj.core.api.Assertions.assertThat;
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
    void 초대는_받은_사람만_수락하고_중복_초대는_건너뛴다() throws Exception {
        String body = "{\"userIds\":[\"" + guest.getId() + "\"]}";
        mvc.perform(json(post("/api/v1/projects/{p}/invitations", room), body).with(as(owner)))
                .andExpect(jsonPath("$.invited").value(1));
        mvc.perform(json(post("/api/v1/projects/{p}/invitations", room), body).with(as(owner)))
                .andExpect(jsonPath("$.invited").value(0));
        UUID invitation = jdbc.queryForObject("select id from invitations", UUID.class);

        User other = fixtures.user("other", null);
        mvc.perform(post("/api/v1/invitations/{i}/accept", invitation).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/invitations/{i}/accept", invitation).with(as(guest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(room.toString()));
        mvc.perform(post("/api/v1/invitations/{i}/accept", invitation).with(as(guest))).andExpect(status().isNotFound());
    }

    @Test
    void 마감하면_대기_중인_초대를_수락할_수_없다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/invitations", room), "{\"userIds\":[\"" + guest.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isOk());
        UUID invitation = jdbc.queryForObject("select id from invitations", UUID.class);
        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/invitations/{i}/accept", invitation).with(as(guest))).andExpect(status().isNotFound());
    }
}
