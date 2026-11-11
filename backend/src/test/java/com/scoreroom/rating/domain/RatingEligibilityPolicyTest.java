package com.scoreroom.rating.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.scoreroom.project.domain.ProjectSettings;

/** 화면(eligibility.ts의 blockReason)과 같은 판단 순서를 확인한다. 평가 대상은 발표 하나다 */
class RatingEligibilityPolicyTest {

    private final UUID rater = UUID.randomUUID();
    private final UUID leader = UUID.randomUUID();
    private final UUID mate = UUID.randomUUID();
    private final UUID teamA = UUID.randomUUID();
    private final UUID teamB = UUID.randomUUID();

    private static ProjectSettings rules(boolean self, boolean sameTeam) {
        return new ProjectSettings(0, 100, null, null, self, sameTeam, true, true, true, true, true, true, true, true, false, false, false);
    }

    @Test
    void 기본_설정에서는_본인_개인_발표를_평가할_수_없다() {
        assertThat(RatingEligibilityPolicy.check(rules(false, true), rater, Set.of(rater), teamA, Set.of(teamA)))
                .contains(BlockReason.SELF);
        assertThat(RatingEligibilityPolicy.check(rules(true, true), rater, Set.of(rater), teamA, Set.of(teamA)))
                .isEmpty();
    }

    @Test
    void 팀_발표의_팀원도_본인_발표로_본다() {
        Set<UUID> crew = Set.of(leader, rater);
        assertThat(RatingEligibilityPolicy.check(rules(false, true), rater, crew, teamA, Set.of(teamB)))
                .contains(BlockReason.SELF);
        assertThat(RatingEligibilityPolicy.check(rules(true, false), rater, crew, teamA, Set.of(teamA)))
                .isEmpty();
    }

    @Test
    void 구성원_중_한_명이라도_같은_회사_팀이면_허용하지_않는_한_평가할_수_없다() {
        Set<UUID> crew = Set.of(leader, mate);
        assertThat(RatingEligibilityPolicy.check(rules(false, false), rater, crew, teamA, Set.of(teamB, teamA)))
                .contains(BlockReason.SAME_TEAM);
        assertThat(RatingEligibilityPolicy.check(rules(false, true), rater, crew, teamA, Set.of(teamB, teamA)))
                .isEmpty();
        assertThat(RatingEligibilityPolicy.check(rules(false, false), rater, crew, teamA, Set.of(teamB)))
                .isEmpty();
    }

    @Test
    void 팀이_없는_평가자는_같은_팀으로_보지_않는다() {
        assertThat(RatingEligibilityPolicy.check(rules(false, false), rater, Set.of(leader), null, Set.of()))
                .isEmpty();
    }
}
