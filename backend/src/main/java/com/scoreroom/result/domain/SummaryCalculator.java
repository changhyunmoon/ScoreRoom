package com.scoreroom.result.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.scoreroom.presentation.domain.Crew;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.domain.RoomRoster;
import com.scoreroom.result.dto.SummaryResponse;

/** 발표 구성원별 결과 집계 (순수 계산). 결과 계산의 기준은 서버다 */
public final class SummaryCalculator {

    private SummaryCalculator() {
    }

    /** 발표 순서 → 구성원 순서(대표·발표자·팀원)로 한 줄씩 */
    public static List<SummaryResponse> summarize(ProjectSettings settings, RoomRoster roster,
            List<Presentation> presentations, Map<UUID, Crew> crews, List<Rating> ratings) {
        Map<String, List<Rating>> byTarget = ratings.stream()
                .collect(Collectors.groupingBy(r -> key(r.getPresentationId(), r.getTargetId())));
        // 관리자 평가를 껐거나 룸 관리자가 준 점수를 미포함하면 관리자는 평가자 인원에서 아예 빠진다 (평가 불가로 세지 않음)
        List<Membership> members = roster.raters(settings);
        Set<UUID> raterIds = members.stream().map(Membership::getUserId).collect(Collectors.toSet());
        List<SummaryResponse> rows = new ArrayList<>();
        for (Presentation p : presentations) {
            Crew crew = crews.get(p.getId());
            if (crew == null) {
                continue;
            }
            for (UUID targetId : crew.everyone()) {
                // 평가자로 세지 않는 사람(빠진 룸 관리자)이 준 점수는 평가함·평균에서도 뺀다
                List<Rating> received = byTarget.getOrDefault(key(p.getId(), targetId), List.of()).stream()
                        .filter(r -> raterIds.contains(r.getRaterId())).toList();
                Set<UUID> raters = received.stream().map(Rating::getRaterId).collect(Collectors.toSet());
                int blocked = 0;
                int notRated = 0;
                for (Membership m : members) {
                    if (raters.contains(m.getUserId())) {
                        continue;
                    }
                    if (roster.check(settings, p.getId(), m.getUserId(), targetId).isPresent()) {
                        blocked++;
                    } else {
                        notRated++;
                    }
                }
                // 평균·순위에는 집계에 넣기로 한 점수만 쓴다 (평가함 인원은 제출한 사람 모두)
                List<Integer> scores = received.stream()
                        .filter(r -> roster.counts(settings, p.getId(), r.getRaterId(), targetId))
                        .map(Rating::getScore).toList();
                List<Integer> inRange = settings.hasAggregationRange()
                        ? scores.stream().filter(s -> s >= settings.aggMin() && s <= settings.aggMax()).toList()
                        : List.of();
                rows.add(new SummaryResponse(p.getId(), targetId, members.size(), blocked, members.size() - blocked,
                        received.size(), notRated, average(scores), inRange.size(), inRangeAverage(settings, scores, inRange)));
            }
        }
        return rows;
    }

    /**
     * 집계 기준 평균. 기준을 쓰고 집계에 넣는 점수가 있는데 모두 기준 밖이면 0점이다 (점수가 하나도 없으면 null)
     */
    private static Double inRangeAverage(ProjectSettings settings, List<Integer> scores, List<Integer> inRange) {
        if (!settings.hasAggregationRange() || scores.isEmpty()) {
            return null;
        }
        return inRange.isEmpty() ? 0.0 : average(inRange);
    }

    private static Double average(List<Integer> values) {
        return values.isEmpty() ? null : values.stream().mapToInt(Integer::intValue).average().orElseThrow();
    }

    private static String key(UUID presentationId, UUID targetId) {
        return presentationId + ":" + targetId;
    }
}
