package com.scoreroom.rating.service;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.domain.RoomRoster;
import com.scoreroom.rating.dto.SubmitRatingRequest;
import com.scoreroom.rating.repository.RatingRepository;

/** 평가 제출과, 설정 변경으로 규칙에 맞지 않게 된 평가 찾기 */
@Service
public class RatingService {

    public static final int MAX_FEEDBACK_LENGTH = 1000;

    private final RatingRepository ratings;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final MembershipRepository memberships;
    private final RoomGuard roomGuard;
    private final Clock clock;

    public RatingService(RatingRepository ratings, PresentationRepository presentations,
            PresentationMemberRepository presentationMembers, MembershipRepository memberships, RoomGuard roomGuard,
            Clock clock) {
        this.ratings = ratings;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.memberships = memberships;
        this.roomGuard = roomGuard;
        this.clock = clock;
    }

    /**
     * 발표 구성원 한 명에게 점수를 준다. 평가룸을 잠그므로 마감·설정 변경과 순서가 섞이지 않는다.
     * 수정이 막힌 평가룸에서 같은 값을 다시 보내면(응답 유실 후 재시도) 성공으로 처리하고, 다른 값이면 409.
     */
    @Transactional
    public void submit(UUID raterId, UUID projectId, UUID presentationId, UUID targetId, SubmitRatingRequest request) {
        RoomWrite room = roomGuard.lockAsMember(projectId, raterId);
        presentations.findByIdAndProjectId(presentationId, projectId)
                .orElseThrow(() -> ApiException.notFound("발표를 찾을 수 없습니다."));
        RoomRoster roster = new RoomRoster(memberships.findByProjectId(projectId),
                presentationMembers.findByPresentationId(presentationId));
        if (!roster.crewOf(presentationId).contains(targetId)) {
            throw ApiException.badRequest("이 발표의 구성원이 아닙니다.");
        }
        ProjectSettings settings = room.project().settings();
        roster.check(settings, presentationId, raterId, targetId).ifPresent(reason -> {
            throw ApiException.badRequest(reason.message());
        });
        int score = request.score();
        if (score < settings.min() || score > settings.max()) {
            throw ApiException.badRequest("점수는 " + settings.min() + "~" + settings.max() + " 사이여야 합니다.");
        }
        String feedback = normalizeFeedback(request.feedback());

        Optional<Rating> existing = ratings.findByPresentationIdAndTargetIdAndRaterId(presentationId, targetId, raterId);
        if (existing.isEmpty()) {
            ratings.save(new Rating(projectId, presentationId, targetId, raterId, score, feedback, clock.instant()));
            return;
        }
        Rating rating = existing.get();
        if (rating.sameAs(score, feedback)) {
            return;
        }
        if (!settings.allowEdit()) {
            throw ApiException.conflict("이 평가룸은 제출한 점수를 수정할 수 없습니다.");
        }
        rating.overwrite(score, feedback, clock.instant());
    }

    /** 새 설정의 평가 규칙(본인·같은 발표·같은 팀)에 맞지 않게 되는 기존 평가 */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<UUID> findBlockedBy(UUID projectId, ProjectSettings next) {
        RoomRoster roster = new RoomRoster(memberships.findByProjectId(projectId),
                presentationMembers.findByProjectId(projectId));
        return ratings.findByProjectId(projectId).stream()
                .filter(r -> roster.check(next, r.getPresentationId(), r.getRaterId(), r.getTargetId()).isPresent())
                .map(Rating::getId)
                .toList();
    }

    private static String normalizeFeedback(String raw) {
        String feedback = raw == null ? "" : raw.trim();
        if (feedback.length() > MAX_FEEDBACK_LENGTH) {
            throw ApiException.badRequest("피드백은 " + MAX_FEEDBACK_LENGTH + "자 이하로 입력해 주세요.");
        }
        return feedback.isEmpty() ? null : feedback;
    }
}
