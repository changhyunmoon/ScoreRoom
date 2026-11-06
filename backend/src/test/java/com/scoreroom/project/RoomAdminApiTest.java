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
        // 한 사람은 발표 하나에만 참여하므로 단독 발표와 공동 발표는 다른 사람이 맡는다
        User loner = fixtures.user("loner", null);
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + loner.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isOk());
        UUID solo = fixtures.personal(room, loner);
        UUID shared = fixtures.teamPresentation(room, leader, List.of(presenter), List.of(member));
        rate(owner, solo, loner, 70);
        rate(owner, shared, presenter, 80);

        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, loner.getId()).with(as(owner)))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, loner.getId())
                .param("expectedVersion", String.valueOf(fixtures.version(room))).with(as(owner)))
                .andExpect(status().isNoContent());
        assertThat(count("select count(*) from presentations where id = ?", solo)).isZero();

        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, leader.getId())
                .param("expectedVersion", String.valueOf(fixtures.version(room))).with(as(owner)))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select leader_id from presentations where id = ?", UUID.class, shared))
                .isEqualTo(presenter.getId());
        assertThat(count("select count(*) from presentation_members where presentation_id = ?", shared)).isEqualTo(2);
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        assertThat(count("select count(*) from memberships where project_id = ? and user_id = ?", room, leader.getId()))
                .isZero();
    }

    @Test
    void 평가_현황은_켜져_있으면_참여자에게_인원_수만_보이고_꺼도_룸_관리자에게는_보인다() throws Exception {
        UUID pres = fixtures.teamPresentation(room, leader, List.of(presenter), List.of());
        rate(owner, pres, presenter, 80);

        // 기본은 켜짐: 참여자도 사람별 인원 수를 받지만 평균 점수는 받지 않는다
        mvc.perform(get("/api/v1/state").with(as(member)))
                .andExpect(jsonPath("$.projects[0].settings.showRatingStatus").value(true))
                .andExpect(jsonPath("$.summaries[?(@.targetId == '" + presenter.getId() + "')].scored").value(1))
                .andExpect(jsonPath("$.summaries[?(@.targetId == '" + presenter.getId() + "')].total").value(4))
                .andExpect(jsonPath("$.summaries[0].avg").doesNotExist());

        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"showRatingStatus\":false}")
                .with(as(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(member)))
                .andExpect(jsonPath("$.projects[0].settings.showRatingStatus").value(false))
                .andExpect(jsonPath("$.summaries.length()").value(0));
        // 룸 관리자는 꺼져 있어도 점수까지 받는다
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.summaries[?(@.targetId == '" + presenter.getId() + "')].avg").value(80.0));
        // 다른 설정만 바꿀 때 값을 보내지 않으면 그대로 유지한다
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"allowEdit\":false}")
                .with(as(owner))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select show_rating_status from projects where id = ?", Boolean.class, room)).isFalse();
    }

    @Test
    void 마지막_룸_관리자는_해제하거나_제거할_수_없다() throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, owner.getId()), "{\"isAdmin\":false}")
                .with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/projects/{p}/members/{u}", room, owner.getId()).with(as(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 관리자가_아니면_설정을_바꿀_수_없다() throws Exception {
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
        // 역할(대표·팀원)은 바꿀 수 있다: 대표를 member로 바꾸고 원래 대표는 팀원으로
        String swapLeader = "{\"title\":\"팀 발표\",\"type\":\"TEAM\",\"leaderId\":\"%s\",\"presenterIds\":[],\"memberIds\":[\"%s\",\"%s\"]}"
                .formatted(member.getId(), leader.getId(), presenter.getId());
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, shared), swapLeader).with(as(leader)))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select leader_id from presentations where id = ?", UUID.class, shared))
                .isEqualTo(member.getId());
    }

    @Test
    void 발표자_구분은_없고_예전_화면이_보낸_발표자도_팀원으로_저장된다() throws Exception {
        UUID shared = fixtures.teamPresentation(room, leader, List.of(presenter), List.of(member));
        assertThat(count("select count(*) from presentation_members where presentation_id = ? and is_presenter", shared)).isZero();
        assertThat(count("select count(*) from presentation_members where presentation_id = ?", shared)).isEqualTo(3);
    }

    @Test
    void 같은_평가룸에서는_발표_제목이_겹칠_수_없다() throws Exception {
        UUID first = fixtures.personal(room, leader);
        UUID second = fixtures.personal(room, presenter);
        String body = "{\"title\":\"%s\",\"type\":\"PERSONAL\",\"leaderId\":\"%s\",\"presenterIds\":[],\"memberIds\":[]}";
        // 새로 등록: 앞뒤 공백·대소문자만 다른 제목도 막는다
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room),
                body.formatted("  개인 발표 " + leader.getName().toUpperCase() + " ", member.getId()))
                .with(as(member))).andExpect(status().isConflict());
        // 수정: 다른 발표의 제목으로 바꿀 수 없다
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, second),
                body.formatted("개인 발표 " + leader.getName(), presenter.getId())).with(as(presenter)))
                .andExpect(status().isConflict());
        // 자기 제목 그대로 저장하는 것은 된다
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, first),
                body.formatted("개인 발표 " + leader.getName(), leader.getId())).with(as(leader)))
                .andExpect(status().isOk());
        // 다른 평가룸에서는 같은 제목을 쓸 수 있다
        UUID otherRoom = fixtures.room(owner, leader);
        fixtures.personal(otherRoom, leader);
    }

    @Test
    void 구성원은_누구나_발표를_수정_삭제하고_점수를_받은_발표는_관리자만_삭제한다() throws Exception {
        UUID shared = fixtures.teamPresentation(room, leader, List.of(presenter), List.of(member));
        String rename = "{\"title\":\"새 제목\",\"type\":\"TEAM\",\"leaderId\":\"%s\",\"presenterIds\":[\"%s\"],\"memberIds\":[\"%s\"]}"
                .formatted(leader.getId(), presenter.getId(), member.getId());
        // 팀원도 수정할 수 있다
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}", room, shared), rename).with(as(member)))
                .andExpect(status().isOk());
        // 점수를 받으면 구성원은 지울 수 없고 관리자만 지운다
        rate(owner, shared, member, 75);
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}", room, shared).with(as(member)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}", room, shared).with(as(owner)))
                .andExpect(status().is2xxSuccessful());

        // 점수가 없으면 발표자도 지울 수 있다. 구성원이 아닌 사람은 못 지운다
        UUID solo = fixtures.personal(room, presenter);
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}", room, solo).with(as(member)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}", room, solo).with(as(presenter)))
                .andExpect(status().is2xxSuccessful());
        assertThat(count("select count(*) from presentations where project_id = ?", room)).isZero();
    }
}
