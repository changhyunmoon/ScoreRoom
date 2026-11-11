package com.scoreroom.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import com.scoreroom.organization.domain.Team;
import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

class RatingApiTest extends IntegrationTest {

    private User owner;
    private User sameTeam;
    private User otherTeam;
    private UUID room;

    @BeforeEach
    void setUp() {
        Team a = fixtures.team("A팀");
        Team b = fixtures.team("B팀");
        owner = fixtures.user("owner", a);
        sameTeam = fixtures.user("same", a);
        otherTeam = fixtures.user("other", b);
        room = fixtures.room(owner, sameTeam, otherTeam);
    }

    private ResultActions rate(User rater, UUID presentation, User target, String body) throws Exception {
        return mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/rating", room, presentation), body)
                .with(as(rater)));
    }

    @Test
    void 다른_팀_구성원은_평가하고_같은_평가는_한_건만_남는다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        rate(owner, pres, otherTeam, "{\"score\":70,\"feedback\":\"  좋았어요  \"}").andExpect(status().isNoContent());
        rate(owner, pres, otherTeam, "{\"score\":80}").andExpect(status().isNoContent());
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        assertThat(count("select score from ratings")).isEqualTo(80);
    }

    @Test
    void 본인_발표와_같은_팀의_발표는_평가할_수_없다() throws Exception {
        UUID mine = fixtures.personal(room, sameTeam);
        rate(sameTeam, mine, sameTeam, "{\"score\":70}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("본인 발표는 평가할 수 없습니다."));
        rate(owner, mine, sameTeam, "{\"score\":70}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("같은 회사 팀의 발표라 평가할 수 없습니다."));
    }

    @Test
    void 팀_발표는_발표_하나에_한_번만_평가하고_팀원은_자기_발표를_평가할_수_없다() throws Exception {
        User mate = fixtures.user("mate", null);
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"" + mate.getId() + "\"]}")
                .with(as(owner))).andExpect(status().isOk());
        UUID team = fixtures.teamPresentation(room, otherTeam, java.util.List.of(), java.util.List.of(mate));
        rate(owner, team, otherTeam, "{\"score\":70}").andExpect(status().isNoContent());
        rate(owner, team, mate, "{\"score\":90}").andExpect(status().isNoContent());
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        assertThat(count("select score from ratings")).isEqualTo(90);
        rate(mate, team, mate, "{\"score\":100}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("본인 발표는 평가할 수 없습니다."));
    }

    @Test
    void 점수는_범위_안의_정수만_받는다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        rate(owner, pres, otherTeam, "{\"score\":101}").andExpect(status().isBadRequest());
        rate(owner, pres, otherTeam, "{\"score\":72.5}").andExpect(status().isBadRequest());
        rate(owner, pres, otherTeam, "{}").andExpect(status().isBadRequest());
        assertThat(count("select count(*) from ratings")).isZero();
    }

    @Test
    void 수정이_막힌_평가룸은_같은_값의_재전송만_성공한다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room),
                "{\"min\":0,\"max\":100,\"allowEdit\":false}").with(as(owner))).andExpect(status().isOk());
        rate(owner, pres, otherTeam, "{\"score\":70}").andExpect(status().isNoContent());
        rate(owner, pres, otherTeam, "{\"score\":70}").andExpect(status().isNoContent());
        rate(owner, pres, otherTeam, "{\"score\":71}").andExpect(status().isConflict());
    }

    @Test
    void 마감된_평가룸에는_평가할_수_없다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        rate(owner, pres, otherTeam, "{\"score\":70}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_CLOSED"));
    }

    @Test
    void 참여자가_아니면_평가할_수_없다() throws Exception {
        User outsider = fixtures.user("outsider", null);
        UUID pres = fixtures.personal(room, otherTeam);
        rate(outsider, pres, otherTeam, "{\"score\":70}").andExpect(status().isForbidden());
    }
}
