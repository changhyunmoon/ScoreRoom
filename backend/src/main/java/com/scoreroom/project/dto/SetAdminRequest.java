package com.scoreroom.project.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 룸 관리자 지정(true)·해제(false) */
public record SetAdminRequest(@JsonProperty("isAdmin") boolean isAdmin) {
}
