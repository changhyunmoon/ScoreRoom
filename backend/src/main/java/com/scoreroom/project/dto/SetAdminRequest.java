package com.scoreroom.project.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 룸 관리자 지정(true)·해제(false).
 * expectedVersion: 발표에 등록된 사람을 관리자로 지정할 때 화면이 영향(빠질 발표·지울 평가)을 보여 준 평가룸 version
 */
public record SetAdminRequest(@JsonProperty("isAdmin") boolean isAdmin, Long expectedVersion) {
}
