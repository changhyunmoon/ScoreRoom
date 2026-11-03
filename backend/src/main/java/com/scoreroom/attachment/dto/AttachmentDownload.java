package com.scoreroom.attachment.dto;

import org.springframework.core.io.Resource;

/** 내려받을 파일과 원래 이름 */
public record AttachmentDownload(String fileName, long size, Resource content) {
}
