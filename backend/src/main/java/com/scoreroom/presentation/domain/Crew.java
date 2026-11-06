package com.scoreroom.presentation.domain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/**
 * 발표 구성원 구성.
 * - leaderId: 대표 1명
 * - presenterIds: 예전의 발표자 구분. 이제 발표자 개념이 없어 새로 저장할 때는 항상 비어 있다 (예전 데이터 읽기용)
 * - memberIds: 대표를 뺀 팀원
 * 개인 발표는 대표 한 명뿐이다.
 */
public record Crew(UUID leaderId, List<UUID> presenterIds, List<UUID> memberIds) {

    /**
     * 화면에서 받은 값을 정리한다. 발표자 구분은 없으므로 예전 화면이 보낸 발표자도 팀원으로 받는다.
     * 중복과 대표를 빼고, 개인 발표는 대표만 남긴다
     */
    public static Crew normalize(PresentationType type, UUID leaderId, Collection<UUID> presenters,
            Collection<UUID> members) {
        if (type == PresentationType.PERSONAL) {
            return new Crew(leaderId, List.of(), List.of());
        }
        LinkedHashSet<UUID> all = new LinkedHashSet<>();
        if (presenters != null) {
            all.addAll(presenters);
        }
        if (members != null) {
            all.addAll(members);
        }
        all.remove(leaderId);
        return new Crew(leaderId, List.of(), List.copyOf(all));
    }

    /** 저장된 구성원 행에서 다시 만든다 */
    public static Crew fromMembers(UUID leaderId, Collection<PresentationMember> rows) {
        List<PresentationMember> sorted = rows.stream()
                .sorted(Comparator.comparingInt(PresentationMember::getSortOrder))
                .toList();
        List<UUID> presenterIds = sorted.stream().filter(PresentationMember::isPresenter)
                .map(PresentationMember::getUserId).toList();
        List<UUID> memberIds = sorted.stream()
                .filter(m -> !m.isPresenter() && !m.getUserId().equals(leaderId))
                .map(PresentationMember::getUserId).toList();
        return new Crew(leaderId, presenterIds, memberIds);
    }

    /** 대표 → 발표자 → 팀원 순서의 구성원 전체 (한 사람은 한 번만) */
    public List<UUID> everyone() {
        LinkedHashSet<UUID> all = new LinkedHashSet<>();
        all.add(leaderId);
        all.addAll(presenterIds);
        all.addAll(memberIds);
        return new ArrayList<>(all);
    }

    public boolean isPresenter(UUID userId) {
        return presenterIds.contains(userId);
    }
}
