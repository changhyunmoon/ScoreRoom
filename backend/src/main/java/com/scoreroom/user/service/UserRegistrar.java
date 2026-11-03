package com.scoreroom.user.service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.organization.service.TeamService;
import com.scoreroom.user.domain.LoginIds;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;

/** 계정 생성과 비밀번호 규칙을 한곳에서 처리한다 (가입, 시스템 관리자의 사용자 등록, 최초 관리자) */
@Service
public class UserRegistrar {

    public static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository users;
    private final TeamService teamService;
    private final PasswordEncoder passwordEncoder;

    public UserRegistrar(UserRepository users, TeamService teamService, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.teamService = teamService;
        this.passwordEncoder = passwordEncoder;
    }

    /** 일반 사용자를 만든다. 새로 들어온 사람은 그 팀의 맨 아래에 둔다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public User registerMember(String rawLoginId, String rawPassword, String name, String phone, UUID teamId,
            String position) {
        String loginId = requireUnusedLoginId(rawLoginId, null);
        if (teamId != null) {
            teamService.requireActive(teamId);
        }
        User user = User.member(loginId, encode(rawPassword), requireText(name, "이름"), requireText(phone, "전화번호"),
                teamId, trimToEmpty(position), nextSortOrder(teamId));
        return users.save(user);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public User registerSysAdmin(String rawLoginId, String rawPassword, String name) {
        return users.save(User.sysAdmin(requireUnusedLoginId(rawLoginId, null), encode(rawPassword), name));
    }

    /** 비밀번호 규칙을 확인하고 해시한다 */
    public String encode(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "비밀번호는 " + MIN_PASSWORD_LENGTH + "자 이상으로 입력해 주세요.");
        }
        if (rawPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "비밀번호가 너무 깁니다.");
        }
        return passwordEncoder.encode(rawPassword);
    }

    public boolean matches(String rawPassword, String passwordHash) {
        return rawPassword != null && passwordEncoder.matches(rawPassword, passwordHash);
    }

    /** 정규화한 이메일이 다른 사람이 쓰지 않는지 확인한다. selfId는 본인 수정일 때 제외할 사용자 */
    public String requireUnusedLoginId(String rawLoginId, UUID selfId) {
        String loginId = LoginIds.normalizeValid(rawLoginId);
        boolean taken = selfId == null ? users.existsByLoginId(loginId) : users.existsByLoginIdAndIdNot(loginId, selfId);
        if (taken) {
            throw ApiException.conflict("이미 가입된 이메일입니다.");
        }
        return loginId;
    }

    public int nextSortOrder(UUID teamId) {
        return (teamId == null ? users.findMaxSortOrderWithoutTeam() : users.findMaxSortOrderInTeam(teamId)) + 1;
    }

    static String requireText(String value, String label) {
        String trimmed = trimToEmpty(value);
        if (trimmed.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, label + "을(를) 입력해 주세요.");
        }
        return trimmed;
    }

    static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
