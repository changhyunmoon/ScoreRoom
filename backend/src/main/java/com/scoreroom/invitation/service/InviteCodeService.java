package com.scoreroom.invitation.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.invitation.domain.InviteCode;
import com.scoreroom.invitation.repository.InviteCodeRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.service.UserAccessService;

/** 입장 코드 발급·중지와 코드로 입장 */
@Service
public class InviteCodeService {

    private static final int MAX_MINUTES = 1440;

    private final InviteCodeRepository inviteCodes;
    private final ProjectRepository projects;
    private final MembershipService membershipService;
    private final InvitationService invitationService;
    private final UserAccessService userAccess;
    private final RoomGuard roomGuard;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public InviteCodeService(InviteCodeRepository inviteCodes, ProjectRepository projects,
            MembershipService membershipService, InvitationService invitationService, UserAccessService userAccess,
            RoomGuard roomGuard, Clock clock) {
        this.inviteCodes = inviteCodes;
        this.projects = projects;
        this.membershipService = membershipService;
        this.invitationService = invitationService;
        this.userAccess = userAccess;
        this.roomGuard = roomGuard;
        this.clock = clock;
    }

    /** 새 코드를 발급한다. 이전 코드는 바로 무효가 된다. minutes가 null이면 중지할 때까지 유효 */
    @Transactional
    public void issue(UUID actorId, UUID projectId, Integer minutes) {
        roomGuard.lockAsAdmin(projectId, actorId);
        if (minutes != null && (minutes < 1 || minutes > MAX_MINUTES)) {
            throw ApiException.badRequest("유효 시간은 1분~24시간 사이로 정하거나 무제한으로 해 주세요.");
        }
        Instant now = clock.instant();
        InviteCode inviteCode = inviteCodes.findById(projectId).orElseGet(() -> new InviteCode(projectId));
        inviteCode.reissue(newUniqueCode(), actorId, now, minutes == null ? null : now.plus(Duration.ofMinutes(minutes)));
        inviteCodes.save(inviteCode);
    }

    /** 코드 사용 중지: 새 참여를 바로 막는다. 이미 참여한 사람은 그대로 남는다 */
    @Transactional
    public void revoke(UUID actorId, UUID projectId) {
        roomGuard.lockAsAdmin(projectId, actorId);
        Instant now = clock.instant();
        InviteCode inviteCode = inviteCodes.findById(projectId)
                .filter(c -> c.isActive(now))
                .orElseThrow(() -> ApiException.badRequest("사용 중인 입장 코드가 없습니다."));
        inviteCode.revoke(now);
    }

    /** 코드로 입장한다. 이미 참여 중이면 그대로 그 평가룸으로 보낸다. 만료 판정은 요청 시각 기준이다 */
    @Transactional
    public UUID join(UUID actorId, String rawCode) {
        User user = userAccess.require(actorId);
        if (user.isSysAdmin()) {
            throw ApiException.forbidden("시스템 관리자는 평가룸에 참여할 수 없습니다.");
        }
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase(Locale.ROOT);
        InviteCode found = inviteCodes.findByCode(code)
                .orElseThrow(() -> ApiException.badRequest("유효하지 않은 입장 코드입니다."));
        Project project = projects.findByIdForUpdate(found.getProjectId())
                .orElseThrow(() -> ApiException.badRequest("유효하지 않은 입장 코드입니다."));
        Instant now = clock.instant();
        if (found.isRevoked()) {
            throw ApiException.badRequest("사용이 중지된 입장 코드입니다.");
        }
        if (found.isExpired(now)) {
            throw ApiException.badRequest("만료된 입장 코드입니다.");
        }
        if (!project.isOpen()) {
            throw new ApiException(ErrorCode.PROJECT_CLOSED, "마감된 평가룸입니다.");
        }
        project.bumpVersion();
        membershipService.join(project, user, false);
        invitationService.acceptPending(project.getId(), actorId);
        return project.getId();
    }

    private String newUniqueCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder code = new StringBuilder(InviteCode.LENGTH);
            for (int i = 0; i < InviteCode.LENGTH; i++) {
                code.append(InviteCode.ALPHABET.charAt(random.nextInt(InviteCode.ALPHABET.length())));
            }
            if (!inviteCodes.existsByCode(code.toString())) {
                return code.toString();
            }
        }
        throw new ApiException(ErrorCode.CONFLICT, "입장 코드를 만들지 못했습니다. 다시 시도해 주세요.");
    }
}
