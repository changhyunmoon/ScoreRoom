package com.scoreroom.rating.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.scoreroom.project.domain.ProjectSettings;

/** 화면(logic.ts의 blockReason)과 같은 판단 순서를 확인한다 */
class RatingEligibilityPolicyTest {

    private final UUID rater = UUID.randomUUID();
    private final UUID target = UUID.randomUUID();
    private final UUID teamA = UUID.randomUUID();
    private final UUID teamB = UUID.randomUUID();

    private static ProjectSettings rules(boolean self, boolean sameTeam, boolean sameCrew) {
        return new ProjectSettings(0, 100, null, null, self, sameTeam, sameCrew, true, true, true, true, true, true);
    }

    @Test
    void 기본_설정에서는_본인을_평가할_수_없다() {
        assertThat(RatingEligibilityPolicy.check(rules(false, false, false), rater, rater, Set.of(rater), teamA, teamA))
                .contains(BlockReason.SELF);
        assertThat(RatingEligibilityPolicy.check(rules(true, false, false), rater, rater, Set.of(rater), teamA, teamA))
                .isEmpty();
    }

    @Test
    void 본인_평가를_허용하면_같은_발표나_같은_팀_제한보다_먼저_판단한다() {
        assertThat(RatingEligibilityPolicy.check(rules(true, false, false), rater, rater, Set.of(rater, target), teamA, teamA))
                .isEmpty();
    }

    @Test
    void 같은_발표_구성원은_허용하지_않으면_평가할_수_없다() {
        Set<UUID> crew = Set.of(rater, target);
        assertThat(RatingEligibilityPolicy.check(rules(false, true, false), rater, target, crew, teamA, teamB))
                .contains(BlockReason.SAME_CREW);
        assertThat(RatingEligibilityPolicy.check(rules(false, true, true), rater, target, crew, teamA, teamB))
                .isEmpty();
    }

    @Test
    void 같은_발표_제한이_같은_팀_제한보다_먼저다() {
        Set<UUID> crew = Set.of(rater, target);
        assertThat(RatingEligibilityPolicy.check(rules(false, false, false), rater, target, crew, teamA, teamA))
                .contains(BlockReason.SAME_CREW);
    }

    @Test
    void 참여_당시_같은_회사_팀이면_허용하지_않는_한_평가할_수_없다() {
        Set<UUID> crew = Set.of(target);
        assertThat(RatingEligibilityPolicy.check(rules(false, false, false), rater, target, crew, teamA, teamA))
                .contains(BlockReason.SAME_TEAM);
        assertThat(RatingEligibilityPolicy.check(rules(false, true, false), rater, target, crew, teamA, teamA))
                .isEmpty();
        assertThat(RatingEligibilityPolicy.check(rules(false, false, false), rater, target, crew, teamA, teamB))
                .isEmpty();
    }

    @Test
    void 팀이_없는_두_사람은_같은_팀으로_보지_않는다() {
        assertThat(RatingEligibilityPolicy.check(rules(false, false, false), rater, target, Set.of(target), null, null))
                .isEmpty();
    }
}
