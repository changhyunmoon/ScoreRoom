package com.scoreroom.common.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 scoreroom.* 설정 */
@ConfigurationProperties("scoreroom")
public record AppProperties(
        @DefaultValue Auth auth,
        @DefaultValue Session session,
        @DefaultValue Storage storage,
        @DefaultValue BootstrapAdmin bootstrapAdmin,
        @DefaultValue Logs logs) {

    /** signupEnabled: 공개 회원가입 허용 여부. 운영 가입 정책이 정해지기 전에는 끈다 */
    public record Auth(@DefaultValue("false") boolean signupEnabled) {
    }

    /** secureCookie: 세션 쿠키를 HTTPS로만 보낸다. 로컬 http 개발에서만 끈다 */
    public record Session(@DefaultValue("true") boolean secureCookie) {
    }

    /** uploadDir: 발표 자료 저장 위치. stagingTimeout: 끝나지 않은 업로드를 정리하기까지 기다리는 시간 */
    public record Storage(
            @DefaultValue("./data/uploads") String uploadDir,
            @DefaultValue("PT1H") Duration stagingTimeout) {
    }

    /** retentionDays: 시스템 관리자 로그 보관 일수. 지난 로그는 매일 지운다 (LogRetentionJob) */
    public record Logs(@DefaultValue("30") int retentionDays) {
    }

    /** 최초 시스템 관리자. 값이 있고 시스템 관리자가 한 명도 없을 때만 한 번 만든다 */
    public record BootstrapAdmin(String loginId, String password, @DefaultValue("시스템관리자") String name) {

        public boolean isConfigured() {
            return loginId != null && !loginId.isBlank() && password != null && !password.isBlank();
        }
    }
}
