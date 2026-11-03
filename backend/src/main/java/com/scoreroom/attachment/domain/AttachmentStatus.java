package com.scoreroom.attachment.domain;

/**
 * STAGING: 자리를 잡고 파일을 받는 중 (화면에 보이지 않음)
 * READY: 내려받을 수 있음
 * DELETING: 삭제 처리 중 (현재는 삭제 작업 테이블로 처리하므로 쓰지 않는다)
 */
public enum AttachmentStatus {
    STAGING,
    READY,
    DELETING
}
