package com.scoreroom.auth.dto;

import java.util.List;

/** 일치하는 계정의 이메일 (일부를 가림). 없으면 빈 목록 */
public record FindLoginIdsResponse(List<String> loginIds) {
}
