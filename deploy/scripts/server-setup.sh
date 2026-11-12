#!/usr/bin/env bash
# 서버 기본 구성. 배포할 때마다 remote-deploy.sh가 자동으로 부른다 (여러 번 실행해도 안전하다).
# 직접 실행할 때: sudo bash deploy/scripts/server-setup.sh
# 전제: Java 21, Nginx, PostgreSQL은 이미 설치돼 있다.
# 하는 일
# - 서비스 계정(scoreroom)과 폴더: /opt/scoreroom(릴리스), /var/lib/scoreroom/uploads(발표 자료), /etc/scoreroom(설정)
# - systemd 슬롯 서비스(scoreroom@<포트>) 등록 (매번 저장소 버전으로 갱신)
# - Nginx 사이트 등록 (저장소 설정과 다르면 백업 후 교체)와 앱 포트 파일(/etc/nginx/scoreroom-upstream.conf, 없을 때만)
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

install -d -o root -g root -m 755 /opt/scoreroom/slots

# 무중단 배포용 슬롯 서비스(scoreroom@<포트>). 어느 슬롯을 켤지는 remote-deploy.sh가 정한다
unit=/etc/systemd/system/scoreroom@.service
if ! cmp -s "$HERE/systemd/scoreroom@.service" "$unit"; then
  install -o root -g root -m 644 "$HERE/systemd/scoreroom@.service" "$unit"
  systemctl daemon-reload
  log "systemd 슬롯 서비스 갱신"
fi

# Nginx가 지금 보낼 앱 포트. 배포가 바꾸므로 없을 때만 만든다
# (무중단 배포 이전의 단일 서비스 scoreroom.service가 8080에서 돌고 있으면 그쪽을 가리켜 전환 전까지 서비스가 이어지게 한다)
upstream=/etc/nginx/scoreroom-upstream.conf
if [ ! -f "$upstream" ]; then
  if systemctl is-active --quiet scoreroom 2>/dev/null; then port=8080; else port=8081; fi
  printf 'server 127.0.0.1:%s;\n' "$port" > "$upstream"
  chmod 644 "$upstream"
  log "Nginx 앱 포트 파일 생성: $port"
fi

# Nginx 사이트는 저장소 설정(deploy/nginx/scoreroom.conf)으로 맞춘다. 서버에 다른 내용이 있으면 백업 후 교체한다
site=/etc/nginx/sites-available/scoreroom
nginx_changed=false
if ! cmp -s "$HERE/nginx/scoreroom.conf" "$site"; then
  if [ -f "$site" ]; then
    cp -p "$site" "$site.bak.$(date +%Y%m%d%H%M%S)"
    log "기존 Nginx 설정을 백업했습니다: $site.bak.*"
  fi
  install -o root -g root -m 644 "$HERE/nginx/scoreroom.conf" "$site"
  nginx_changed=true
fi
if [ "$(readlink -f /etc/nginx/sites-enabled/scoreroom 2>/dev/null)" != "$site" ]; then
  ln -sfn "$site" /etc/nginx/sites-enabled/scoreroom
  nginx_changed=true
fi
if [ -e /etc/nginx/sites-enabled/default ]; then
  rm /etc/nginx/sites-enabled/default
  log "Nginx 기본 사이트(default)를 비활성화했습니다."
  nginx_changed=true
fi
if $nginx_changed; then
  nginx -t
  systemctl reload nginx
  log "Nginx 사이트 적용"
fi
# 80번 포트를 다른 사이트가 가로채지 않는지 알려준다
others="$(grep -lE 'listen[^;]*\b80\b' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null | grep -v '/scoreroom$' || true)"
if [ -n "$others" ]; then
  log "주의: 80번 포트를 쓰는 다른 Nginx 설정이 켜져 있습니다. ScoreRoom 대신 그 화면이 보일 수 있습니다:"
  echo "$others"
fi
