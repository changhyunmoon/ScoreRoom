package com.scoreroom.bootstrap.dto;

import java.util.List;

import com.scoreroom.notification.dto.NotificationResponse;
import com.scoreroom.organization.dto.TeamResponse;
import com.scoreroom.presentation.dto.PresentationResponse;
import com.scoreroom.project.dto.MembershipResponse;
import com.scoreroom.project.dto.ProjectResponse;
import com.scoreroom.rating.dto.RatingResponse;
import com.scoreroom.result.dto.SummaryResponse;
import com.scoreroom.user.dto.UserResponse;

/** 로그인한 사람이 볼 수 있는 화면 데이터 전체 (화면의 DB 타입 + me) */
public record StateResponse(
        UserResponse me,
        List<TeamResponse> teams,
        List<UserResponse> users,
        List<ProjectResponse> projects,
        List<MembershipResponse> memberships,
        List<PresentationResponse> presentations,
        List<RatingResponse> ratings,
        List<SummaryResponse> summaries,
        List<NotificationResponse> notifications) {
}
