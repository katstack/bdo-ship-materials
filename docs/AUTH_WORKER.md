# Drive 장기 연결: Cloudflare Workers + Turso

## 상태와 경계

- 프론트는 GitHub Pages, 개인 진행 데이터는 LocalStorage와 Google Drive appDataFolder에 유지합니다.
- `worker/`는 인증·세션·접근 토큰 갱신만 담당합니다. 아이템 카탈로그나 게임 진행 데이터를 DB에 저장하지 않습니다.
- Turso DB: 사용자가 지정한 `bdo`, 도쿄, 초과 과금 비활성화. 인증용 네 테이블의 초기 스키마 적용과 실제 DB 조회를 확인했습니다. Google OAuth 실연동 검증은 Client Secret 등록 후 진행합니다.
- 2026-10-19: 서버 비밀 설정과 Worker 배포를 완료하고 API 커스텀 도메인을 연결했습니다. 운영 HTTPS, DB 세션 조회, CORS/미인증 차단과 Google 인증 시작을 확인했습니다. 실제 계정의 최초 동의·토큰 갱신 검증은 사용자 연결 이후에 확인합니다.
- 프론트는 `VITE_AUTH_API_URL`이 비어 있으면 기존 GIS 방식을 유지합니다. 검증 후 `https://bdo-api.katstack.dev`를 넣어 서버 방식으로 전환합니다.

## 필수 Google 설정

기존 웹 OAuth 클라이언트를 사용합니다. 승인된 JavaScript 원본에 `https://bdo.katstack.dev`를 유지하고, 승인된 리다이렉트 URI에 아래 **정확한 주소**를 추가합니다.

```text
https://bdo-api.katstack.dev/auth/google/callback
```

권한은 `openid`(안정적인 사용자 ID 확인)와 `https://www.googleapis.com/auth/drive.appdata`뿐입니다. 이메일·프로필·Drive 전체 권한을 요청하지 않습니다.

OAuth 앱이 외부/테스트 상태이면 Google 정책에 따라 갱신 토큰도 7일 후 만료될 수 있습니다. 게시 상태·해당 권한의 검증 필요 여부를 Google Console에서 확인합니다. 서버가 있어도 Google의 권한 취소·갱신 토큰 폐기는 우회할 수 없습니다.

## 개발과 검증

WSL `Ubuntu-26.04`, 프로젝트 `/home/whya5448/workspace/bdo-ship-materials` 기준입니다.

```bash
cd worker
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

테스트는 Node 내장 SQLite를 사용해 실제 SQL, PKCE, 브라우저에 묶인 일회성 state, 암호화, 세션 격리, CSRF/CORS, 만료 후 자동 갱신, 동시 갱신 잠금과 권한 취소를 검증합니다.

Turso 스키마는 기존 데이터를 삭제하지 않는 초기 DDL입니다.

```bash
~/.local/bin/turso db shell bdo < migrations/001_auth.sql
```

로컬은 별도 개발용 Turso DB/토큰을 사용하는 것이 좋습니다. `.dev.vars.example`을 참고해 `.dev.vars`를 준비하고 `pnpm dev`로 실행합니다. 로컬 OAuth 리다이렉트 URI는 `http://localhost:8787/auth/google/callback`, 프론트는 `http://localhost:5173`, `VITE_AUTH_API_URL=http://localhost:8787`입니다. 로컬 주소도 Google Console에 별도 등록해야 합니다.

## 비밀 설정

저장소 루트에서 다음 명령은 Client Secret을 화면에 표시하지 않고 입력받습니다. Google Console에서 기존 웹 클라이언트의 Client Secret을 확인하세요. 채팅이나 셸 명령 인수로 붙이지 마세요.

```bash
node worker/scripts/prepare-secrets.mjs
```

다운로드한 클라이언트 JSON이 있다면 다음처럼 경로만 넘깁니다.

```bash
node worker/scripts/prepare-secrets.mjs --client-json /path/to/client.json
```

세 비밀값은 저장소 밖 `~/.config/bdo-ship-auth/secrets.json`에 권한 600으로 생성됩니다.

- `GOOGLE_CLIENT_SECRET`: 기존 Google 웹 OAuth 클라이언트.
- `TURSO_AUTH_TOKEN`: 해당 DB 전용 토큰. 만료 없는 토큰이므로 유출 시 즉시 교체합니다.
- `TOKEN_ENCRYPTION_KEY`: AES-256-GCM 키. 재배포 때 재생성하지 않습니다. 키를 잃으면 기존 DB의 갱신 토큰을 복호화할 수 없어 재연결이 필요합니다.

암호화 키와 DB 토큰은 브라우저·LocalStorage·GitHub 변수·프론트 빌드에 넣지 않습니다. 서버 비밀은 Cloudflare에 업로드합니다. 클라이언트 JSON도 커밋하지 않습니다.

## 배포와 전환 순서

```bash
cd worker
cf deploy --secrets-file ~/.config/bdo-ship-auth/secrets.json
```

1. 먼저 workers.dev 주소의 `/healthz`와 오류 응답을 확인합니다. `ready`는 설정 유무만 확인하며 DB나 Google의 실제 인증 성공을 보장하지 않습니다.
2. Google 콜백 URI와 스키마가 준비됐는지 확인합니다.
3. Cloudflare Workers Custom Domain으로 `bdo-api.katstack.dev`를 연결합니다. 기존 A 레코드 제거·전환 직전에 대상과 VM 복구 경로를 확인합니다. 프론트 DNS와 GitLab Tailscale 설정은 변경하지 않습니다.
4. 해당 도메인에서 최초 계정 연결·자동 갱신·브라우저 세션 복원·로그아웃을 실제 검증합니다.
5. GitHub 저장소 Actions 변수 `VITE_AUTH_API_URL=https://bdo-api.katstack.dev`를 등록하고 Pages를 다시 빌드합니다. 이전 세션은 서버 방식으로 한 번 다시 연결해야 합니다.

비밀 미설정·DB 연결 불가·CPU 한도 초과가 있으면 운영 전환을 중단합니다. Workers Free의 CPU 10ms 내 실행 여부는 실제 배포에서 확인하며, 무료 플랜을 자동으로 유료 전환하지 않습니다.

## 보안과 연결 유지

- 갱신·접근 토큰은 사용자 ID와 용도에 결합한 AES-GCM 암호문으로 저장합니다. 세션은 난수 쿠키 원문 대신 SHA-256 해시만 DB에 둡니다.
- 쿠키는 호스트 전용 `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`이며 180일 유효합니다. 다른 기기의 연결 해제에는 영향이 없습니다.
- Google 최초 연결 때만 계정 선택·권한 동의를 요청합니다. 새로고침과 접근 토큰 갱신에는 Google 창을 열지 않습니다.
- state는 10분·일회용이며 별도 브라우저 쿠키에 묶습니다. PKCE S256을 사용하고 Google 사용자 정보는 Google HTTPS API에서 직접 확인합니다.
- 세션 API는 정확한 프론트 Origin만 허용하고, 변경 요청은 추가 CSRF 헤더를 요구합니다.
- IP는 저장 전에 해시 처리하며 DB 기반 요청 제한과 사용자별 갱신 잠금을 사용합니다. 분산 공격에 대한 완전한 방어는 아니므로 계정 무료 한도도 모니터링합니다.
- Worker는 토큰·코드·오류 응답 본문을 로그에 출력하지 않습니다. 관측 로그는 기본 비활성화하고 쿼리 문자열을 제거하도록 설정합니다.
- 네트워크·Turso 장애에도 진행 데이터는 LocalStorage에 남습니다. Google 권한이 취소되면 사용자에게 재연결을 요청합니다.
- 연결 해제는 현재 브라우저 세션만 삭제합니다. Drive 파일과 다른 브라우저의 세션은 삭제하거나 취소하지 않습니다.

## 복구

서버 인증 문제가 있으면 GitHub의 `VITE_AUTH_API_URL` 변수를 비우고 Pages를 다시 빌드해 기존 GIS 방식으로 되돌릴 수 있습니다. VM의 nginx 구성은 별도 복구용으로 유지하며, DNS를 되돌리는 경우 Workers 도메인 매핑도 함께 확인합니다.
