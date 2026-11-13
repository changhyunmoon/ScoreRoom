package com.scoreroom.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
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
 *
 * 내장 PostgreSQL을 띄울 수 없는 PC(Windows 스마트 앱 컨트롤이 initdb를 막는 경우)에서는
 * 이미 떠 있는 PostgreSQL 서버를 환경 변수로 알려 주면, 그 서버에 테스트 전용 DB(scoreroom_test)를 새로 만들어 쓴다.
 * 예) SCOREROOM_TEST_PG=localhost:5433 ./gradlew test  (같은 서버의 다른 DB, 즉 로컬 개발 데이터는 건드리지 않는다)
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

    private static final String TEST_DB = "scoreroom_test";
    private static final String JDBC_URL = startPostgres();
    private static final Path UPLOAD_DIR = tempDir("scoreroom-test-uploads");

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected TestFixtures fixtures;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
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

    private static String startPostgres() {
        String external = System.getenv("SCOREROOM_TEST_PG");
        if (external != null && !external.isBlank()) return freshDatabaseOn(external.trim());
        try {
            // PostgreSQL 실행 파일은 ASCII 경로(build 폴더)에 풀어 둔다
            Path work = Path.of("build", "embedded-postgres-bin").toAbsolutePath();
            Files.createDirectories(work);
            return EmbeddedPostgres.builder()
                    .setOverrideWorkingDirectory(work.toFile())
                    .setDataDirectory(Path.of("build", "embedded-postgres-test").toAbsolutePath().toFile())
                    .setCleanDataDirectory(true)
                    .setLocaleConfig("locale", "C")
                    .start()
                    .getJdbcUrl("postgres", "postgres");
        } catch (IOException e) {
            throw new IllegalStateException("테스트용 PostgreSQL을 시작하지 못했습니다.", e);
        }
    }

    /** host:port 서버에 테스트 전용 DB를 지우고 새로 만든다 (내장 DB의 setCleanDataDirectory와 같은 효과) */
    private static String freshDatabaseOn(String hostPort) {
        try (Connection c = DriverManager.getConnection("jdbc:postgresql://" + hostPort + "/postgres", "postgres", "");
             Statement st = c.createStatement()) {
            st.execute("DROP DATABASE IF EXISTS " + TEST_DB + " WITH (FORCE)");
            st.execute("CREATE DATABASE " + TEST_DB + " ENCODING 'UTF8' TEMPLATE template0");
        } catch (SQLException e) {
            throw new IllegalStateException("SCOREROOM_TEST_PG=" + hostPort + " 에 테스트용 DB를 만들지 못했습니다.", e);
        }
        return "jdbc:postgresql://" + hostPort + "/" + TEST_DB;
    }

    private static Path tempDir(String prefix) {
        try {
            return Files.createTempDirectory(Path.of("build").toAbsolutePath(), prefix);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
