package com.scoreroom.result.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.scoreroom.project.domain.ProjectSettings;

/** 극단값 제외 규칙 (화면 computeResults의 trimScores와 같은 규칙) */
class SummaryCalculatorTrimTest {

    private static ProjectSettings trim(int top, int bottom) {
        return new ProjectSettings(0, 10, null, null, false, true, true, true, false, true, true, true, true, true,
                false, false, false, top, bottom, false);
    }

    @Test
    void 같은_점수가_여럿이어도_개수만큼만_뺀다() {
        List<Integer> scores = List.of(1, 1, 3, 5, 7, 7, 8, 8, 8);
        assertThat(SummaryCalculator.trim(scores, trim(1, 1))).containsExactly(1, 3, 5, 7, 7, 8, 8);
    }

    @Test
    void 위아래_개수를_따로_정할_수_있다() {
        assertThat(SummaryCalculator.trim(List.of(5, 1, 9, 7, 3), trim(2, 0))).containsExactly(1, 3, 5);
        assertThat(SummaryCalculator.trim(List.of(5, 1, 9, 7, 3), trim(0, 1))).containsExactly(3, 5, 7, 9);
    }

    @Test
    void 빼는_개수가_점수보다_많으면_모두_빠진다() {
        assertThat(SummaryCalculator.trim(List.of(2, 9), trim(1, 1))).isEmpty();
        assertThat(SummaryCalculator.trim(List.of(2, 9, 4), trim(1, 1))).containsExactly(4);
        assertThat(SummaryCalculator.trim(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), trim(5, 6))).isEmpty();
        assertThat(SummaryCalculator.trim(List.of(), trim(1, 1))).isEmpty();
    }

    @Test
    void 사용_안_함이면_그대로_둔다() {
        assertThat(SummaryCalculator.trim(List.of(9, 1, 5), trim(0, 0))).containsExactly(9, 1, 5);
    }
}
