package com.scoreroom.log.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.scoreroom.project.domain.ProjectSettings;

/** 평가룸 설정 변경 로그용: 바뀐 항목만 화면(설정 탭)과 같은 이름으로 "이름 전 → 후" 형태로 만든다 */
public final class SettingsDiff {

    private SettingsDiff() {
    }

    public static List<String> of(ProjectSettings a, ProjectSettings b) {
        List<String> out = new ArrayList<>();
        if (a.min() != b.min() || a.max() != b.max()) {
            out.add("점수 입력 범위 " + a.min() + "~" + a.max() + " → " + b.min() + "~" + b.max());
        }
        if (!Objects.equals(a.aggMin(), b.aggMin()) || !Objects.equals(a.aggMax(), b.aggMax())) {
            out.add("집계 기준 " + agg(a) + " → " + agg(b));
        }
        flag(out, "본인 발표 평가 허용", a.allowSelf(), b.allowSelf());
        flag(out, "같은 회사 팀 평가 허용", a.allowSameTeam(), b.allowSameTeam());
        flag(out, "제출한 점수 수정 허용", a.allowEdit(), b.allowEdit());
        flag(out, "룸 관리자도 발표하기", a.allowAdminPresent(), b.allowAdminPresent());
        flag(out, "룸 관리자도 평가하기", a.allowAdminRating(), b.allowAdminRating());
        flag(out, "본인 발표 점수 집계", a.countSelf(), b.countSelf());
        flag(out, "같은 회사 팀 점수 집계", a.countSameTeam(), b.countSameTeam());
        flag(out, "룸 관리자 점수 집계", a.countAdmin(), b.countAdmin());
        flag(out, "참여자에게 발표 등록 인원 보이기", a.showRosterSummary(), b.showRosterSummary());
        flag(out, "참여자에게 평가 현황 보이기", a.showRatingStatus(), b.showRatingStatus());
        flag(out, "참여자에게 평가 현황 사람 목록 보이기", a.showRatingStatusNames(), b.showRatingStatusNames());
        return out;
    }

    private static String agg(ProjectSettings s) {
        return s.hasAggregationRange() ? s.aggMin() + "~" + s.aggMax() : "사용 안 함";
    }

    private static void flag(List<String> out, String name, boolean before, boolean after) {
        if (before != after) {
            out.add(name + " " + onOff(before) + " → " + onOff(after));
        }
    }

    private static String onOff(boolean v) {
        return v ? "켜짐" : "꺼짐";
    }
}
