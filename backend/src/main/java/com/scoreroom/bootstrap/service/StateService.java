package com.scoreroom.bootstrap.service;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.attachment.dto.AttachmentResponse;
import com.scoreroom.attachment.service.AttachmentService;
import com.scoreroom.bootstrap.dto.StateResponse;
import com.scoreroom.common.web.Times;
import com.scoreroom.invitation.domain.InviteCode;
import com.scoreroom.invitation.domain.Invitation;
import com.scoreroom.invitation.dto.InvitationResponse;
import com.scoreroom.invitation.dto.InviteCodeResponse;
import com.scoreroom.invitation.repository.InvitationRepository;
import com.scoreroom.invitation.repository.InviteCodeRepository;
import com.scoreroom.organization.service.TeamService;
import com.scoreroom.presentation.domain.Crew;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.dto.PresentationResponse;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.Membership;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.dto.MembershipResponse;
import com.scoreroom.project.dto.ProjectResponse;
import com.scoreroom.project.repository.MembershipRepository;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.domain.RoomRoster;
import com.scoreroom.rating.dto.RatingResponse;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.result.domain.SummaryCalculator;
import com.scoreroom.result.dto.SummaryResponse;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.dto.UserResponse;
import com.scoreroom.user.repository.UserRepository;
import com.scoreroom.user.service.UserAccessService;

/**
 * 기존 화면을 그대로 연결하기 위한 전환용 조회 (GET /state). 읽기만 하고 엔티티를 바꾸지 않는다.
 * 권한에 맞게 서버에서 걸러서 보낸다.
 * - 이메일·전화번호: 본인과 시스템 관리자에게만
 * - 평가룸: 참여한 곳 (전체 열람 권한이 있으면 전부)
 * - 입장 코드: 룸 운영자에게만
 * - 점수·피드백: 룸 운영자는 그 평가룸 전체, 그 외에는 본인이 준 것만 (전체 열람 권한자도 남의 점수는 못 봄)
 * - 집계: 룸 운영자와 전체 열람 권한자에게만
 * 한 응답 안의 데이터가 서로 맞도록 같은 스냅샷(REPEATABLE READ)에서 읽는다.
 */
@Service
public class StateService {

    private final UserAccessService userAccess;
    private final UserRepository users;
    private final TeamService teamService;
    private final ProjectRepository projects;
    private final MembershipRepository memberships;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final RatingRepository ratings;
    private final InviteCodeRepository inviteCodes;
    private final InvitationRepository invitations;
    private final AttachmentService attachmentService;

    public StateService(UserAccessService userAccess, UserRepository users, TeamService teamService,
            ProjectRepository projects, MembershipRepository memberships, PresentationRepository presentations,
            PresentationMemberRepository presentationMembers, RatingRepository ratings,
            InviteCodeRepository inviteCodes, InvitationRepository invitations, AttachmentService attachmentService) {
        this.userAccess = userAccess;
        this.users = users;
        this.teamService = teamService;
        this.projects = projects;
        this.memberships = memberships;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.ratings = ratings;
        this.inviteCodes = inviteCodes;
        this.invitations = invitations;
        this.attachmentService = attachmentService;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public StateResponse load(UUID meId) {
        User me = userAccess.require(meId);
        List<User> allUsers = users.findAllByOrderBySortOrderAscNameAsc();
        Map<UUID, User> userById = allUsers.stream().collect(Collectors.toMap(User::getId, Function.identity()));

        List<Membership> mine = memberships.findByUserId(meId);
        Set<UUID> memberOf = mine.stream().map(Membership::getProjectId).collect(Collectors.toSet());
        Set<UUID> adminOf = mine.stream().filter(Membership::isAdmin).map(Membership::getProjectId)
                .collect(Collectors.toSet());
        boolean viewAll = me.canViewAll() && !me.isSysAdmin();

        List<Project> visibleProjects = viewAll ? projects.findAll() : projects.findByIdIn(memberOf);
        Set<UUID> visible = visibleProjects.stream().map(Project::getId).collect(Collectors.toSet());
        Set<UUID> summaryOf = new HashSet<>(adminOf);
        if (viewAll) {
            summaryOf.addAll(visible);
        }

        Map<UUID, InviteCode> codes = inviteCodes.findByProjectIdIn(adminOf).stream()
                .collect(Collectors.toMap(InviteCode::getProjectId, Function.identity()));
        List<Membership> roomMembers = memberships.findByProjectIdIn(visible);
        List<Presentation> roomPresentations = presentations.findByProjectIdIn(visible).stream()
                .sorted(Comparator.comparingInt(Presentation::getSortOrder))
                .toList();
        Map<UUID, List<PresentationMember>> membersByPresentation = presentationMembers.findByProjectIdIn(visible)
                .stream().collect(Collectors.groupingBy(PresentationMember::getPresentationId));
        Map<UUID, Crew> crews = roomPresentations.stream().collect(Collectors.toMap(Presentation::getId,
                p -> Crew.fromMembers(p.getLeaderId(), membersByPresentation.getOrDefault(p.getId(), List.of()))));
        Map<UUID, List<AttachmentResponse>> files = attachmentService.readyByPresentation(crews.keySet());
        Set<UUID> rated = new HashSet<>(ratings.findRatedPresentationIds(visible));

        Set<UUID> ratingScope = new HashSet<>(memberOf);
        ratingScope.addAll(summaryOf);
        List<Rating> scopedRatings = ratings.findByProjectIdIn(ratingScope);

        return new StateResponse(
                UserResponse.of(me, true),
                teamService.list(),
                allUsers.stream().map(u -> UserResponse.of(u, me.isSysAdmin() || u.getId().equals(meId))).toList(),
                visibleProjects.stream()
                        .map(p -> ProjectResponse.of(p, adminOf.contains(p.getId()) && p.isOpen() && codes.containsKey(p.getId())
                                ? InviteCodeResponse.from(codes.get(p.getId())) : null))
                        .toList(),
                roomMembers.stream().map(MembershipResponse::from).toList(),
                roomPresentations.stream()
                        .map(p -> PresentationResponse.of(p, crews.get(p.getId()), files.getOrDefault(p.getId(), List.of()),
                                rated.contains(p.getId())))
                        .toList(),
                scopedRatings.stream()
                        .filter(r -> memberOf.contains(r.getProjectId())
                                && (adminOf.contains(r.getProjectId()) || r.getRaterId().equals(meId)))
                        .map(RatingResponse::from)
                        .toList(),
                summaries(visibleProjects, summaryOf, roomMembers, roomPresentations, membersByPresentation, crews,
                        scopedRatings),
                pendingInvitations(meId, adminOf, userById));
    }

    private static List<SummaryResponse> summaries(List<Project> visibleProjects, Set<UUID> summaryOf,
            List<Membership> roomMembers, List<Presentation> roomPresentations,
            Map<UUID, List<PresentationMember>> membersByPresentation, Map<UUID, Crew> crews, List<Rating> scopedRatings) {
        return visibleProjects.stream()
                .filter(p -> summaryOf.contains(p.getId()))
                .flatMap(project -> {
                    UUID pid = project.getId();
                    List<Presentation> list = roomPresentations.stream().filter(p -> p.getProjectId().equals(pid)).toList();
                    List<PresentationMember> crewRows = list.stream()
                            .flatMap(p -> membersByPresentation.getOrDefault(p.getId(), List.of()).stream()).toList();
                    RoomRoster roster = new RoomRoster(
                            roomMembers.stream().filter(m -> m.getProjectId().equals(pid)).toList(), crewRows);
                    List<Rating> roomRatings = scopedRatings.stream().filter(r -> r.getProjectId().equals(pid)).toList();
                    return SummaryCalculator.summarize(project.settings(), roster, list, crews, roomRatings).stream();
                })
                .toList();
    }

    /** 대기 중인 초대: 내가 받은 것 + 내가 운영하는 평가룸에서 보낸 것 (마감된 평가룸 제외) */
    private List<InvitationResponse> pendingInvitations(UUID meId, Set<UUID> adminOf, Map<UUID, User> userById) {
        Collection<UUID> adminIds = adminOf.isEmpty() ? List.of(new UUID(0, 0)) : adminOf;
        List<Invitation> pending = invitations.findPendingVisibleTo(meId, adminIds);
        Map<UUID, Project> projectById = projects.findByIdIn(pending.stream().map(Invitation::getProjectId).toList())
                .stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        return pending.stream()
                .filter(i -> projectById.containsKey(i.getProjectId()) && projectById.get(i.getProjectId()).isOpen())
                .map(i -> new InvitationResponse(i.getId(), i.getProjectId(), projectById.get(i.getProjectId()).getName(),
                        i.getInviterId(), nameOf(userById, i.getInviterId()), i.getInviteeId(),
                        Times.toMillis(i.getCreatedAt())))
                .toList();
    }

    private static String nameOf(Map<UUID, User> userById, UUID id) {
        User user = userById.get(id);
        return user == null ? "" : user.getName();
    }
}
