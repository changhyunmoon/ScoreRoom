package com.scoreroom.presentation.service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.presentation.domain.Crew;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.dto.SavePresentationRequest;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;

/** 발표 등록·수정·삭제와 순서 */
@Service
public class PresentationService {

    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final MembershipRepository memberships;
    private final RatingRepository ratings;
    private final RoomGuard roomGuard;
    private final PresentationRemover remover;
    private final UserRepository users;

    public PresentationService(PresentationRepository presentations, PresentationMemberRepository presentationMembers,
            MembershipRepository memberships, RatingRepository ratings, RoomGuard roomGuard, PresentationRemover remover,
            UserRepository users) {
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.memberships = memberships;
        this.ratings = ratings;
        this.roomGuard = roomGuard;
        this.remover = remover;
        this.users = users;
    }

    /** 참여자 누구나 등록한다. 만든 사람이 발표를 수정할 수 있다 */
    @Transactional
    public UUID create(UUID actorId, UUID projectId, SavePresentationRequest request) {
        RoomWrite room = roomGuard.lockAsMember(projectId, actorId);
        Crew crew = validateCrew(room, request, null);
        ensureTitleUnique(projectId, request.title().trim());
        Presentation presentation = new Presentation(projectId, actorId, presentations.findMaxSortOrder(projectId) + 1);
        describe(presentation, request, crew);
        presentations.save(presentation);
        syncMembers(presentation, crew, List.of());
        return presentation.getId();
    }

    /** 점수를 받은 발표는 평가 대상이 바뀌지 않도록 구성원 추가·제외를 막고 역할 변경만 허용한다 */
    @Transactional
    public void update(UUID actorId, UUID projectId, UUID presentationId, SavePresentationRequest request) {
        RoomWrite room = roomGuard.lockAsMember(projectId, actorId);
        Presentation presentation = requireEditable(room, presentationId);
        Crew crew = validateCrew(room, request, presentationId);
        List<PresentationMember> current = presentationMembers.findByPresentationId(presentationId);
        Set<UUID> before = current.stream().map(PresentationMember::getUserId).collect(Collectors.toSet());
        if (!before.equals(new HashSet<>(crew.everyone())) && ratings.existsByPresentationId(presentationId)) {
            throw ApiException.badRequest("점수를 받은 발표는 구성원을 추가하거나 뺄 수 없습니다.");
        }
        String title = request.title().trim();
        if (!title.equalsIgnoreCase(presentation.getTitle())) {
            ensureTitleUnique(projectId, title);
        }
        describe(presentation, request, crew);
        syncMembers(presentation, crew, current);
    }

    /** 수정할 수 있는 사람이 삭제한다. 점수를 받은 발표는 남의 평가가 함께 지워지므로 룸 관리자만 지운다 */
    @Transactional
    public void delete(UUID actorId, UUID projectId, UUID presentationId) {
        RoomWrite room = roomGuard.lockAsMember(projectId, actorId);
        Presentation presentation = requireEditable(room, presentationId);
        if (!room.membership().isAdmin() && ratings.existsByPresentationId(presentationId)) {
            throw ApiException.forbidden("점수를 받은 발표는 룸 관리자만 삭제할 수 있습니다.");
        }
        remover.remove(presentation);
    }

    /** 한 칸 위(-1)·아래(+1)로 옮긴다 */
    @Transactional
    public void move(UUID actorId, UUID projectId, UUID presentationId, int dir) {
        roomGuard.lockAsAdmin(projectId, actorId);
        List<Presentation> list = presentations.findByProjectIdOrderBySortOrderAscIdAsc(projectId);
        int from = indexOf(list, presentationId);
        int to = from + Integer.signum(dir);
        if (to < 0 || to >= list.size()) {
            return;
        }
        int a = list.get(from).getSortOrder();
        int b = list.get(to).getSortOrder();
        list.get(from).changeSortOrder(a == b ? to + 1 : b);
        list.get(to).changeSortOrder(a == b ? from + 1 : a);
    }

    /** 전체 순서를 저장한다. 그 사이 발표가 추가·삭제됐으면 409 */
    @Transactional
    public void reorder(UUID actorId, UUID projectId, List<UUID> orderedIds) {
        roomGuard.lockAsAdmin(projectId, actorId);
        Map<UUID, Presentation> byId = presentations.findByProjectIdOrderBySortOrderAscIdAsc(projectId).stream()
                .collect(Collectors.toMap(Presentation::getId, Function.identity()));
        if (orderedIds.size() != byId.size() || !byId.keySet().equals(new HashSet<>(orderedIds))) {
            throw ApiException.conflict("발표 목록이 바뀌었습니다. 다시 시도해 주세요.");
        }
        for (int i = 0; i < orderedIds.size(); i++) {
            byId.get(orderedIds.get(i)).changeSortOrder(i + 1);
        }
    }

    private Presentation require(UUID projectId, UUID presentationId) {
        return presentations.findByIdAndProjectId(presentationId, projectId)
                .orElseThrow(() -> ApiException.notFound("발표를 찾을 수 없습니다."));
    }

    private Presentation requireEditable(RoomWrite room, UUID presentationId) {
        Presentation presentation = require(room.projectId(), presentationId);
        UUID actorId = room.membership().getUserId();
        boolean crew = presentationMembers.existsByPresentationIdAndUserId(presentationId, actorId);
        if (!presentation.canBeEditedBy(actorId, room.membership().isAdmin(), crew)) {
            throw ApiException.forbidden("발표 구성원, 발표를 만든 사람, 룸 관리자만 수정·삭제할 수 있습니다.");
        }
        return presentation;
    }

    /** 같은 평가룸 안에서 발표 제목은 겹칠 수 없다 (대소문자 무시). 룸 잠금 안에서 부른다 */
    private void ensureTitleUnique(UUID projectId, String title) {
        if (presentations.existsByProjectIdAndTitleIgnoreCase(projectId, title)) {
            throw ApiException.conflict("이 평가룸에 같은 제목의 발표가 이미 있습니다. 다른 제목을 입력해 주세요.");
        }
    }

    /** presentationId: 수정 중인 발표 (새 발표면 null) */
    private Crew validateCrew(RoomWrite room, SavePresentationRequest request, UUID presentationId) {
        Crew crew = Crew.normalize(request.type(), request.leaderId(), request.presenterIds(), request.memberIds());
        List<Membership> roomMemberships = memberships.findByProjectId(room.projectId());
        Set<UUID> roomMembers = roomMemberships.stream().map(Membership::getUserId).collect(Collectors.toSet());
        List<UUID> everyone = crew.everyone();
        if (!roomMembers.containsAll(everyone)) {
            throw ApiException.badRequest("평가룸 참여자만 구성원으로 등록할 수 있습니다.");
        }
        // 룸 관리자는 발표하지 않는다. 예전에 이미 구성원이던 관리자는 이 발표를 고칠 때 그대로 둘 수 있다
        Set<UUID> already = presentationId == null ? Set.of() : presentationMembers.findByProjectId(room.projectId()).stream()
                .filter(m -> m.getPresentationId().equals(presentationId))
                .map(PresentationMember::getUserId).collect(Collectors.toSet());
        boolean adminAdded = roomMemberships.stream()
                .anyMatch(m -> m.isAdmin() && everyone.contains(m.getUserId()) && !already.contains(m.getUserId()));
        if (adminAdded) {
            throw ApiException.badRequest("룸 관리자는 발표 구성원이 될 수 없습니다.");
        }
        UUID actorId = room.membership().getUserId();
        if (!room.membership().isAdmin() && !everyone.contains(actorId)) {
            throw ApiException.badRequest("본인을 구성원에서 뺄 수 없습니다. 대표·발표자·팀원 중 하나를 선택해 주세요.");
        }
        ensureNotInOtherPresentation(room.projectId(), everyone, presentationId);
        return crew;
    }

    /**
     * 한 사람은 평가룸에서 발표 하나에만 참여한다. 팀 발표는 한 명이 등록하면 구성원 전원이 그 발표로 등록되므로,
     * 다른 발표에 이미 들어 있는 사람은 구성원으로 넣을 수 없다. 룸 잠금 안에서 부르므로 동시에 등록해도 겹치지 않는다.
     */
    private void ensureNotInOtherPresentation(UUID projectId, List<UUID> everyone, UUID presentationId) {
        Set<UUID> crew = new HashSet<>(everyone);
        List<UUID> taken = presentationMembers.findByProjectId(projectId).stream()
                .filter(m -> crew.contains(m.getUserId()) && !m.getPresentationId().equals(presentationId))
                .map(PresentationMember::getUserId)
                .distinct()
                .toList();
        if (!taken.isEmpty()) {
            String names = users.findAllById(taken).stream().map(User::getName).sorted().collect(Collectors.joining(", "));
            throw ApiException.conflict("다른 발표에 이미 등록된 사람이 있습니다: " + names + ". 한 사람은 발표 하나에만 참여할 수 있습니다.");
        }
    }

    private static void describe(Presentation presentation, SavePresentationRequest request, Crew crew) {
        String intro = request.intro() == null ? "" : request.intro().trim();
        presentation.describe(request.title().trim(), intro, request.type(), normalizeUrl(request.deployUrl()));
        presentation.changeLeader(crew.leaderId());
    }

    /** 구성원 행을 원하는 구성으로 맞춘다. 순서는 대표 → 발표자 → 팀원 */
    private void syncMembers(Presentation presentation, Crew crew, List<PresentationMember> current) {
        Map<UUID, PresentationMember> existing = current.stream()
                .collect(Collectors.toMap(PresentationMember::getUserId, Function.identity()));
        List<UUID> everyone = crew.everyone();
        List<PresentationMember> toSave = new ArrayList<>();
        for (int i = 0; i < everyone.size(); i++) {
            UUID userId = everyone.get(i);
            PresentationMember row = existing.remove(userId);
            if (row == null) {
                toSave.add(new PresentationMember(presentation.getProjectId(), presentation.getId(), userId,
                        crew.isPresenter(userId), i));
            } else {
                row.assignRole(crew.isPresenter(userId), i);
            }
        }
        presentationMembers.deleteAll(existing.values());
        presentationMembers.saveAll(toSave);
    }

    private static int indexOf(List<Presentation> list, UUID presentationId) {
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getId().equals(presentationId)) {
                return i;
            }
        }
        throw ApiException.notFound("발표를 찾을 수 없습니다.");
    }

    /** 배포 URL은 http/https만 받는다. 서버가 이 주소를 직접 불러오지는 않는다 */
    static String normalizeUrl(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            return null;
        }
        if (value.length() > 500) {
            throw ApiException.badRequest("배포 URL은 500자 이하로 입력해 주세요.");
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if ((scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null) {
                return value;
            }
        } catch (URISyntaxException e) {
            // 아래에서 같은 안내를 한다
        }
        throw ApiException.badRequest("배포 URL은 http:// 또는 https://로 시작하는 주소로 입력해 주세요.");
    }
}
