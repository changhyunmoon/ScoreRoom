package com.scoreroom;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import org.springframework.boot.SpringApplication;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * 로컬 개발용 실행 (운영 jar에는 포함되지 않는다): ./gradlew bootTestRun
 * 내장 PostgreSQL을 5433 포트로 띄우고(데이터는 build/local-db에 남는다) API를 8080에서 실행한다.
 * 처음 실행할 때 docs/mock/organization-users.sql이 있으면 조직·사용자를 넣는다 (시스템 관리자 admin@scoreroom.dev, 비밀번호 모두 1234).
 * seed 파일이 없으면 시스템 관리자 admin@local.dev / admin1234 를 만든다.
 */
public class LocalDevApplication {

    public static void main(String[] args) throws Exception {
        Path dataDir = Path.of("build/local-db").toAbsolutePath();
        boolean fresh = !Files.exists(dataDir.resolve("PG_VERSION"));
        Files.createDirectories(dataDir);
        Files.createDirectories(Path.of("build/local-pg-bin"));
        EmbeddedPostgres pg = EmbeddedPostgres.builder()
                .setPort(5433)
                // 사용자 폴더 경로에 한글이 있으면 initdb가 실패하므로 바이너리를 프로젝트 안에 푼다
                .setOverrideWorkingDirectory(Path.of("build/local-pg-bin").toAbsolutePath().toFile())
                .setDataDirectory(dataDir)
                .setCleanDataDirectory(false)
                // 한국어 Windows 로케일(CP949)이면 initdb가 실패한다
                .setLocaleConfig("locale", "C")
                .setLocaleConfig("lc-messages", "C")
                .start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { pg.close(); } catch (IOException ignored) { }
        }));

        System.setProperty("spring.datasource.url", pg.getJdbcUrl("postgres", "postgres"));
        System.setProperty("spring.datasource.username", "postgres");
        System.setProperty("spring.datasource.password", "");
        System.setProperty("scoreroom.storage.upload-dir", Path.of("build/local-uploads").toAbsolutePath().toString());
        System.setProperty("scoreroom.auth.signup-enabled", "true");
        System.setProperty("scoreroom.session.secure-cookie", "false");
        Path seed = Path.of("../docs/mock/organization-users.sql");
        if (!Files.exists(seed)) {
            System.setProperty("scoreroom.bootstrap-admin.login-id", "admin@local.dev");
            System.setProperty("scoreroom.bootstrap-admin.password", "admin1234");
        }

        SpringApplication.run(ScoreRoomApplication.class, args);

        if (fresh && Files.exists(seed)) {
            try (Connection c = pg.getPostgresDatabase().getConnection(); Statement st = c.createStatement()) {
                try (ResultSet rs = st.executeQuery("select count(*) from users")) {
                    rs.next();
                    if (rs.getLong(1) <= 1) st.execute(Files.readString(seed));
                }
                System.out.println("[local] 조직·사용자 seed를 넣었습니다.");
            } catch (Exception e) {
                System.out.println("[local] seed를 넣지 못했습니다: " + e.getMessage());
            }
        }
    }
}
