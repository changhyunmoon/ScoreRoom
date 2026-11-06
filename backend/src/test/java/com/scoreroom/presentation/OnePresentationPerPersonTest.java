package com.scoreroom.presentation;

import static org.assertj.core.api.Assertions.assertThat;
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

/** 한 사람은 평가룸에서 발표 하나에만 참여한다. 팀 발표는 한 명이 등록하면 구성원 전원이 그 발표로 등록된다 */
class OnePresentationPerPersonTest extends IntegrationTest {

    private static final String TEAM = "{\"title\":\"%s\",\"type\":\"TEAM\",\"leaderId\":\"%s\",\"presenterIds\":[],\"memberIds\":[%s]}";
    private static final String PERSONAL = "{\"title\":\"%s\",\"type\":\"PERSONAL\",\"leaderId\":\"%s\",\"presenterIds\":[],\"memberIds\":[]}";

    private User owner;
    private User leader;
    private User mate;
    private User solo;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        leader = fixtures.user("leader", null);
        mate = fixtures.user("mate", null);
        solo = fixtures.user("solo", null);
        room = fixtures.room(owner, leader, mate, solo);
    }

    @Test
    void 팀_발표를_한_명이_등록하면_구성원_모두_그_발표에_등록된다() throws Exception {
        UUID pres = fixtures.teamPresentation(room, leader, List.of(), List.of(mate));
        assertThat(count("select count(*) from presentation_members where presentation_id = ?", pres)).isEqualTo(2);
        assertThat(count("select count(*) from presentation_members where project_id = ? and user_id = ?", room, mate.getId()))
                .isEqualTo(1);
    }

    @Test
    void 다른_발표에_등록된_사람은_새_발표에_넣을_수_없다() throws Exception {
        fixtures.teamPresentation(room, leader, List.of(), List.of(mate));

        // 이미 팀 발표에 들어간 사람이 개인 발표를 또 등록할 수 없다
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), PERSONAL.formatted("두 번째", mate.getId()))
                .with(as(mate)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(mate.getName())));
        // 다른 사람이 만든 팀 발표에 그 사람을 끌어올 수도 없다
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room),
                TEAM.formatted("세 번째", solo.getId(), "\"" + mate.getId() + "\"")).with(as(solo)))
                .andExpect(status().isConflict());
        assertThat(count("select count(*) from presentations where project_id = ?", room)).isEqualTo(1);
    }

    @Test
    void 자기_발표를_수정하는_것은_된다_다른_발표_구성원을_추가하는_것은_안_된다() throws Exception {
        UUID team = fixtures.teamPresentation(room, leader, List.of(), List.of(mate));
        fixtures.personal(room, solo);

        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, team),
                TEAM.formatted("팀 발표 새 제목", leader.getId(), "\"" + mate.getId() + "\"")).with(as(leader)))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, team),
                TEAM.formatted("팀 발표 새 제목", leader.getId(), "\"" + mate.getId() + "\",\"" + solo.getId() + "\""))
                .with(as(leader)))
                .andExpect(status().isConflict());
    }
}
