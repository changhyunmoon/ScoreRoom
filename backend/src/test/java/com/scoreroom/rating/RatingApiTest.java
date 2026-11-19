package com.scoreroom.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    private ResultActions unrate(User rater, UUID presentation) throws Exception {
        return mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}/rating", room, presentation).with(as(rater)));
    }

    @Test
    void 내가_준_점수만_지우고_다시_지워도_성공한다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        rate(owner, pres, otherTeam, "{\"score\":70,\"feedback\":\"잘못 입력\"}").andExpect(status().isNoContent());
        rate(sameTeam, pres, otherTeam, "{\"score\":60}").andExpect(status().isNoContent());

        unrate(owner, pres).andExpect(status().isNoContent());
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        assertThat(count("select score from ratings")).isEqualTo(60);
        unrate(owner, pres).andExpect(status().isNoContent());
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
        // 지운 뒤 다시 낼 수 있다
        rate(owner, pres, otherTeam, "{\"score\":80}").andExpect(status().isNoContent());
        assertThat(count("select count(*) from ratings")).isEqualTo(2);
    }

    @Test
    void 수정이_막혔거나_마감된_평가룸에서는_점수를_지울_수_없다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        rate(owner, pres, otherTeam, "{\"score\":70}").andExpect(status().isNoContent());
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room),
                "{\"min\":0,\"max\":100,\"allowEdit\":false}").with(as(owner))).andExpect(status().isOk());
        unrate(owner, pres).andExpect(status().isConflict());

        mvc.perform(post("/api/v1/projects/{p}/close", room).with(as(owner))).andExpect(status().isNoContent());
        unrate(owner, pres).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_CLOSED"));
        assertThat(count("select count(*) from ratings")).isEqualTo(1);
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

    @Test
    void 피드백_필수를_켜면_새로_제출하거나_수정할_때만_피드백을_확인한다() throws Exception {
        UUID pres = fixtures.personal(room, otherTeam);
        // 켜기 전에 피드백 없이 낸 평가는 그대로 남는다
        rate(sameTeam, pres, otherTeam, "{\"score\":60}").andExpect(status().isNoContent());
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"requireFeedback\":true}").with(as(owner)))
                .andExpect(status().isOk());
        assertThat(count("select count(*) from ratings where feedback is null")).isEqualTo(1);

        rate(owner, pres, otherTeam, "{\"score\":70}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("피드백을 입력해 주세요."));
        rate(owner, pres, otherTeam, "{\"score\":70,\"feedback\":\"   \"}").andExpect(status().isBadRequest());
        rate(owner, pres, otherTeam, "{\"score\":70,\"feedback\":\"좋았어요\"}").andExpect(status().isNoContent());
        // 피드백 없이 냈던 평가도 수정할 때는 피드백이 있어야 한다
        rate(sameTeam, pres, otherTeam, "{\"score\":65}").andExpect(status().isBadRequest());
    }
}
