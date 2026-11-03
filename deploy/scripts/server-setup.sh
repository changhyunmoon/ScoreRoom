#!/usr/bin/env bash
# 서버 기본 구성. 배포할 때마다 remote-deploy.sh가 자동으로 부른다 (여러 번 실행해도 안전하다).
# 직접 실행할 때: sudo bash deploy/scripts/server-setup.sh
# 전제: Java 21, Nginx, PostgreSQL은 이미 설치돼 있다.
# 하는 일
# - 서비스 계정(scoreroom)과 폴더: /opt/scoreroom(릴리스), /var/lib/scoreroom/uploads(발표 자료), /etc/scoreroom(설정)
# - systemd 서비스 등록 (매번 저장소 버전으로 갱신)
# - Nginx 사이트 등록 (처음 한 번만. 이후 서버에서 고친 내용은 덮어쓰지 않는다)
# 비밀값(/etc/scoreroom/scoreroom.env)은 GitHub Secrets로 배포 때 만들어진다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER=scoreroom

log() { echo "[setup] $*"; }
[ "$(id -u)" -eq 0 ] || { echo "sudo로 실행해 주세요." >&2; exit 1; }

for cmd in java nginx curl; do
  command -v "$cmd" >/dev/null || { echo "$cmd 이(가) 설치돼 있지 않습니다." >&2; exit 1; }
done
java_major="$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.specification.version/{print $2}')"
if [ "${java_major%%.*}" -lt 21 ]; then
  echo "Java 21 이상이 필요합니다 (현재 $java_major)." >&2; exit 1
fi

id "$APP_USER" >/dev/null 2>&1 || { useradd --system --home-dir /var/lib/scoreroom --shell /usr/sbin/nologin "$APP_USER"; log "서비스 계정 $APP_USER 생성"; }
install -d -o root -g root -m 755 /opt/scoreroom /opt/scoreroom/releases
install -d -o "$APP_USER" -g "$APP_USER" -m 750 /var/lib/scoreroom /var/lib/scoreroom/uploads
install -d -o root -g root -m 755 /etc/scoreroom

if ! cmp -s "$HERE/systemd/scoreroom.service" /etc/systemd/system/scoreroom.service; then
  install -o root -g root -m 644 "$HERE/systemd/scoreroom.service" /etc/systemd/system/scoreroom.service
  systemctl daemon-reload
  log "systemd 서비스 갱신"
fi
systemctl enable scoreroom >/dev/null 2>&1

if [ ! -f /etc/nginx/sites-available/scoreroom ]; then
  install -o root -g root -m 644 "$HERE/nginx/scoreroom.conf" /etc/nginx/sites-available/scoreroom
  ln -sfn /etc/nginx/sites-available/scoreroom /etc/nginx/sites-enabled/scoreroom
  if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    log "Nginx 기본 사이트(default)를 비활성화했습니다."
  fi
  nginx -t
  systemctl reload nginx
  log "Nginx 사이트 등록"
fi
