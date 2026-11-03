package com.scoreroom.infrastructure.storage;

import java.io.IOException;
import java.io.InputStream;

import org.springframework.core.io.Resource;

/** 발표 자료 파일 본문 저장소. DB에는 메타데이터와 저장 키만 둔다 */
public interface FileStorage {

    /** 사용자 파일명과 무관한 새 저장 키 */
    String newKey();

    void store(String key, InputStream content) throws IOException;

    /** 없으면 FileNotFoundException */
    Resource load(String key) throws IOException;

    /** 이미 없으면 그대로 성공으로 본다 */
    void delete(String key) throws IOException;
}
