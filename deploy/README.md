# EC2 자동 배포 (GitHub Actions)

main 브랜치에 merge(push)되면 GitHub Actions가 테스트·빌드한 뒤 EC2에 SSH로 배포합니다. 서버 설정과 비밀값은 모두 GitHub(Secrets·Variables)에서 관리하고, 배포할 때마다 서버에 다시 적용합니다. EC2에 직접 들어가 설정 파일을 고칠 필요가 없습니다.

```text
PR → main          : CI (백엔드 테스트 + jar, 프런트 타입 검사 + 빌드)
main에 push/merge  : CI → 서버 설정 파일 생성(Secrets) → 릴리스 업로드
                     → 서버 기본 구성 확인(계정·폴더·systemd·Nginx) → DB·계정 준비
                     → 쉬는 슬롯에 새 앱 시작 → 헬스체크 → Nginx 전환 → 이전 앱 정리 (무중단)
```

### 무중단 배포 (blue-green)

같은 EC2에서 앱 두 개(`scoreroom@8081`, `scoreroom@8082`) 중 하나만 서비스합니다. 배포하면

1. 쉬고 있는 포트에 새 앱을 띄우고 헬스체크를 기다립니다 (이전 앱은 계속 서비스 중)
2. 통과하면 `/etc/nginx/scoreroom-upstream.conf`를 새 포트로 바꾸고 Nginx를 reload합니다. reload는 연결을 끊지 않습니다
3. 화면 파일(`current`)을 바꾸고, 이전 앱은 30초 동안 처리 중인 요청을 마친 뒤 멈춥니다

헬스체크가 실패하면 새 앱만 멈추고 끝납니다. 사용자는 이전 앱을 그대로 씁니다. 로그인은 DB(세션 표)에 있어 앱이 바뀌어도 유지됩니다.

지켜야 할 것
- **DB 마이그레이션은 추가만**: 새 앱이 뜨면서 먼저 적용되므로, 전환하는 30초 남짓 이전 앱이 새 스키마에서 돕니다. 컬럼·표는 추가 → 사용 → 다음 배포에서 정리 순서로 바꿉니다.
- **API는 하위 호환으로**: 이미 열려 있는 이전 화면이 새 앱을 부릅니다 (새로 고침하면 새 화면). 이전 화면이 쓰는 파일이 사라지지 않게 배포가 이전 릴리스의 `web/assets`를 함께 둡니다.
- **메모리**: 전환하는 동안 JVM 두 개가 함께 뜹니다. `JAVA_OPTS`(기본 `-Xmx1g`) × 2가 서버 메모리에 들어가는지 확인하세요.
- 첫 무중단 배포 때 예전 단일 서비스(`scoreroom.service`, 8080)에서 슬롯으로 넘어가고, 예전 서비스는 자동으로 멈추고 지워집니다. 설정 파일의 `SERVER_PORT`는 슬롯 포트가 우선합니다.

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
| `SCOREROOM_SIGNUP_ENABLED` | `true` | 회원가입 허용 (`false`면 로그인 화면에서 가입 버튼이 사라진다) |
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
| `/opt/scoreroom/slots/<포트>` | 그 슬롯에서 돌리는 릴리스 링크 |
| `scoreroom@8081`, `scoreroom@8082` | Spring Boot 슬롯 (`scoreroom` 계정, 127.0.0.1). 한 번에 하나만 켜져 있다 |
| `/etc/nginx/scoreroom-upstream.conf` | Nginx가 `/api`를 보낼 슬롯 포트 (배포가 바꾼다) |
| Nginx `scoreroom` 사이트 | 80 포트: 화면 정적 파일 + `/api` → 지금 슬롯 |

## 확인과 되돌리기

```bash
cat /etc/nginx/scoreroom-upstream.conf        # 지금 서비스 중인 포트
sudo systemctl status 'scoreroom@*'
sudo journalctl -u scoreroom@8081 -f          # 포트는 위에서 확인한 값
curl -s http://127.0.0.1:8081/actuator/health
readlink -f /opt/scoreroom/current            # 지금 화면 릴리스
```

이전 버전으로 돌리려면 GitHub에서 해당 커밋을 되돌리는(revert) PR을 main에 merge하거나, Actions의 이전 성공 실행을 **Re-run**합니다. 되돌리기도 같은 무중단 전환으로 진행됩니다. 앱과 화면 파일만 되돌리며 DB 마이그레이션은 되돌리지 않으므로, 마이그레이션은 이전 버전 앱과도 함께 동작하도록(컬럼 추가 → 사용 → 나중에 정리) 작성하세요.
