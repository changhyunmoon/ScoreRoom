#!/usr/bin/env bash
# EC2에서 root로 실행한다 (GitHub Actions가 sudo로 부른다).
#   remote-deploy.sh <release-id> <release.tar.gz>
# 전제: GitHub Actions가 Secrets로 만든 설정을 /etc/scoreroom/scoreroom.env.next 로 먼저 올려 둔다.
# 1) 릴리스를 /opt/scoreroom/releases/<id>에 풀고 서버 기본 구성(server-setup.sh)을 맞춘다
# 2) 새 설정을 적용하고, 같은 서버의 PostgreSQL이면 DB·계정을 만들고 비밀번호를 Secret과 맞춘다
# 3) current 링크를 새 릴리스로 바꿔 재시작하고, 헬스체크가 실패하면 이전 릴리스·설정으로 되돌린다
# 주의: DB 마이그레이션(Flyway)은 되돌리지 않는다. 마이그레이션은 이전 버전과 함께 동작하도록 작성한다.
set -euo pipefail

RELEASE_ID="${1:?release id required}"
ARCHIVE="${2:?release archive required}"

APP_ROOT=/opt/scoreroom
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE=/etc/scoreroom/scoreroom.env
ENV_NEXT="$ENV_FILE.next"
ENV_PREV="$ENV_FILE.prev"
SERVICE=scoreroom
HEALTH_URL="http://127.0.0.1:8080/actuator/health"
HEALTH_TIMEOUT_SECONDS=120
KEEP_RELEASES=5

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "root로 실행해야 합니다."
[[ "$RELEASE_ID" =~ ^[0-9a-f]{7,40}$ ]] || fail "잘못된 릴리스 ID: $RELEASE_ID"
[ -f "$ARCHIVE" ] || fail "릴리스 파일이 없습니다: $ARCHIVE"
[ -f "$ENV_NEXT" ] || fail "$ENV_NEXT 가 없습니다. GitHub Actions 배포로 실행해 주세요."

# env 파일에서 값 하나 읽기 (값은 "..."로 감싸 있고 \ " 줄바꿈은 들어 있지 않다. 셸로 실행하지 않는다)
env_get() {
  local line
  line="$(grep -m1 "^$1=" "$2")" || return 1
  line="${line#*=}"; line="${line#\"}"; printf '%s' "${line%\"}"
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null | grep -q '"UP"'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

switch_to() {
  ln -sfn "$1" "$CURRENT.next"
  mv -Tf "$CURRENT.next" "$CURRENT"
}

# 같은 서버의 PostgreSQL(localhost)이면 DB와 계정을 만들고 비밀번호를 Secret 값으로 맞춘다
provision_database() {
  local url user
  url="$(env_get DB_URL "$ENV_FILE")"
  user="$(env_get DB_USERNAME "$ENV_FILE")"
  if [[ ! "$url" =~ ^jdbc:postgresql://(localhost|127\.0\.0\.1)(:5432)?/([A-Za-z0-9_]+)$ ]]; then
    log "DB가 다른 서버에 있어 DB·계정 준비는 건너뜁니다: $url"
    return
  fi
  local db="${BASH_REMATCH[3]}"
  [[ "$user" =~ ^[a-z_][a-z0-9_]*$ ]] || fail "DB_USERNAME 형식이 올바르지 않습니다: $user"
  command -v psql >/dev/null || fail "psql이 없습니다. PostgreSQL 설치를 확인하세요."
  # 비밀번호는 명령줄에 남지 않도록 환경변수로 넘기고 psql의 \getenv로 읽는다
  (cd /tmp && SCOREROOM_DB_PASSWORD="$(env_get DB_PASSWORD "$ENV_FILE")" \
    runuser -u postgres -w SCOREROOM_DB_PASSWORD -- psql -q -v ON_ERROR_STOP=1 -v u="$user" -v db="$db" <<'SQL'
\getenv pw SCOREROOM_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN', :'u') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'u') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'u', :'pw') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'u') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SQL
  )
  log "DB '$db', 계정 '$user' 준비 완료"
}

target="$RELEASES/$RELEASE_ID"
previous="$(readlink -f "$CURRENT" 2>/dev/null || true)"

log "릴리스 $RELEASE_ID 준비"
install -d -o root -g root -m 755 "$RELEASES"
rm -rf "$target"
mkdir -p "$target"
tar -xzf "$ARCHIVE" -C "$target"
[ -f "$target/app.jar" ] && [ -f "$target/web/index.html" ] || fail "릴리스 묶음에 app.jar 또는 web/index.html이 없습니다."
chown -R root:root "$target"
chmod -R u=rwX,go=rX "$target"

log "서버 기본 구성 확인"
bash "$target/deploy/scripts/server-setup.sh"

log "설정 적용 (GitHub Secrets)"
if [ -f "$ENV_FILE" ]; then cp -p "$ENV_FILE" "$ENV_PREV"; else rm -f "$ENV_PREV"; fi
install -o root -g root -m 600 "$ENV_NEXT" "$ENV_FILE"
rm -f "$ENV_NEXT"
provision_database

log "current → $target, 서비스 재시작"
switch_to "$target"
systemctl restart "$SERVICE"

if wait_healthy; then
  log "헬스체크 통과"
else
  log "헬스체크 실패. 최근 로그:"
  journalctl -u "$SERVICE" -n 80 --no-pager || true
  if [ -n "$previous" ] && [ -d "$previous" ] && [ "$previous" != "$target" ]; then
    log "이전 릴리스와 설정으로 되돌립니다: $previous"
    [ -f "$ENV_PREV" ] && install -o root -g root -m 600 "$ENV_PREV" "$ENV_FILE"
    switch_to "$previous"
    systemctl restart "$SERVICE"
    wait_healthy && log "이전 릴리스로 복구됨" || log "이전 릴리스도 헬스체크에 실패했습니다. 서버를 확인하세요."
  fi
  rm -rf "$target"
  rm -f "$ARCHIVE"
  fail "배포 실패: $RELEASE_ID"
fi

# 오래된 릴리스 정리 (현재 것은 항상 남긴다)
active="$(readlink -f "$CURRENT")"
mapfile -t old < <(ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's:/$::' | tail -n +$((KEEP_RELEASES + 1)))
for dir in "${old[@]}"; do
  [ "$dir" = "$active" ] || rm -rf "$dir"
done
rm -f "$ARCHIVE" "$ENV_PREV"
log "배포 완료: $RELEASE_ID"
