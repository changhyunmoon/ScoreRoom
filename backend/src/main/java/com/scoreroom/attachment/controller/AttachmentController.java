package com.scoreroom.attachment.controller;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.scoreroom.attachment.dto.AttachmentDownload;
import com.scoreroom.attachment.dto.AttachmentResponse;
import com.scoreroom.attachment.service.AttachmentService;
import com.scoreroom.common.security.AuthenticatedUser;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/presentations/{presentationId}/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    /** multipart의 file 필드로 파일 하나를 올린다 */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentResponse upload(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @RequestParam("file") MultipartFile file) {
        return attachmentService.upload(me.userId(), projectId, presentationId, file);
    }

    /**
     * 항상 첨부(attachment)로 내려보내고 형식은 octet-stream으로 고정한다.
     * 사용자가 올린 HTML 등이 같은 출처에서 열려 실행되지 않게 한다.
     */
    @GetMapping("/{attachmentId}")
    public ResponseEntity<Resource> download(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @PathVariable UUID attachmentId) {
        AttachmentDownload file = attachmentService.download(me.userId(), projectId, presentationId, attachmentId);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(file.content());
    }

    @DeleteMapping("/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID projectId,
            @PathVariable UUID presentationId, @PathVariable UUID attachmentId) {
        attachmentService.delete(me.userId(), projectId, presentationId, attachmentId);
    }
}
