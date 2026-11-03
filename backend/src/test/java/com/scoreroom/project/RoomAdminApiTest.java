package com.scoreroom.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.organization.domain.Team;
import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

class RoomAdminApiTest extends IntegrationTest {

    private User owner;
    private User leader;
    private User presenter;
    private User member;
    private UUID room;

    @BeforeEach
    void setUp() {
        Team a = fixtures.team("A팀");
        Team b = fixtures.team("B팀");
        owner = fixtures.user("owner", a);
        leader = fixtures.user("leader", b);
        presenter = fixtures.user("presenter", b);
        member = fixtures.user("member", b);
        room = fixtures.room(owner, leader, presenter, member);
    }

    private void rate(User rater, UUID pres, User target, int score) throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, target.getId()),
                "{\"score\":" + score + "}").with(as(rater))).andExpect(status().isNoContent());
    }

    @Test
    void 점수_범위를_바꾸면_확인한_version이_있어야_하고_모든_평가와_집계_기준을_지운다() throws Exception {
        UUID pres = fixtures.personal(room, leader);
        rate(owner, pres, leader, 70);
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"aggMin\":10,\"aggMax\":90}")
                .with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.removed").value(0));

        String change = "{\"min\":0,\"max\":10,\"aggMin\":0,\"aggMax\":10%s}";
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), change.formatted("")).with(as(owner)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        long version = fixtures.version(room);
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), change.formatted(",\"expectedVersion\":" + version))
                .with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(1));
        assertThat(count("select count(*) from ratings")).isZero();
        assertThat(jdbc.queryForObject("select agg_min from projects where id = ?", Integer.class, room)).isNull();
        assertThat(count("select score_max from projects where id = ?", room)).isEqualTo(10);
    }

    @Test
    void 평가_규칙을_바꾸면_새_규칙에_어긋난_평가만_지운다() throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"allowSameTeam\":true}")
                .with(as(owner))).andExpect(status().isOk());
        UUID pres = fixtures.personal(room, leader);
        rate(owner, pres, leader, 70);
        rate(presenter, pres, leader, 60);

        long version = fixtures.version(room);
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room),
                "{\"min\":0,\"max\":100,\"allowSameTeam\":false,\"expectedVersion\":" + version + "}").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(1));
        assertThat(count("select count(*) from ratings where rater_id = ?", owner.getId())).isEqualTo(1);
    }

    @Test
    void 참여자를_제거하면_단독_발표를_지우고_공동_발표의_대표를_다시_정한다() throws Exception {
        UUID solo = fixtures.personal(room, leader);
        UUID shared = fixtures.teamPresentation(room, leader, List.of(presenter), List.of(member));
        rate(owner, solo, leader, 70);
        rate(owner, shared, presenter, 80);

        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, leader.getId()).with(as(owner)))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, leader.getId())
                .param("expectedVersion", String.valueOf(fixtures.version(room))).with(as(owner)))
                .andExpect(status().isNoContent());

        assertThat(count("select count(*) from presentations where id = ?", solo)).isZero();
        assertThat(jdbc.queryForObject("select leader_id from presentations where id = ?", UUID.class, shared))
                .isEqualTo(presenter.getId());
        assertThat(count("select count(*) from presentation_members where presentation_id = ?", shared)).isEqualTo(2);
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        assertThat(count("select count(*) from memberships where project_id = ? and user_id = ?", room, leader.getId()))
                .isZero();
    }

    @Test
    void 마지막_룸_운영자는_해제하거나_제거할_수_없다() throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, owner.getId()), "{\"isAdmin\":false}")
                .with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, owner.getId()).with(as(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 운영자가_아니면_설정을_바꿀_수_없다() throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":10}").with(as(member)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 점수를_받은_발표는_구성원을_바꿀_수_없고_역할만_바꾼다() throws Exception {
        UUID shared = fixtures.teamPresentation(room, leader, List.of(presenter), List.of(member));
        rate(owner, shared, member, 75);
        String addOwner = "{\"title\":\"팀 발표\",\"type\":\"TEAM\",\"leaderId\":\"%s\",\"presenterIds\":[\"%s\"],\"memberIds\":[\"%s\",\"%s\"]}"
                .formatted(leader.getId(), presenter.getId(), member.getId(), owner.getId());
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, shared), addOwner).with(as(leader)))
                .andExpect(status().isBadRequest());
        String swapRoles = "{\"title\":\"팀 발표\",\"type\":\"TEAM\",\"leaderId\":\"%s\",\"presenterIds\":[\"%s\"],\"memberIds\":[\"%s\"]}"
                .formatted(leader.getId(), member.getId(), presenter.getId());
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, shared), swapRoles).with(as(leader)))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select is_presenter from presentation_members where presentation_id = ? and user_id = ?",
                Boolean.class, shared, member.getId())).isTrue();
    }
}
