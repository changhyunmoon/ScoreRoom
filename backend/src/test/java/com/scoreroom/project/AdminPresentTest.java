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

/** 룸 관리자 발표 설정: 켜면 관리자도 발표하고, 끄면 발표에 들어 있던 관리자는 발표에서 빠진다 */
class AdminPresentTest extends IntegrationTest {

    private User owner;
    private User a;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        a = fixtures.user("a", null);
        room = fixtures.room(owner, a);
    }

    private String personal(User leader) {
        return "{\"title\":\"관리자 발표\",\"intro\":\"\",\"type\":\"PERSONAL\",\"leaderId\":\"" + leader.getId()
                + "\",\"presenterIds\":[],\"memberIds\":[]}";
    }

    private void setPresent(boolean on, Long version) throws Exception {
        String v = version == null ? "" : ",\"expectedVersion\":" + version;
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"allowAdminPresent\":" + on + v + "}")
                .with(as(owner))).andExpect(status().isOk());
    }

    @Test
    void 켜면_관리자도_발표를_등록하고_발표_등록_요청을_받는다() throws Exception {
        setPresent(true, null);
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), personal(owner)).with(as(owner)))
                .andExpect(status().isCreated());
        assertThat(count("select count(*) from presentation_members where user_id = ?", owner.getId())).isEqualTo(1);
    }

    @Test
    void 끄면_발표에_들어_있던_관리자를_확인한_version으로_발표에서_뺀다() throws Exception {
        setPresent(true, null);
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), personal(owner)).with(as(owner)))
                .andExpect(status().isCreated());
        // 영향이 있으면 version 없이는 거절
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"allowAdminPresent\":false}")
                .with(as(owner))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
        setPresent(false, fixtures.version(room));
        assertThat(count("select count(*) from presentations")).isZero();
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), personal(owner)).with(as(owner)))
                .andExpect(status().isBadRequest());
    }
}
