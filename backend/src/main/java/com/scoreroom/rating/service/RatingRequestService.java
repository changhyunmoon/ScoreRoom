package com.scoreroom.rating.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.notification.service.NotificationService;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.domain.RoomRoster;
import com.scoreroom.rating.repository.RatingRepository;

/** 룸 관리자가 발표 하나를 아직 평가하지 않은 사람에게 '평가 요청' 알림을 보낸다 */
@Service
public class RatingRequestService {

    private final RoomGuard roomGuard;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final MembershipRepository memberships;
    private final RatingRepository ratings;
    private final NotificationService notifications;
    private final LogService logs;

    public RatingRequestService(RoomGuard roomGuard, PresentationRepository presentations,
            PresentationMemberRepository presentationMembers, MembershipRepository memberships, RatingRepository ratings,
            NotificationService notifications, LogService logs) {
        this.roomGuard = roomGuard;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.memberships = memberships;
        this.ratings = ratings;
        this.notifications = notifications;
        this.logs = logs;
    }

    /**
     * 고른 사람 중 지금 이 발표를 평가할 수 있는데 아직 평가하지 않은 참여자에게만 보낸다
     * (그 사이 평가했거나, 나갔거나, 평가할 수 없게 된 사람, 요청한 본인은 건너뜀). 실제로 보낸 인원을 돌려준다.
     */
    @Transactional
    public int request(UUID actorId, UUID projectId, UUID presentationId, List<UUID> userIds) {
        RoomWrite room = roomGuard.lockAsAdmin(projectId, actorId);
        String title = presentations.findByIdAndProjectId(presentationId, projectId).map(p -> p.getTitle())
                .orElseThrow(() -> ApiException.notFound("발표를 찾을 수 없습니다."));
        Set<UUID> ids = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        if (ids.isEmpty()) {
            throw ApiException.badRequest("요청을 보낼 사람을 선택해 주세요.");
        }
        ProjectSettings settings = room.project().settings();
        RoomRoster roster = new RoomRoster(memberships.findByProjectId(projectId),
                presentationMembers.findByPresentationId(presentationId));
        Set<UUID> raters = roster.raters(settings).stream().map(Membership::getUserId).collect(Collectors.toSet());
        Set<UUID> rated = ratings.findByProjectId(projectId).stream()
                .filter(r -> r.getPresentationId().equals(presentationId))
                .map(Rating::getRaterId).collect(Collectors.toSet());
        int sent = 0;
        List<String> names = new ArrayList<>();
        for (UUID userId : ids) {
            if (userId.equals(actorId) || !raters.contains(userId) || rated.contains(userId)
                    || roster.check(settings, presentationId, userId).isPresent()) {
                continue;
            }
            notifications.ratingRequested(userId, projectId, presentationId, actorId);
            names.add(logs.userName(userId));
            sent++;
        }
        if (sent > 0) {
            logs.activity(actorId, projectId, LogAction.RATING_REQUESTED,
                    "'" + title + "' 발표 평가 요청 알림 " + sent + "명: " + String.join(", ", names));
        }
        return sent;
    }
}
