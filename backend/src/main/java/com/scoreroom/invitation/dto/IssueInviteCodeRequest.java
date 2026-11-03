package com.scoreroom.invitation.dto;

/** minutes: 1~1440분. null이면 중지할 때까지 무제한 */
public record IssueInviteCodeRequest(Integer minutes) {
}
