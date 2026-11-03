package com.scoreroom.bootstrap.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scoreroom.bootstrap.dto.StateResponse;
import com.scoreroom.bootstrap.service.StateService;
import com.scoreroom.common.security.AuthenticatedUser;

/** 전환용 화면 데이터. 화면별 조회 API로 나눈 뒤 없앤다 */
@RestController
public class StateController {

    private final StateService stateService;

    public StateController(StateService stateService) {
        this.stateService = stateService;
    }

    @GetMapping("/api/v1/state")
    public StateResponse state(@AuthenticationPrincipal AuthenticatedUser me) {
        return stateService.load(me.userId());
    }
}
