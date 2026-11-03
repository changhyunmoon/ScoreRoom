package com.scoreroom.rating.domain;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.scoreroom.project.domain.ProjectSettings;

/**
 * 평가자가 발표 구성원 한 명을 평가할 수 있는지 판단하는 순수 규칙. 화면(logic.ts의 blockReason)과 같은 순서다.
 * 1. 본인이면 allowSelf만 본다.
 * 2. 평가자가 같은 발표의 구성원이면 allowSameCrew를 본다.
 * 3. 참여 당시 회사 팀이 같으면 allowSameTeam을 본다. 팀이 없는 두 사람은 같은 팀으로 보지 않는다.
 */
public final class RatingEligibilityPolicy {

    private RatingEligibilityPolicy() {
    }

    /**
     * @param crew        발표 구성원 전체 (대표·발표자·팀원)
     * @param raterTeam   평가자의 참여 당시 팀 (없으면 null)
     * @param targetTeam  평가 대상의 참여 당시 팀 (없으면 null)
     * @return 평가할 수 없으면 이유, 평가할 수 있으면 비어 있음
     */
    public static Optional<BlockReason> check(ProjectSettings settings, UUID raterId, UUID targetId, Set<UUID> crew,
            UUID raterTeam, UUID targetTeam) {
        if (targetId.equals(raterId)) {
            return settings.allowSelf() ? Optional.empty() : Optional.of(BlockReason.SELF);
        }
        if (!settings.allowSameCrew() && crew.contains(raterId)) {
            return Optional.of(BlockReason.SAME_CREW);
        }
        if (!settings.allowSameTeam() && raterTeam != null && raterTeam.equals(targetTeam)) {
            return Optional.of(BlockReason.SAME_TEAM);
        }
        return Optional.empty();
    }
}
