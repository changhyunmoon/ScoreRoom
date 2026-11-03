package com.scoreroom.invitation.dto;

import java.util.UUID;

import com.scoreroom.common.web.Times;
import com.scoreroom.invitation.domain.InviteCode;

/** 화면의 Invite 타입. expiresAt이 null이면 기간 무제한 */
public record InviteCodeResponse(String code, Long issuedAt, Long expiresAt, UUID issuedBy, Long revokedAt) {

    public static InviteCodeResponse from(InviteCode c) {
        return new InviteCodeResponse(c.getCode(), Times.toMillis(c.getIssuedAt()), Times.toMillis(c.getExpiresAt()),
                c.getIssuedBy(), Times.toMillis(c.getRevokedAt()));
    }
}
