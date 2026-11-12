#!/usr/bin/env bash
# EC2에서 root로 실행한다 (GitHub Actions가 sudo로 부른다).
#   remote-deploy.sh <release-id> <release.tar.gz>
# 전제: GitHub Actions가 Secrets로 만든 설정을 /etc/scoreroom/scoreroom.env.next 로 먼저 올려 둔다.
# 1) 릴리스를 /opt/scoreroom/releases/<id>에 풀고 서버 기본 구성(server-setup.sh)을 맞춘다
# 2) 새 설정을 적용하고, 같은 서버의 PostgreSQL이면 DB·계정을 만들고 비밀번호를 Secret과 맞춘다
# 3) 무중단 전환(blue-green): 지금 서비스 중인 앱은 그대로 두고 쉬고 있는 슬롯(8081/8082)에 새 앱을 띄운다.
#    헬스체크가 통과하면 Nginx를 새 포트로 바꿔 reload하고(연결은 끊기지 않는다), 화면 파일을 바꾼 뒤 이전 앱을 멈춘다.
#    헬스체크가 실패하면 새 앱만 멈춘다. 이전 앱은 계속 서비스 중이라 사용자는 영향을 받지 않는다.
# 주의: 새 앱이 뜨면서 DB 마이그레이션(Flyway)을 먼저 적용하므로, 전환하는 동안 이전 앱이 새 스키마에서 잠깐 돈다.
#       마이그레이션은 이전 버전과 함께 동작하도록(컬럼·표 추가 → 사용 → 나중에 정리) 작성한다. 되돌리지도 않는다.
set -euo pipefail

RELEASE_ID="${1:?release id required}"
ARCHIVE="${2:?release archive required}"

APP_ROOT=/opt/scoreroom
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE=/etc/scoreroom/scoreroom.env
ENV_NEXT="$ENV_FILE.next"
ENV_PREV="$ENV_FILE.prev"
SLOTS="$APP_ROOT/slots"
UPSTREAM=/etc/nginx/scoreroom-upstream.conf
# 무중단 배포 이전의 단일 서비스(scoreroom.service, 8080). 첫 전환 때 멈추고 지운다
LEGACY_SERVICE=scoreroom
LEGACY_PORT=8080
# 이전 앱이 처리 중인 요청을 마치도록 Nginx 전환 뒤 기다리는 시간
DRAIN_SECONDS=30
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

# wait_healthy <포트>
wait_healthy() {
  local url="http://127.0.0.1:$1/actuator/health"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS --max-time 3 "$url" 2>/dev/null | grep -q '"UP"'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Nginx가 지금 보내는 앱 포트 (없으면 빈 값)
active_port() {
  grep -oE '127\.0\.0\.1:[0-9]+' "$UPSTREAM" 2>/dev/null | head -n1 | cut -d: -f2 || true
}

point_nginx_to() {
  printf 'server 127.0.0.1:%s;\n' "$1" > "$UPSTREAM.next"
  chmod 644 "$UPSTREAM.next"
  mv -f "$UPSTREAM.next" "$UPSTREAM"
}

# 이전 앱을 멈추고 서버를 다시 켜도 뜨지 않게 한다
retire_port() {
  if [ "$1" = "$LEGACY_PORT" ]; then
    systemctl disable --now "$LEGACY_SERVICE" >/dev/null 2>&1 || true
    if [ -f "/etc/systemd/system/$LEGACY_SERVICE.service" ]; then
      rm -f "/etc/systemd/system/$LEGACY_SERVICE.service"
      systemctl daemon-reload
      log "무중단 배포 이전의 단일 서비스($LEGACY_SERVICE.service)를 정리했습니다."
    fi
  else
    systemctl disable --now "scoreroom@$1" >/dev/null 2>&1 || true
  fi
}

restore_env() {
  if [ -f "$ENV_PREV" ]; then install -o root -g root -m 600 "$ENV_PREV" "$ENV_FILE"; fi
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
-- DB를 미리 만들어 둔 경우에도 앱 계정이 소유하게 한다 (PostgreSQL 15+는 public 스키마에 소유자만 테이블을 만든다)
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'u') \gexec
\connect :db
SELECT format('ALTER SCHEMA public OWNER TO %I', :'u') \gexec
SQL
  )
  log "DB '$db', 계정 '$user' 준비 완료"
}

target="$RELEASES/$RELEASE_ID"
# 이전 릴리스: current가 실제 릴리스 폴더를 가리킬 때만 (첫 배포나 깨진 링크면 없음)
previous=""
if [ -L "$CURRENT" ]; then
  previous="$(readlink -e "$CURRENT" 2>/dev/null || true)"
  [[ "$previous" == "$RELEASES"/* ]] || previous=""
fi

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

# --- 무중단 전환 ---
old_port="$(active_port)"
if [ "$old_port" = 8081 ]; then new_port=8082; else new_port=8081; fi
new_service="scoreroom@$new_port"
log "새 앱을 $new_port 포트에 띄웁니다 (지금 서비스 중: ${old_port:-없음})"
install -d -o root -g root -m 755 "$SLOTS"
systemctl stop "$new_service" >/dev/null 2>&1 || true   # 지난 배포에서 남은 것이 있으면 정리
ln -sfn "$target" "$SLOTS/$new_port.next"
mv -Tf "$SLOTS/$new_port.next" "$SLOTS/$new_port"
systemctl start "$new_service"

if ! wait_healthy "$new_port"; then
  log "새 앱 헬스체크 실패. 최근 로그:"
  journalctl -u "$new_service" -n 80 --no-pager || true
  systemctl stop "$new_service" || true
  rm -f "$SLOTS/$new_port"
  restore_env
  rm -rf "$target"
  rm -f "$ARCHIVE"
  fail "배포 실패: $RELEASE_ID (지금 서비스 중인 앱 ${old_port:-없음}은 그대로입니다)"
fi
log "새 앱 헬스체크 통과"

# 화면 파일: 이미 열려 있는 이전 화면이 나중에 불러올 파일(이름에 해시가 붙어 있음)이 사라지지 않게 이전 릴리스의 assets를 함께 둔다.
# 새 파일은 덮어쓰지 않는다 (cp -n은 건너뛴 파일이 있으면 실패 코드를 낼 수 있어 결과를 무시한다)
if [ -n "$previous" ] && [ -d "$previous/web/assets" ] && [ "$previous" != "$target" ]; then
  cp -rn "$previous/web/assets/." "$target/web/assets/" 2>/dev/null || true
  chmod -R u=rwX,go=rX "$target/web/assets"
fi

log "Nginx를 $new_port 포트로 전환"
point_nginx_to "$new_port"
if ! nginx -t 2>/dev/null; then
  [ -n "$old_port" ] && point_nginx_to "$old_port"
  systemctl stop "$new_service" || true
  restore_env
  fail "Nginx 설정 확인 실패. 이전 앱(${old_port:-없음})으로 그대로 둡니다."
fi
systemctl reload nginx
switch_to "$target"
systemctl enable "$new_service" >/dev/null 2>&1

if [ -n "$old_port" ] && [ "$old_port" != "$new_port" ]; then
  log "이전 앱($old_port)이 처리 중인 요청을 마치도록 ${DRAIN_SECONDS}초 기다린 뒤 멈춥니다"
  sleep "$DRAIN_SECONDS"
  retire_port "$old_port"
fi

# 오래된 릴리스 정리 (현재 것은 항상 남긴다)
active="$(readlink -f "$CURRENT")"
mapfile -t old < <(ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's:/$::' | tail -n +$((KEEP_RELEASES + 1)))
for dir in "${old[@]}"; do
  [ "$dir" = "$active" ] || rm -rf "$dir"
done
rm -f "$ARCHIVE" "$ENV_PREV"
log "배포 완료: $RELEASE_ID"
