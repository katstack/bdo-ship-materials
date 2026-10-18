# 도메인 운영

## 주소와 역할

| 용도               | 주소                          | 연결 대상                                 |
| ------------------ | ----------------------------- | ----------------------------------------- |
| 프론트엔드         | https://bdo.katstack.dev/     | GitHub Pages: katstack/bdo-ship-materials |
| 백엔드 (예약 이름) | https://bdo-api.katstack.dev/ | VM 주소 및 백엔드 배포 확정 후 연결       |
| 로컬 개발          | http://localhost:5173         | Vite 개발 서버                            |

백엔드 이름을 정한 것만으로 OAuth 서버나 DNS가 구축된 것은 아닙니다. 프론트 도메인 연결과 백엔드 구현은 별도 작업입니다.

## DNS 및 GitHub Pages

- Cloudflare의 `bdo` CNAME을 `katstack.github.io`로 설정합니다. 저장소 경로는 DNS 값에 넣지 않습니다.
- GitHub 인증서 발급과 DNS 검증이 직접 이루어지도록 Cloudflare 프록시는 끄고 DNS only로 연결합니다.
- 저장소 Pages의 Custom domain은 `bdo.katstack.dev`입니다. 인증서 발급 후 Enforce HTTPS를 활성화합니다.
- 배포 워크플로는 `VITE_BASE_PATH=/`를 사용합니다. `public/CNAME`이 빌드 결과의 `CNAME`으로 복사됩니다.
- Cloudflare CLI는 WSL `Ubuntu-26.04`의 `cf` 명령으로 사용합니다. 인증정보는 저장소에 기록하지 않습니다.
- DNS를 수정하기 전에 해당 이름의 레코드를 조회해 충돌 여부를 확인합니다. 백엔드 IP는 추측해서 등록하지 않습니다.

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
