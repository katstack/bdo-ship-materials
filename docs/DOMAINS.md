# 도메인 운영

## 주소와 역할

| 용도                | 주소                          | 연결 대상                                 |
| ------------------- | ----------------------------- | ----------------------------------------- |
| 프론트엔드          | https://bdo.katstack.dev/     | GitHub Pages: katstack/bdo-ship-materials |
| 백엔드 HTTPS 진입점 | https://bdo-api.katstack.dev/ | oracle VM의 nginx → 127.0.0.1:3000        |
| 로컬 개발           | http://localhost:5173         | Vite 개발 서버                            |

프론트와 백엔드 DNS 및 HTTPS 진입점은 연결되었습니다. OAuth 애플리케이션 서버는 아직 구현되지 않았습니다. `/healthz`는 `proxy_ready` 및 `oauth: not_configured`를 반환하고, 실행 중인 백엔드가 없으면 다른 요청은 503을 반환합니다.

## DNS 및 GitHub Pages

- Cloudflare의 `bdo` CNAME을 `katstack.github.io`로 설정합니다. 저장소 경로는 DNS 값에 넣지 않습니다.
- GitHub 인증서 발급과 DNS 검증이 직접 이루어지도록 Cloudflare 프록시는 끄고 DNS only로 연결합니다.
- 저장소 Pages의 Custom domain은 `bdo.katstack.dev`입니다. 인증서 발급 후 Enforce HTTPS를 활성화합니다.
- 배포 워크플로는 `VITE_BASE_PATH=/`를 사용합니다. `public/CNAME`이 빌드 결과의 `CNAME`으로 복사됩니다.
- Cloudflare CLI는 WSL `Ubuntu-26.04`의 `cf` 명령으로 사용합니다. 인증정보는 저장소에 기록하지 않습니다.
- DNS를 수정하기 전에 해당 이름의 레코드를 조회해 충돌 여부를 확인합니다. 백엔드 A 레코드는 사용자가 지정한 `ssh oracle` 대상 VM을 가리키며, IP는 SSH 설정 및 Cloudflare에서 확인합니다.

## 백엔드 TLS 운영

- VM은 Ubuntu 24.04 ARM64입니다. 실제 확인된 CPU는 4개, 메모리는 약 24 GiB입니다.
- nginx 설정 원본은 `deploy/nginx/bdo-api.katstack.dev.conf`이며 VM의 `/etc/nginx/sites-available/bdo-api.katstack.dev`에서 활성화됩니다.
- 기존 Let's Encrypt DNS-01 인증서 `/etc/letsencrypt/live/katstack.dev/`의 `*.katstack.dev` 인증서를 사용합니다. 인증서 개인키나 Cloudflare 인증정보는 저장소에 넣지 않습니다.
- 기존 `certbot.timer`를 유지합니다. `deploy/certbot/reload-bdo-nginx.sh`는 VM의 `/etc/letsencrypt/renewal-hooks/deploy/`에 설치하며, 인증서 갱신 성공 후 `nginx -t`를 통과하면 reload합니다.
- 공개 인바운드는 TCP 443을 사용합니다. DNS-01 갱신에는 공개 80 포트를 열 필요가 없습니다. Rust 서버는 추후 `127.0.0.1:3000`에 바인딩합니다.
- 외부 HTTPS 확인: `curl --fail https://bdo-api.katstack.dev/healthz`. 이는 프록시 생존 검사이며 로그인이나 동기화가 구현되었다는 의미가 아닙니다.
- 초기 작업 시 VM 루트 디스크가 99% 사용 중이었습니다. 대규모 빌드나 DB 설치 전에 디스크 사용량을 확인하고, 사용자 승인 없이 기존 데이터를 삭제하지 않습니다.

## 기존 브라우저 데이터 이전

LocalStorage는 origin별로 분리되어 있으므로 기존 `https://katstack.github.io/bdo-ship-materials/`에서 새 주소로 자동 복사되지 않습니다.

1. 도메인 전환 전에 기존 앱의 JSON 내보내기로 로컬 데이터를 백업합니다.
2. 새 주소에서 JSON 가져오기를 실행하거나, 최신 Google Drive 백업을 불러옵니다.
3. 확인 전에는 샘플/빈 로컬 데이터로 기존 Drive 데이터를 덮어쓰지 않습니다.

기존 GitHub Pages 주소가 새 도메인으로 리다이렉트된 뒤에는 기존 주소에서 내보내기가 어려울 수 있으므로, 별도 브라우저 데이터 삭제는 하지 마세요.

## Google OAuth

Google Cloud Console의 기존 OAuth 클라이언트에 승인된 JavaScript 원본 `https://bdo.katstack.dev`를 추가해야 합니다. 로컬 개발용 `http://localhost:5173`도 별도로 유지합니다. 원본에는 경로를 붙이지 않습니다.

DNS/GitHub 설정만으로 Google OAuth 허용 원본이 자동 변경되지는 않습니다. 새 원본이 미등록이면 Drive 연결에서 origin 오류가 발생할 수 있습니다.

추후 서버 OAuth 흐름을 구현할 때는 실제 콜백 경로를 확정한 뒤 `https://bdo-api.katstack.dev/...`의 정확한 리다이렉트 URI를 별도로 등록합니다. 와일드카드로 등록하지 않습니다.

## 향후 서버 세션

프론트와 API가 모두 HTTPS의 `katstack.dev` 아래에 있으면 same-site이지만 cross-origin입니다. API 쿠키는 API 호스트 전용으로 두고 `HttpOnly`, `Secure`, 적절한 `SameSite`를 적용합니다. 전체 도메인 공유 쿠키는 만들지 않습니다.

CORS는 실제 프론트 origin만 허용하고, 인증 요청은 credentials 설정과 CSRF 방어를 함께 적용합니다. 로컬에서는 개발 프록시를 통해 운영과 다른 cross-site 쿠키 문제를 피하도록 구성합니다.
