package com.scoreroom.auth.service;

import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.security.UserSessionRevoker;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.user.domain.LoginIds;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;
import com.scoreroom.user.service.UserRegistrar;

/**
 * 아이디(이메일) 찾기와 비밀번호 재설정. 이름과 전화번호로 본인을 확인한다.
 * - 찾은 이메일은 일부를 가려서 보여준다
 * - 시스템 관리자 계정은 이 방법으로 찾거나 재설정할 수 없다
 * - 재설정하면 그 계정의 모든 로그인 세션을 끊고 작업 기록을 남긴다
 * 요청 횟수 제한은 컨트롤러에서 한다.
 */
@Service
public class AccountRecoveryService {

    private static final int MIN_PHONE_DIGITS = 8;

    private final UserRepository users;
    private final UserRegistrar registrar;
    private final UserSessionRevoker sessionRevoker;
    private final LogService logs;

    public AccountRecoveryService(UserRepository users, UserRegistrar registrar, UserSessionRevoker sessionRevoker,
            LogService logs) {
        this.users = users;
        this.registrar = registrar;
        this.sessionRevoker = sessionRevoker;
        this.logs = logs;
    }

    /** 이름·전화번호가 맞는 계정의 이메일 (일부 가림). 없으면 빈 목록 */
    @Transactional(readOnly = true)
    public List<String> findLoginIds(String name, String phone) {
        String digits = digits(phone);
        if (digits.length() < MIN_PHONE_DIGITS) {
            return List.of();
        }
        return users.findByNameAndSysAdminFalseAndEnabledTrue(name.trim()).stream()
                .filter(u -> digits(u.getPhone()).equals(digits))
                .map(u -> mask(u.getLoginId()))
                .toList();
    }

    @Transactional
    public void resetPassword(String loginId, String name, String phone, String newPassword) {
        String digits = digits(phone);
        User user = users.findByLoginId(LoginIds.normalize(loginId))
                .filter(u -> !u.isSysAdmin() && u.isEnabled())
                .filter(u -> u.getName().equals(name.trim()))
                .filter(u -> digits.length() >= MIN_PHONE_DIGITS && digits(u.getPhone()).equals(digits))
                .orElseThrow(() -> ApiException.badRequest("입력한 정보와 일치하는 계정이 없습니다."));
        user.changePassword(registrar.encode(newPassword));
        sessionRevoker.revokeAll(user.getId(), null);
        logs.activity(user.getId(), null, LogAction.PASSWORD_RESET_SELF, user.getName() + " 비밀번호 찾기로 재설정");
    }

    /** chbigmoon@datasolution.kr → ch*******@datasolution.kr */
    static String mask(String loginId) {
        int at = loginId.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = loginId.substring(0, at);
        int keep = local.length() <= 2 ? 1 : 2;
        return local.substring(0, keep) + "*".repeat(Math.max(3, local.length() - keep)) + loginId.substring(at);
    }

    private static String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "").toLowerCase(Locale.ROOT);
    }
}
