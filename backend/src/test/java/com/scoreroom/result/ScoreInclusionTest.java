package com.scoreroom.result;

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

/**
 * 새 평가룸은 본인·같은 팀·같은 발표 팀원 평가를 기본으로 허용하고,
 * 결과 집계에 넣을 점수(본인 / 같은 발표 팀원 / 같은 회사 팀원이 준 점수)를 따로 고를 수 있다.
 */
class ScoreInclusionTest extends IntegrationTest {

    private User owner;
    private User leader;
    private User mate;
    private User teammate;
    private User outsider;
    private UUID room;
    private UUID pres;

    @BeforeEach
    void setUp() throws Exception {
        Team a = fixtures.team("A팀");
        Team b = fixtures.team("B팀");
        owner = fixtures.user("owner", b);
        leader = fixtures.user("leader", a);
        mate = fixtures.user("mate", null);
        teammate = fixtures.user("teammate", a);
        outsider = fixtures.user("outsider", b);
        fixtures.allowCreateRoom(owner);
        // API로 만든 새 평가룸 (기본 설정 그대로)
        String body = mvc.perform(json(post("/api/v1/projects"), "{\"name\":\"새 평가룸\",\"description\":\"\"}").with(as(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        room = UUID.fromString(body.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));
        mvc.perform(json(post("/api/v1/projects/{p}/members", room), "{\"userIds\":[\"%s\",\"%s\",\"%s\",\"%s\"]}"
                .formatted(leader.getId(), mate.getId(), teammate.getId(), outsider.getId())).with(as(owner)))
                .andExpect(status().isOk());
        pres = fixtures.teamPresentation(room, leader, List.of(), List.of(mate));
        rate(leader, 100);    // 본인
        rate(mate, 90);       // 같은 발표 팀원
        rate(teammate, 80);   // 같은 회사 팀 (A팀)
        rate(outsider, 60);   // 상관없는 사람
    }

    private void rate(User rater, int score) throws Exception {
        mvc.perform(json(put("/api/v1/projects/{p}/presentations/{pr}/ratings/{t}", room, pres, leader.getId()),
                "{\"score\":" + score + "}").with(as(rater))).andExpect(status().isNoContent());
    }

    private String leaderSummary(String field) {
        return "$.summaries[?(@.targetId == '" + leader.getId() + "')]." + field;
    }

    @Test
    void 새_평가룸은_본인_같은_팀_같은_발표_팀원_평가가_기본으로_허용되고_모든_점수가_집계에_들어간다() throws Exception {
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath("$.projects[0].settings.allowSelf").value(true))
                .andExpect(jsonPath("$.projects[0].settings.allowSameTeam").value(true))
                .andExpect(jsonPath("$.projects[0].settings.allowSameCrew").value(true))
                .andExpect(jsonPath("$.projects[0].settings.countSelf").value(true))
                .andExpect(jsonPath(leaderSummary("avg")).value(82.5));
    }

    @Test
    void 점수가_모두_집계_기준_밖이면_기준_평균은_0이고_점수가_없으면_비어_있다() throws Exception {
        // 받은 점수 100·90·80·60이 모두 0~10점 밖
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), "{\"min\":0,\"max\":100,\"aggMin\":0,\"aggMax\":10}").with(as(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath(leaderSummary("inCount")).value(0))
                .andExpect(jsonPath(leaderSummary("inAvg")).value(0.0))
                // mate는 아직 받은 점수가 없다
                .andExpect(jsonPath("$.summaries[?(@.targetId == '" + mate.getId() + "')].inAvg").value(org.hamcrest.Matchers.contains((Object) null)));
    }

    @Test
    void 집계에서_뺀_점수는_평균에서_빠지지만_평가함_인원에는_남는다() throws Exception {
        String body = "{\"min\":0,\"max\":100,\"countSelf\":%s,\"countSameCrew\":%s,\"countSameTeam\":%s}";
        // 본인 점수 제외 → (90 + 80 + 60) / 3
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), body.formatted(false, true, true)).with(as(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner)))
                .andExpect(jsonPath(leaderSummary("avg")).value(230.0 / 3))
                .andExpect(jsonPath(leaderSummary("scored")).value(4));
        // 같은 발표 팀원도 제외 → (80 + 60) / 2
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), body.formatted(false, false, true)).with(as(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner))).andExpect(jsonPath(leaderSummary("avg")).value(70.0));
        // 같은 회사 팀원도 제외 → 60
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), body.formatted(false, false, false)).with(as(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner))).andExpect(jsonPath(leaderSummary("avg")).value(60.0));
        // 점수는 지워지지 않는다: 다시 모두 포함하면 원래 평균
        mvc.perform(json(put("/api/v1/projects/{p}/settings", room), body.formatted(true, true, true)).with(as(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/state").with(as(owner))).andExpect(jsonPath(leaderSummary("avg")).value(82.5));
    }
}
