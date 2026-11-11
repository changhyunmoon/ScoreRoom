package com.scoreroom.rating.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.scoreroom.project.domain.ProjectSettings;

/**
 * 평가자가 발표 하나를 평가할 수 있는지 판단하는 순수 규칙. 화면(eligibility.ts의 blockReason)과 같은 순서다.
 * 1. 평가자가 그 발표의 구성원이면(개인 발표 본인, 팀 발표 팀원) 본인 발표라 allowSelf만 본다.
 * 2. 발표 구성원 중 참여 당시 회사 팀이 평가자와 같은 사람이 있으면 allowSameTeam을 본다. 팀이 없는 사람은 같은 팀으로 보지 않는다.
 */
public final class RatingEligibilityPolicy {

    private RatingEligibilityPolicy() {
    }

    /**
     * @param crew       발표 구성원 전체 (대표·팀원)
     * @param raterTeam  평가자의 참여 당시 팀 (없으면 null)
     * @param crewTeams  발표 구성원들의 참여 당시 팀 (팀이 없는 사람은 빠져도 된다)
     * @return 평가할 수 없으면 이유, 평가할 수 있으면 비어 있음
     */
    public static Optional<BlockReason> check(ProjectSettings settings, UUID raterId, Set<UUID> crew, UUID raterTeam,
            Collection<UUID> crewTeams) {
        if (crew.contains(raterId)) {
            return settings.allowSelf() ? Optional.empty() : Optional.of(BlockReason.SELF);
        }
        if (!settings.allowSameTeam() && raterTeam != null && crewTeams.contains(raterTeam)) {
            return Optional.of(BlockReason.SAME_TEAM);
        }
        return Optional.empty();
    }
}
