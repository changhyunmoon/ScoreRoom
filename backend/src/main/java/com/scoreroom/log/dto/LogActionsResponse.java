package com.scoreroom.log.dto;

import java.util.List;

/** 화면이 쓰는 카테고리·항목 이름표. 순서가 화면 순서다 */
public record LogActionsResponse(List<Category> categories, List<Action> actions) {

    public record Category(String code, String label) {
    }

    public record Action(String code, String category, String label, String level) {
    }
}
