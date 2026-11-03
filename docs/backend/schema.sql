-- ScoreRoom PostgreSQL ERD/DDL 설계안 (2026-11-03)
-- 새 빈 스키마 기준. UUID는 애플리케이션에서 생성한다.
-- 아래 ALTER TABLE까지 함께 가져와야 대표-발표 구성원 관계가 포함된다.
-- Spring Session 테이블은 버전 확정 후 공식 스키마를 별도 migration으로 추가한다.

CREATE TABLE teams (
    id UUID PRIMARY KEY,
    parent_id UUID,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_parent FOREIGN KEY (parent_id) REFERENCES teams (id),
    CONSTRAINT ck_teams_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT ck_teams_order CHECK (sort_order >= 0)
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    login_id VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    team_id UUID,
    position VARCHAR(30) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_sys_admin BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_all BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_login UNIQUE (login_id),
    CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT ck_users_login_normalized CHECK (login_id = LOWER(BTRIM(login_id))),
    CONSTRAINT ck_users_order CHECK (sort_order >= 0),
    CONSTRAINT ck_users_sys_admin_view CHECK (NOT (is_sys_admin AND can_view_all))
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    score_min INTEGER NOT NULL DEFAULT 0,
    score_max INTEGER NOT NULL DEFAULT 100,
    agg_min INTEGER,
    agg_max INTEGER,
    allow_self BOOLEAN NOT NULL DEFAULT FALSE,
    allow_same_team BOOLEAN NOT NULL DEFAULT FALSE,
    allow_same_crew BOOLEAN NOT NULL DEFAULT FALSE,
    allow_edit BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_projects_status CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT ck_projects_closed CHECK (
        (status = 'OPEN' AND closed_at IS NULL) OR
        (status = 'CLOSED' AND closed_at IS NOT NULL)
    ),
    CONSTRAINT ck_projects_version CHECK (version >= 0),
    CONSTRAINT ck_projects_score_range CHECK (score_min < score_max),
    CONSTRAINT ck_projects_aggregation CHECK (
        (agg_min IS NULL AND agg_max IS NULL) OR
        (agg_min IS NOT NULL AND agg_max IS NOT NULL AND
         score_min <= agg_min AND agg_min <= agg_max AND agg_max <= score_max)
    )
);

CREATE TABLE memberships (
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    team_id_at_join UUID,
    team_name_at_join VARCHAR(100),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_memberships PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_memberships_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_memberships_team FOREIGN KEY (team_id_at_join) REFERENCES teams (id),
    CONSTRAINT ck_memberships_team_snapshot CHECK (
        (team_id_at_join IS NULL AND team_name_at_join IS NULL) OR
        (team_id_at_join IS NOT NULL AND team_name_at_join IS NOT NULL)
    )
);

CREATE TABLE presentations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    title VARCHAR(300) NOT NULL,
    intro TEXT NOT NULL DEFAULT '',
    type VARCHAR(20) NOT NULL,
    leader_id UUID NOT NULL,
    created_by UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deploy_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_presentations_project_id UNIQUE (project_id, id),
    CONSTRAINT fk_presentations_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_presentations_creator FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_presentations_type CHECK (type IN ('PERSONAL', 'TEAM')),
    CONSTRAINT ck_presentations_order CHECK (sort_order >= 0)
);

CREATE TABLE presentation_members (
    project_id UUID NOT NULL,
    presentation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    is_presenter BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT pk_presentation_members PRIMARY KEY (presentation_id, user_id),
    CONSTRAINT fk_presentation_members_presentation FOREIGN KEY (project_id, presentation_id)
        REFERENCES presentations (project_id, id),
    CONSTRAINT fk_presentation_members_membership FOREIGN KEY (project_id, user_id)
        REFERENCES memberships (project_id, user_id),
    CONSTRAINT ck_presentation_members_order CHECK (sort_order >= 0)
);

-- 순환 참조: 대표도 반드시 같은 발표의 구성원이어야 한다.
-- 발표와 구성원을 같은 트랜잭션으로 생성/삭제하고 커밋 시 검사한다.
ALTER TABLE presentations ADD CONSTRAINT fk_presentations_leader_member
    FOREIGN KEY (id, leader_id) REFERENCES presentation_members (presentation_id, user_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE ratings (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    presentation_id UUID NOT NULL,
    target_id UUID NOT NULL,
    rater_id UUID NOT NULL,
    score INTEGER NOT NULL,
    feedback VARCHAR(1000),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ratings_submission UNIQUE (presentation_id, target_id, rater_id),
    CONSTRAINT fk_ratings_presentation FOREIGN KEY (project_id, presentation_id)
        REFERENCES presentations (project_id, id),
    CONSTRAINT fk_ratings_target FOREIGN KEY (presentation_id, target_id)
        REFERENCES presentation_members (presentation_id, user_id),
    CONSTRAINT fk_ratings_rater FOREIGN KEY (project_id, rater_id)
        REFERENCES memberships (project_id, user_id)
);

CREATE TABLE invite_codes (
    project_id UUID PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    issued_by UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_invite_codes_code UNIQUE (code),
    CONSTRAINT fk_invite_codes_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_invite_codes_issuer FOREIGN KEY (issued_by) REFERENCES users (id),
    CONSTRAINT ck_invite_codes_format CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
    CONSTRAINT ck_invite_codes_expiry CHECK (expires_at IS NULL OR expires_at > issued_at),
    CONSTRAINT ck_invite_codes_revocation CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);

CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    inviter_id UUID NOT NULL,
    invitee_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    CONSTRAINT fk_invitations_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (inviter_id) REFERENCES users (id),
    CONSTRAINT fk_invitations_invitee FOREIGN KEY (invitee_id) REFERENCES users (id),
    CONSTRAINT ck_invitations_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED')),
    CONSTRAINT ck_invitations_response CHECK (
        (status = 'PENDING' AND responded_at IS NULL) OR
        (status <> 'PENDING' AND responded_at IS NOT NULL AND responded_at >= created_at)
    )
);

CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    presentation_id UUID NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    uploaded_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'STAGING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attachments_storage_key UNIQUE (storage_key),
    CONSTRAINT fk_attachments_presentation FOREIGN KEY (project_id, presentation_id)
        REFERENCES presentations (project_id, id),
    CONSTRAINT fk_attachments_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id),
    CONSTRAINT ck_attachments_status CHECK (status IN ('STAGING', 'READY', 'DELETING')),
    CONSTRAINT ck_attachments_size CHECK (size_bytes > 0 AND size_bytes <= 52428800)
);

-- 첨부/발표를 삭제해도 정리 작업을 보존하기 위해 부모 FK를 두지 않는다.
-- 원본 삭제와 같은 DB 트랜잭션에서 생성한다.
CREATE TABLE file_deletion_jobs (
    id UUID PRIMARY KEY,
    storage_key VARCHAR(255) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_file_deletion_jobs_key UNIQUE (storage_key),
    CONSTRAINT ck_file_deletion_jobs_attempt CHECK (attempt_count >= 0)
);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL,
    project_id UUID,
    action VARCHAR(100) NOT NULL,
    affected_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_events_actor FOREIGN KEY (actor_id) REFERENCES users (id),
    CONSTRAINT fk_audit_events_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT ck_audit_events_count CHECK (affected_count >= 0)
);

CREATE INDEX idx_teams_parent ON teams (parent_id, sort_order);
CREATE INDEX idx_users_team_order ON users (team_id, sort_order);
CREATE INDEX idx_projects_creator ON projects (created_by);
CREATE INDEX idx_memberships_user ON memberships (user_id, project_id);
CREATE INDEX idx_memberships_team ON memberships (team_id_at_join);
CREATE INDEX idx_presentations_order ON presentations (project_id, sort_order, id);
CREATE INDEX idx_presentations_creator ON presentations (created_by);
CREATE INDEX idx_presentation_members_membership ON presentation_members (project_id, user_id);
CREATE INDEX idx_ratings_summary ON ratings (project_id, presentation_id, target_id);
CREATE INDEX idx_ratings_rater ON ratings (project_id, rater_id);
CREATE INDEX idx_invite_codes_issuer ON invite_codes (issued_by);
CREATE UNIQUE INDEX uq_invitations_pending ON invitations (project_id, invitee_id)
    WHERE status = 'PENDING';
CREATE INDEX idx_invitations_inbox ON invitations (invitee_id, status, created_at);
CREATE INDEX idx_invitations_inviter ON invitations (inviter_id);
CREATE INDEX idx_attachments_presentation_status ON attachments (presentation_id, status);
CREATE INDEX idx_attachments_project_presentation ON attachments (project_id, presentation_id);
CREATE INDEX idx_attachments_uploader ON attachments (uploaded_by);
CREATE INDEX idx_audit_events_project_time ON audit_events (project_id, created_at);
CREATE INDEX idx_audit_events_actor ON audit_events (actor_id);
CREATE INDEX idx_file_deletion_jobs_due ON file_deletion_jobs (next_attempt_at);

COMMENT ON TABLE teams IS '회사 조직도. 과거 소속을 보존하기 위해 archived로 보관 처리';
COMMENT ON TABLE users IS '로그인 사용자. 시스템 관리자와 전체 열람 권한';
COMMENT ON TABLE projects IS '평가룸과 평가/집계 설정';
COMMENT ON TABLE memberships IS '평가룸 참여자. 가입 당시 회사 팀과 룸 운영자 여부';
COMMENT ON TABLE presentations IS '개인/팀 발표. 대표는 presentation_members에 포함';
COMMENT ON TABLE presentation_members IS '발표 평가 대상. 대표와 발표자 겸임 가능';
COMMENT ON TABLE ratings IS '평가자가 발표 구성원 한 명에게 준 점수와 피드백';
COMMENT ON TABLE invite_codes IS '평가룸별 현재 입장 코드 하나';
COMMENT ON TABLE invitations IS '사용자별 초대와 처리 상태';
COMMENT ON TABLE attachments IS 'EBS에 보관할 파일 메타데이터. 파일 본문은 DB 밖에 저장';
COMMENT ON TABLE audit_events IS '관리 작업 기록. 평가 원문이나 비밀번호를 기록하지 않음';
COMMENT ON TABLE file_deletion_jobs IS '원본 메타데이터 삭제 후에도 보존되는 파일 삭제 재시도 작업';
COMMENT ON COLUMN memberships.team_id_at_join IS '가입 후 조직 이동에도 변경하지 않는 소속 스냅샷';
COMMENT ON COLUMN projects.version IS '룸 쓰기 작업마다 증가. 영향 미리보기 충돌 검사';
COMMENT ON COLUMN ratings.score IS '룸별 점수 범위는 Service에서 검사';
COMMENT ON COLUMN presentations.leader_id IS '한 명의 대표. 지연 FK로 커밋 시 구성원 여부 검사';
COMMENT ON COLUMN attachments.storage_key IS '사용자 파일명이 아닌 서버 생성 저장 키';

-- Service 검증: 팀 순환, 시스템 관리자 참여 금지, 마지막 운영자 보호,
-- PERSONAL 구성원 수, 룸 OPEN 상태, 평가 허용/수정 규칙, 파일 수 10개 제한.
-- updated_at, version은 애플리케이션에서 갱신한다(자동 갱신 트리거 없음).
