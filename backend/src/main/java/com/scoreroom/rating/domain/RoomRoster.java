package com.scoreroom.rating.domain;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.ProjectSettings;

/**
 * 한 평가룸의 참여자(참여 당시 팀)와 발표별 구성원을 메모리에 모은 것.
 * 평가 제출, 설정 변경 후 정리, 결과 집계가 같은 규칙으로 평가 가능 여부를 판단하도록 한다.
 */
public final class RoomRoster {

    private final List<Membership> members;
    private final Map<UUID, UUID> teamByUser = new HashMap<>();
    private final Set<UUID> adminIds = new java.util.HashSet<>();
    private final Map<UUID, Set<UUID>> crewByPresentation = new HashMap<>();

    public RoomRoster(List<Membership> members, Collection<PresentationMember> presentationMembers) {
        this.members = members;
        for (Membership m : members) {
            teamByUser.put(m.getUserId(), m.getTeamIdAtJoin());
            if (m.isAdmin()) {
                adminIds.add(m.getUserId());
            }
        }
        presentationMembers.stream()
                .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
                .forEach(pm -> crewByPresentation.computeIfAbsent(pm.getPresentationId(), k -> new LinkedHashSet<>())
                        .add(pm.getUserId()));
    }

    public List<Membership> members() {
        return members;
    }

    /** 평가하는 사람. 관리자 평가를 끈 평가룸이면 룸 관리자는 빠진다 */
    public List<Membership> raters(ProjectSettings settings) {
        return settings.allowAdminRating() ? members : members.stream().filter(m -> !m.isAdmin()).toList();
    }

    public boolean isAdmin(UUID userId) {
        return adminIds.contains(userId);
    }

    public Set<UUID> crewOf(UUID presentationId) {
        return crewByPresentation.getOrDefault(presentationId, Set.of());
    }

    /**
     * 이 점수를 집계(평균·순위)에 넣을지. 본인 점수는 본인 설정만 따르고,
     * 그 밖에는 같은 발표 팀원·같은 회사 팀원 설정 중 하나라도 빼라고 하면 뺀다. 룸 관리자 점수를 빼기로 했으면 관리자 점수는 뺀다
     */
    public boolean counts(ProjectSettings settings, UUID presentationId, UUID raterId, UUID targetId) {
        if (!settings.countAdmin() && adminIds.contains(raterId)) {
            return false;
        }
        if (raterId.equals(targetId)) {
            return settings.countSelf();
        }
        if (!settings.countSameCrew() && crewOf(presentationId).contains(raterId)) {
            return false;
        }
        UUID raterTeam = teamByUser.get(raterId);
        return settings.countSameTeam() || raterTeam == null || !raterTeam.equals(teamByUser.get(targetId));
    }

    public Optional<BlockReason> check(ProjectSettings settings, UUID presentationId, UUID raterId, UUID targetId) {
        if (!settings.allowAdminRating() && adminIds.contains(raterId)) {
            return Optional.of(BlockReason.ADMIN);
        }
        return RatingEligibilityPolicy.check(settings, raterId, targetId, crewOf(presentationId),
                teamByUser.get(raterId), teamByUser.get(targetId));
    }
}
