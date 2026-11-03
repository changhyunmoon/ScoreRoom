# EC2 자동 배포 (GitHub Actions)

main 브랜치에 merge(push)되면 GitHub Actions가 테스트·빌드한 뒤 EC2에 SSH로 배포합니다.

```text
PR → main          : CI (백엔드 테스트 + jar, 프런트 타입 검사 + 빌드)
main에 push/merge  : CI → 릴리스 묶음(app.jar + web/) 업로드 → 서비스 재시작 → 헬스체크
                     헬스체크 실패 시 이전 릴리스로 자동 복구
```

- 워크플로: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- 문서(`*.md`, `docs/`)만 바뀐 push는 배포하지 않습니다. Actions 탭의 **Deploy → Run workflow**로 수동 배포할 수 있습니다.

## 서버 구성

| 위치 | 내용 |
|---|---|
| `/opt/scoreroom/releases/<커밋>` | 릴리스 (`app.jar`, `web/`). 최근 5개 보관 |
| `/opt/scoreroom/current` | 지금 쓰는 릴리스 링크. Nginx와 systemd가 이 경로를 본다 |
| `/var/lib/scoreroom/uploads` | 발표 자료 (DB와 함께 백업) |
| `/etc/scoreroom/scoreroom.env` | DB 비밀번호 등 비밀값 (root 600, 서버에만 둠) |
| `scoreroom.service` | Spring Boot (`scoreroom` 계정, 127.0.0.1:8080) |
| Nginx `scoreroom` 사이트 | 80 포트: 화면 정적 파일 + `/api` → 8080 |

## 처음 한 번 설정

### 1. EC2 (Ubuntu, Java 21·Nginx·PostgreSQL 설치됨)

```bash
# PostgreSQL에 DB와 계정이 없다면
sudo -u postgres psql -c "CREATE USER scoreroom WITH PASSWORD '비밀번호';"
sudo -u postgres psql -c "CREATE DATABASE scoreroom OWNER scoreroom;"

# 이 저장소의 deploy/ 폴더를 서버에 올리고 실행 (예: git clone 또는 scp)
sudo bash deploy/scripts/server-setup.sh

# 비밀값 채우기 (CHANGE_ME가 남아 있으면 배포가 멈춘다)
sudo nano /etc/scoreroom/scoreroom.env
```

- 서비스는 HTTPS 없이 `http://<EC2 주소>`로 운영합니다 (`SCOREROOM_SESSION_SECURECOOKIE=false`). 나중에 HTTPS를 붙이면 이 값을 `true`로 바꿉니다.
- 배포 계정(예: `ubuntu`)은 비밀번호 없이 `sudo`를 쓸 수 있어야 합니다 (EC2 Ubuntu 기본값).
- 테이블은 앱이 시작할 때 Flyway가 만듭니다.

### 2. 배포용 SSH 키

개인 PC에서 배포 전용 키를 새로 만들고, 공개키를 EC2에 등록합니다.

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f scoreroom_deploy -N ""
# scoreroom_deploy.pub 내용을 EC2의 ~ubuntu/.ssh/authorized_keys 에 한 줄 추가
ssh-keyscan -t ed25519 <EC2 주소> > known_hosts   # 결과가 서버의 실제 호스트 키와 같은지 확인
```

보안그룹의 22번 포트가 GitHub Actions에서 접속할 수 있게 열려 있어야 합니다.

### 3. GitHub 설정

저장소 **Settings → Environments → New environment → `production`** 을 만들고 Environment secrets에 넣습니다.

| Secret | 값 |
|---|---|
| `EC2_HOST` | EC2 퍼블릭 IP 또는 도메인 |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | `scoreroom_deploy` (개인키) 파일 내용 전체 |
| `EC2_KNOWN_HOSTS` | `known_hosts` 파일 내용 |
| `EC2_PORT` | (선택) SSH 포트, 기본 22 |

`production` 환경에 **Required reviewers**를 켜면 배포 전에 승인을 받게 할 수 있습니다. **Settings → Branches**에서 main 브랜치 보호 규칙으로 `CI` 통과를 merge 조건으로 걸어 두기를 권장합니다.

## 확인과 되돌리기

```bash
sudo systemctl status scoreroom
sudo journalctl -u scoreroom -f
curl -s http://127.0.0.1:8080/actuator/health
readlink -f /opt/scoreroom/current            # 지금 릴리스

# 직접 이전 릴리스로 되돌리기
sudo ln -sfn /opt/scoreroom/releases/<이전 커밋> /opt/scoreroom/current && sudo systemctl restart scoreroom
```

자동 복구는 앱과 화면 파일만 되돌립니다. DB 마이그레이션은 되돌리지 않으므로, 마이그레이션은 이전 버전 앱과도 함께 동작하도록(컬럼 추가 → 사용 → 나중에 정리) 작성하세요.
