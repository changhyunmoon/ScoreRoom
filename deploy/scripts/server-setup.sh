#!/usr/bin/env bash
# EC2에서 처음 한 번만 실행한다 (Java 21, Nginx, PostgreSQL은 이미 설치돼 있어야 한다).
#   sudo bash deploy/scripts/server-setup.sh
# 하는 일
# - 서비스 계정(scoreroom)과 폴더 생성: /opt/scoreroom(릴리스), /var/lib/scoreroom/uploads(발표 자료)
# - /etc/scoreroom/scoreroom.env 템플릿 생성 (이미 있으면 건드리지 않음)
# - systemd 서비스 등록, Nginx 사이트 등록
# 여러 번 실행해도 안전하다. 기존 env 파일과 Nginx 사이트 파일은 덮어쓰지 않는다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER=scoreroom

log() { echo "[setup] $*"; }
[ "$(id -u)" -eq 0 ] || { echo "sudo로 실행해 주세요." >&2; exit 1; }

# 필요한 프로그램 확인
for cmd in java nginx curl; do
  command -v "$cmd" >/dev/null || { echo "$cmd 이(가) 설치돼 있지 않습니다." >&2; exit 1; }
done
java_major="$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.specification.version/{print $2}')"
if [ "${java_major%%.*}" -lt 21 ]; then
  echo "Java 21 이상이 필요합니다 (현재 $java_major)." >&2; exit 1
fi

log "서비스 계정과 폴더"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir /var/lib/scoreroom --shell /usr/sbin/nologin "$APP_USER"
install -d -o root -g root -m 755 /opt/scoreroom /opt/scoreroom/releases
install -d -o "$APP_USER" -g "$APP_USER" -m 750 /var/lib/scoreroom /var/lib/scoreroom/uploads
install -d -o root -g root -m 755 /etc/scoreroom

if [ ! -f /etc/scoreroom/scoreroom.env ]; then
  install -o root -g root -m 600 "$HERE/scoreroom.env.example" /etc/scoreroom/scoreroom.env
  log "/etc/scoreroom/scoreroom.env 를 만들었습니다. CHANGE_ME 값을 실제 값으로 바꿔 주세요."
else
  log "/etc/scoreroom/scoreroom.env 가 이미 있어 그대로 둡니다."
fi

log "systemd 서비스 등록"
install -o root -g root -m 644 "$HERE/systemd/scoreroom.service" /etc/systemd/system/scoreroom.service
systemctl daemon-reload
systemctl enable scoreroom >/dev/null

log "Nginx 사이트 등록"
if [ ! -f /etc/nginx/sites-available/scoreroom ]; then
  install -o root -g root -m 644 "$HERE/nginx/scoreroom.conf" /etc/nginx/sites-available/scoreroom
else
  log "/etc/nginx/sites-available/scoreroom 이 이미 있어 그대로 둡니다 (HTTPS 설정 보존)."
fi
ln -sfn /etc/nginx/sites-available/scoreroom /etc/nginx/sites-enabled/scoreroom
if [ -L /etc/nginx/sites-enabled/default ]; then
  rm /etc/nginx/sites-enabled/default
  log "Nginx 기본 사이트(default)를 비활성화했습니다."
fi
nginx -t
systemctl reload nginx

log "완료. 이제 GitHub Actions 배포를 실행하면 /opt/scoreroom/current 에 릴리스가 올라갑니다."
