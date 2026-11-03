package com.scoreroom.presentation.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.scoreroom.presentation.domain.PresentationType;

/** 발표 등록·수정. presenterIds에 대표가 들어 있으면 대표가 발표도 한다 */
public record SavePresentationRequest(
        @NotBlank(message = "발표 제목을 입력해 주세요.") @Size(max = 300, message = "발표 제목은 300자 이하로 입력해 주세요.") String title,
        @Size(max = 5000, message = "소개는 5000자 이하로 입력해 주세요.") String intro,
        @NotNull(message = "발표 유형을 선택해 주세요.") PresentationType type,
        @NotNull(message = "대표를 1명 선택해 주세요.") UUID leaderId,
        List<UUID> presenterIds,
        List<UUID> memberIds,
        String deployUrl) {
}
