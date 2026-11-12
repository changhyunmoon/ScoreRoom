package com.scoreroom.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.user.domain.User;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * 실제 PostgreSQL(내장)로 애플리케이션 전체를 띄우는 통합 테스트의 부모.
 * H2로 대신하지 않는다: 잠금, 지연 FK, 조건부 고유 인덱스를 실제 DB에서 확인한다.
 * 테스트마다 업무 테이블을 비운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

    private static final EmbeddedPostgres POSTGRES = startPostgres();
    private static final Path UPLOAD_DIR = tempDir("scoreroom-test-uploads");

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected TestFixtures fixtures;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
        registry.add("scoreroom.storage.upload-dir", UPLOAD_DIR::toString);
    }

    @BeforeEach
    void cleanDatabase() {
        List<String> tables = List.of("audit_events", "system_logs", "notifications", "file_deletion_jobs", "attachments", "ratings",
                "invite_codes", "presentation_members", "presentations", "memberships", "projects", "users", "teams",
                "spring_session_attributes", "spring_session");
        jdbc.execute("TRUNCATE " + String.join(", ", tables) + " CASCADE");
    }

    /** 로그인한 사용자로 보내는 요청 (CSRF 토큰 포함) */
    protected static RequestPostProcessor as(User user) {
        UsernamePasswordAuthenticationToken token = UsernamePasswordAuthenticationToken.authenticated(
                new AuthenticatedUser(user.getId()), null, List.of());
        return request -> csrf().postProcessRequest(authentication(token).postProcessRequest(request));
    }

    protected static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    protected Integer count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private static EmbeddedPostgres startPostgres() {
        try {
            // PostgreSQL 실행 파일은 ASCII 경로(build 폴더)에 풀어 둔다
            Path work = Path.of("build", "embedded-postgres-bin").toAbsolutePath();
            Files.createDirectories(work);
            return EmbeddedPostgres.builder()
                    .setOverrideWorkingDirectory(work.toFile())
                    .setDataDirectory(Path.of("build", "embedded-postgres-test").toAbsolutePath().toFile())
                    .setCleanDataDirectory(true)
                    .setLocaleConfig("locale", "C")
                    .start();
        } catch (IOException e) {
            throw new IllegalStateException("테스트용 PostgreSQL을 시작하지 못했습니다.", e);
        }
    }

    private static Path tempDir(String prefix) {
        try {
            return Files.createTempDirectory(Path.of("build").toAbsolutePath(), prefix);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
