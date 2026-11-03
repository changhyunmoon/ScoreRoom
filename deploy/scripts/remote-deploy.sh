#!/usr/bin/env bash
# EC2에서 root로 실행한다 (GitHub Actions가 sudo로 부른다).
#   remote-deploy.sh <release-id> <release.tar.gz>
# 1) 릴리스를 /opt/scoreroom/releases/<id>에 풀고
# 2) current 링크를 새 릴리스로 바꾼 뒤 서비스를 재시작하고
# 3) 헬스체크가 실패하면 이전 릴리스로 되돌린다.
# 주의: DB 마이그레이션(Flyway)은 되돌리지 않는다. 마이그레이션은 이전 버전과 함께 동작하도록 작성한다.
set -euo pipefail

RELEASE_ID="${1:?release id required}"
ARCHIVE="${2:?release archive required}"

APP_ROOT=/opt/scoreroom
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE=/etc/scoreroom/scoreroom.env
SERVICE=scoreroom
HEALTH_URL="http://127.0.0.1:8080/actuator/health"
HEALTH_TIMEOUT_SECONDS=120
KEEP_RELEASES=5

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "root로 실행해야 합니다."
[[ "$RELEASE_ID" =~ ^[0-9a-f]{7,40}$ ]] || fail "잘못된 릴리스 ID: $RELEASE_ID"
[ -f "$ARCHIVE" ] || fail "릴리스 파일이 없습니다: $ARCHIVE"
[ -f "$ENV_FILE" ] || fail "$ENV_FILE 이 없습니다. 먼저 deploy/scripts/server-setup.sh를 실행하세요."
grep -q 'CHANGE_ME' "$ENV_FILE" && fail "$ENV_FILE 에 CHANGE_ME 값이 남아 있습니다. 실제 값을 넣어 주세요."
systemctl cat "$SERVICE" >/dev/null 2>&1 || fail "$SERVICE 서비스가 없습니다. 먼저 server-setup.sh를 실행하세요."

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

target="$RELEASES/$RELEASE_ID"
previous="$(readlink -f "$CURRENT" 2>/dev/null || true)"

log "릴리스 $RELEASE_ID 준비"
rm -rf "$target"
mkdir -p "$target"
tar -xzf "$ARCHIVE" -C "$target"
[ -f "$target/app.jar" ] && [ -f "$target/web/index.html" ] || fail "릴리스 묶음에 app.jar 또는 web/index.html이 없습니다."
chown -R root:root "$target"
chmod -R u=rwX,go=rX "$target"

log "current → $target, 서비스 재시작"
switch_to "$target"
systemctl restart "$SERVICE"

if wait_healthy; then
  log "헬스체크 통과"
else
  log "헬스체크 실패. 최근 로그:"
  journalctl -u "$SERVICE" -n 80 --no-pager || true
  if [ -n "$previous" ] && [ -d "$previous" ] && [ "$previous" != "$target" ]; then
    log "이전 릴리스로 되돌립니다: $previous"
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
rm -f "$ARCHIVE"
log "배포 완료: $RELEASE_ID"
