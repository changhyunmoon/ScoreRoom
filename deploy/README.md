# EC2 자동 배포 (GitHub Actions)

main 브랜치에 merge(push)되면 GitHub Actions가 테스트·빌드한 뒤 EC2에 SSH로 배포합니다. 서버 설정과 비밀값은 모두 GitHub(Secrets·Variables)에서 관리하고, 배포할 때마다 서버에 다시 적용합니다. EC2에 직접 들어가 설정 파일을 고칠 필요가 없습니다.

```text
PR → main          : CI (백엔드 테스트 + jar, 프런트 타입 검사 + 빌드)
main에 push/merge  : CI → 서버 설정 파일 생성(Secrets) → 릴리스 업로드
                     → 서버 기본 구성 확인(계정·폴더·systemd·Nginx) → DB·계정 준비
                     → 서비스 재시작 → 헬스체크 (실패 시 이전 릴리스·설정으로 자동 복구)
```

- 워크플로: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- 문서(`*.md`, `docs/`)만 바뀐 push는 배포하지 않습니다. **Actions → Deploy → Run workflow**로 수동 배포할 수 있습니다.
- Secret 값을 바꾼 뒤에는 수동 배포를 한 번 돌리면 서버에 반영됩니다.

## 처음 한 번 설정

### 1. EC2

Java 21, Nginx, PostgreSQL만 설치돼 있으면 됩니다. 나머지(서비스 계정, 폴더, systemd 서비스, Nginx 사이트, DB와 DB 계정)는 첫 배포가 만듭니다.

- 배포 계정(예: `ubuntu`)은 비밀번호 없이 `sudo`를 쓸 수 있어야 합니다 (EC2 Ubuntu 기본값).
- 보안그룹: 22번(배포용 SSH), 80번(서비스) 포트를 엽니다.
- 배포는 Nginx 기본 사이트(`default`)를 끄고, `/etc/nginx/sites-available/scoreroom`을 저장소의 `deploy/nginx/scoreroom.conf`로 맞춥니다 (다르면 백업 후 교체). Nginx 설정은 저장소에서 고칩니다.

### 2. GitHub Environment `production`

저장소 **Settings → Environments → `production`** 에 넣습니다.

**Secrets** (비밀값)

| 이름 | 필수 | 값 |
|---|---|---|
| `EC2_HOST` | ✔ | EC2 퍼블릭 IP (예: `3.36.219.59`) |
| `EC2_USER` | ✔ | `ubuntu` |
| `EC2_SSH_KEY` | ✔ | pem(개인키) 파일 내용 전체 |
| `EC2_KNOWN_HOSTS` | ✔ | `ssh-keyscan -t ed25519 <EC2 IP>` 출력 중 `#` 아닌 줄 (Git Bash 등 최신 OpenSSH로 실행) |
| `EC2_PORT` |  | SSH 포트 (기본 22) |
| `DB_PASSWORD` | ✔ | ScoreRoom DB 계정 비밀번호. 배포 때 DB 계정 비밀번호를 이 값으로 맞춘다 |
| `DB_USERNAME` |  | DB 계정 이름 (기본 `scoreroom`) |
| `SCOREROOM_ADMIN_LOGIN_ID` | ✔ | 최초 시스템 관리자 이메일 |
| `SCOREROOM_ADMIN_PASSWORD` | ✔ | 최초 시스템 관리자 비밀번호 (8자 이상) |

**Variables** (비밀이 아닌 설정, 모두 선택)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/scoreroom` | localhost이면 배포가 DB·계정을 자동으로 만든다 |
| `SCOREROOM_SESSION_SECURECOOKIE` | `false` | HTTPS를 붙이면 `true` |
| `SCOREROOM_SIGNUP_ENABLED` | `false` | 공개 회원가입 허용 |
| `JAVA_OPTS` | `-Xms256m -Xmx1g` | JVM 메모리 |

- 값에는 줄바꿈, 큰따옴표(`"`), 역슬래시(`\`)를 쓸 수 없습니다 (배포가 알려 주고 멈춤).
- 최초 시스템 관리자는 **시스템 관리자가 한 명도 없을 때 한 번만** 만들어집니다. 그 뒤 Secret을 바꿔도 비밀번호는 바뀌지 않으니, 비밀번호 변경은 화면의 개인정보 수정에서 합니다.
- `production` 환경에 **Required reviewers**를 켜면 배포 전에 승인을 받게 할 수 있습니다.

## 서버 구성

| 위치 | 내용 |
|---|---|
| `/opt/scoreroom/releases/<커밋>` | 릴리스 (`app.jar`, `web/`). 최근 5개 보관 |
| `/opt/scoreroom/current` | 지금 쓰는 릴리스 링크 |
| `/var/lib/scoreroom/uploads` | 발표 자료 (DB와 함께 백업) |
| `/etc/scoreroom/scoreroom.env` | GitHub Secrets로 만든 설정 (root 600, 배포마다 덮어씀) |
| `scoreroom.service` | Spring Boot (`scoreroom` 계정, 127.0.0.1:8080) |
| Nginx `scoreroom` 사이트 | 80 포트: 화면 정적 파일 + `/api` → 8080 |

## 확인과 되돌리기

```bash
sudo systemctl status scoreroom
sudo journalctl -u scoreroom -f
curl -s http://127.0.0.1:8080/actuator/health
readlink -f /opt/scoreroom/current            # 지금 릴리스
```

이전 버전으로 돌리려면 GitHub에서 해당 커밋을 되돌리는(revert) PR을 main에 merge하거나, Actions의 이전 성공 실행을 **Re-run**합니다. 자동 복구와 되돌리기는 앱과 화면 파일만 되돌리며 DB 마이그레이션은 되돌리지 않으므로, 마이그레이션은 이전 버전 앱과도 함께 동작하도록(컬럼 추가 → 사용 → 나중에 정리) 작성하세요.
