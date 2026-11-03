package com.scoreroom.infrastructure.storage;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import com.scoreroom.common.config.AppProperties;

/**
 * 서버 디스크(scoreroom.storage.upload-dir)에 파일을 둔다. 애플리케이션 빌드 디렉터리 밖을 쓴다.
 * 저장 키 앞 두 글자로 하위 폴더를 나눠 한 폴더에 파일이 몰리지 않게 한다.
 */
@Component
public class LocalFileStorage implements FileStorage {

    private static final Pattern KEY = Pattern.compile("^[a-f0-9-]{36}$");

    private final Path root;

    public LocalFileStorage(AppProperties properties) {
        this.root = Path.of(properties.storage().uploadDir()).toAbsolutePath().normalize();
    }

    @Override
    public String newKey() {
        return UUID.randomUUID().toString();
    }

    @Override
    public void store(String key, InputStream content) throws IOException {
        Path target = pathOf(key);
        Files.createDirectories(target.getParent());
        Path temp = Files.createTempFile(target.getParent(), "upload-", ".part");
        try {
            Files.copy(content, temp, StandardCopyOption.REPLACE_EXISTING);
            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @Override
    public Resource load(String key) throws IOException {
        Path path = pathOf(key);
        if (!Files.isRegularFile(path)) {
            throw new FileNotFoundException(key);
        }
        return new FileSystemResource(path);
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(pathOf(key));
    }

    private Path pathOf(String key) {
        if (!KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("잘못된 저장 키입니다.");
        }
        return root.resolve(key.substring(0, 2)).resolve(key);
    }
}
