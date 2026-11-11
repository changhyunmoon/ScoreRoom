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

    /**
     * 집계에서 평가자로 세는 사람. 관리자 평가를 껐거나 룸 관리자가 준 점수를 미포함하면 룸 관리자는 빠진다
     * (인원·평가함·평균 모두에서 빠지고, 점수 자체는 지워지지 않는다)
     */
    public List<Membership> raters(ProjectSettings settings) {
        return settings.allowAdminRating() && settings.countAdmin()
                ? members : members.stream().filter(m -> !m.isAdmin()).toList();
    }

    public boolean isAdmin(UUID userId) {
        return adminIds.contains(userId);
    }

    public Set<UUID> crewOf(UUID presentationId) {
        return crewByPresentation.getOrDefault(presentationId, Set.of());
    }

    /** 발표 구성원들의 참여 당시 회사 팀 (팀이 없는 사람은 빠진다) */
    private Set<UUID> crewTeams(UUID presentationId) {
        Set<UUID> teams = new java.util.HashSet<>();
        for (UUID userId : crewOf(presentationId)) {
            UUID team = teamByUser.get(userId);
            if (team != null) {
                teams.add(team);
            }
        }
        return teams;
    }

    /**
     * 이 점수를 집계(평균·순위)에 넣을지. 본인 발표(구성원이 준 점수)는 본인 설정만 따르고,
     * 그 밖에는 구성원 중 같은 회사 팀인 사람이 있으면 같은 팀 설정을 따른다. 룸 관리자 점수를 빼기로 했으면 관리자 점수는 뺀다
     */
    public boolean counts(ProjectSettings settings, UUID presentationId, UUID raterId) {
        if (!settings.countAdmin() && adminIds.contains(raterId)) {
            return false;
        }
        if (crewOf(presentationId).contains(raterId)) {
            return settings.countSelf();
        }
        UUID raterTeam = teamByUser.get(raterId);
        return settings.countSameTeam() || raterTeam == null || !crewTeams(presentationId).contains(raterTeam);
    }

    public Optional<BlockReason> check(ProjectSettings settings, UUID presentationId, UUID raterId) {
        if (!settings.allowAdminRating() && adminIds.contains(raterId)) {
            return Optional.of(BlockReason.ADMIN);
        }
        return RatingEligibilityPolicy.check(settings, raterId, crewOf(presentationId), teamByUser.get(raterId),
                crewTeams(presentationId));
    }
}
