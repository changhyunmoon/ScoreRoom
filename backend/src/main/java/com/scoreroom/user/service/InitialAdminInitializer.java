package com.scoreroom.user.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.config.AppProperties;
import com.scoreroom.user.repository.UserRepository;

/**
 * 최초 시스템 관리자를 한 번만 만든다.
 * 환경변수(SCOREROOM_ADMIN_LOGIN_ID, SCOREROOM_ADMIN_PASSWORD)로 받은 값을 쓰고, 코드에 암호를 넣지 않는다.
 * 시스템 관리자가 이미 있으면 아무것도 하지 않는다.
 */
@Component
@Order(0)
public class InitialAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InitialAdminInitializer.class);

    private final AppProperties properties;
    private final UserRepository users;
    private final UserRegistrar registrar;

    public InitialAdminInitializer(AppProperties properties, UserRepository users, UserRegistrar registrar) {
        this.properties = properties;
        this.users = users;
        this.registrar = registrar;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppProperties.BootstrapAdmin admin = properties.bootstrapAdmin();
        if (users.existsBySysAdminTrue()) {
            return;
        }
        if (!admin.isConfigured()) {
            log.warn("시스템 관리자가 없습니다. SCOREROOM_ADMIN_LOGIN_ID, SCOREROOM_ADMIN_PASSWORD를 설정하고 다시 시작하세요.");
            return;
        }
        registrar.registerSysAdmin(admin.loginId(), admin.password(), admin.name());
        log.info("최초 시스템 관리자 계정을 만들었습니다: {}", admin.loginId());
    }
}
