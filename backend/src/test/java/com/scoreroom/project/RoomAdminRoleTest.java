package com.scoreroom.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

/** 룸 관리자는 발표하지 않고, 평가할지는 평가룸 설정('관리자도 평가하기')을 따른다 */
class RoomAdminRoleTest extends IntegrationTest {

    private User owner;
    private User a;
    private User b;
    private User c;
    private UUID room;

    @BeforeEach
    void setUp() {
        owner = fixtures.user("owner", null);
        a = fixtures.user("a", null);
        b = fixtures.user("b", null);
        c = fixtures.user("c", null);
        room = fixtures.room(owner, a, b, c);
    }

    private String presentation(String title, String type, User leader, User... members) {
        StringBuilder ids = new StringBuilder();
        for (User m : members) {
            ids.append(ids.length() > 0 ? "," : "").append('"').append(m.getId()).append('"');
        }
        return "{\"title\":\"" + title + "\",\"intro\":\"\",\"type\":\"" + type + "\",\"leaderId\":\"" + leader.getId()
                + "\",\"presenterIds\":[],\"memberIds\":[" + ids + "]}";
    }

    private void rate(User rater, UUID pres, User target, int expected) throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, target.getId()),
                "{\"score\":80}").with(as(rater))).andExpect(status().is(expected));
    }

    @Test
    void 새_평가룸_기본_평가_규칙() {
        ProjectSettings d = ProjectSettings.defaults();
        assertThat(d.allowSelf()).isFalse();
        assertThat(d.allowSameTeam()).isTrue();
        assertThat(d.allowSameCrew()).isTrue();
        assertThat(d.allowEdit()).isTrue();
        assertThat(d.allowAdminRating()).isTrue();
        assertThat(d.showRatingStatus()).isFalse();
        assertThat(d.showRosterSummary()).isFalse();
    }

    @Test
    void 룸_관리자는_발표_구성원이_될_수_없다() throws Exception {
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), presentation("관리자 발표", "PERSONAL", owner))
                .with(as(owner))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("룸 관리자는 발표 구성원이 될 수 없습니다."));
        mvc.perform(json(post("/api/v1/projects/{p}/presentations", room), presentation("팀 발표", "TEAM", a, owner))
                .with(as(a))).andExpect(status().isBadRequest());
        assertThat(count("select count(*) from presentations")).isZero();
    }

    @Test
    void 발표_등록_요청은_관리자에게_보내지_않는다() throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, a.getId()), "{\"isAdmin\":true}").with(as(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(json(post("/api/v1/projects/{p}/presentation-requests", room),
                "{\"userIds\":[\"" + a.getId() + "\",\"" + b.getId() + "\"]}").with(as(owner)))
                .andExpect(jsonPath("$.sent").value(1));
    }

    @Test
    void 발표한_사람을_관리자로_지정하면_발표에서_빠진다() throws Exception {
        UUID solo = fixtures.personal(room, a);
        UUID team = fixtures.teamPresentation(room, b, List.of(), List.of(c));
        rate(owner, solo, a, 204);
        rate(owner, team, b, 204);

        // 지울 데이터가 있으면 확인한 version이 필요하다
        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, a.getId()), "{\"isAdmin\":true}").with(as(owner)))
                .andExpect(status().isConflict());
        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, a.getId()),
                "{\"isAdmin\":true,\"expectedVersion\":" + fixtures.version(room) + "}").with(as(owner)))
                .andExpect(status().isNoContent());
        assertThat(count("select count(*) from presentations where id = ?", solo)).isZero();

        mvc.perform(json(put("/api/v1/projects/{p}/members/{u}/admin", room, b.getId()),
                "{\"isAdmin\":true,\"expectedVersion\":" + fixtures.version(room) + "}").with(as(owner)))
                .andExpect(status().isNoContent());
        assertThat(count("select count(*) from presentation_members where presentation_id = ?", team)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select leader_id from presentations where id = ?", UUID.class, team)).isEqualTo(c.getId());
        assertThat(count("select count(*) from ratings")).isZero();
    }

    @Test
    void 관리자_평가를_끄면_관리자_평가가_지워지고_평가자_인원에서_빠진다() throws Exception {
        UUID pres = fixtures.personal(room, a);
        rate(owner, pres, a, 204);
        rate(b, pres, a, 204);
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.summaries[0].total").value(4));

        mvc.perform(json(put("/api/v1/projects/{p}/settings", room),
                "{\"min\":0,\"max\":100,\"allowAdminRating\":false,\"expectedVersion\":" + fixtures.version(room) + "}")
                .with(as(owner))).andExpect(status().isOk());
        assertThat(count("select count(*) from ratings where rater_id = ?", owner.getId())).isZero();
        assertThat(count("select count(*) from ratings")).isEqualTo(1);

        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, a.getId()), "{\"score\":80}")
                .with(as(owner))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("룸 관리자는 평가하지 않는 평가룸입니다."));
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.summaries[0].total").value(3))
                .andExpect(jsonPath("$.summaries[0].blocked").value(1)) // 본인 평가 불가만 남는다
                .andExpect(jsonPath("$.summaries[0].scored").value(1));
    }

    @Test
    void 룸_관리자_점수를_미포함하면_평균과_인원에서_모두_빠지고_다시_포함하면_돌아온다() throws Exception {
        UUID pres = fixtures.personal(room, a);
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, a.getId()), "{\"score\":60}")
                .with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, a.getId()), "{\"score\":100}")
                .with(as(b))).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/state").with(as(owner))).andExpect(jsonPath("$.summaries[0].avg").value(80.0));

        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"countAdmin\":false}")
                .with(as(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.summaries[0].avg").value(100.0))
                .andExpect(jsonPath("$.summaries[0].scored").value(1))
                .andExpect(jsonPath("$.summaries[0].total").value(3));
        // 점수는 지워지지 않는다
        assertThat(count("select count(*) from ratings")).isEqualTo(2);

        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"countAdmin\":true}")
                .with(as(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.summaries[0].avg").value(80.0))
                .andExpect(jsonPath("$.summaries[0].scored").value(2))
                .andExpect(jsonPath("$.summaries[0].total").value(4));
    }
}
