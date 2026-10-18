# 검은사막 에페리아 함선 장비 재료 관리

브라우저의 LocalStorage만 사용하는 정적 React 웹앱입니다. 보유 수량은 같은 이름의 재료끼리 모든 장비에서 공유되며, 장비/전체 진행률과 부족량은 자동 계산됩니다.

배포 주소: [bdo.katstack.dev](https://bdo.katstack.dev/)

커스텀 도메인, DNS, 로컬 데이터 이전 및 OAuth 원본 설정은 [도메인 운영 문서](docs/DOMAINS.md)를 참고하세요.

함대·단계·고정 게임 데이터의 의도와 다음 작업자가 따라야 할 기준은 [앱 설계 문서](docs/APP_INTENT.md)를 참고하세요.

## 제작 노트 원본 데이터 추출 (Windows)

검은사막 클라이언트 설치본에서 아이템·제작식·의뢰·NPC 데이터를 읽어 올 때는 Windows PowerShell에서 아래 스크립트를 실행합니다. 게임 설치 폴더는 읽기만 하며, 결과는 `%LOCALAPPDATA%\bdo-ship-materials\extracted\<실행시각>`에 생성됩니다.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\extract-bdo-client.ps1
```

Windows 탐색기에서 `scripts\extract-bdo-client.cmd`를 더블클릭해도 같은 작업을 실행할 수 있습니다.

기본 게임 경로는 `C:\Pearlabyss\BlackDesert`입니다. 다른 경로라면 다음처럼 지정합니다.

```powershell
.\scripts\extract-bdo-client.ps1 -GameDir 'D:\Games\BlackDesert'
```

처음 실행할 때만 사용자 로컬 도구 폴더에 Go와 `bdo-data-extractor`를 설치합니다. 이후 실행은 추출기 갱신과 JSON 생성만 수행합니다.

`Auto`가 기본값입니다. 현재 한국 서비스 클라이언트는 공개 추출기가 요구하는 `ads\languagedata_en.loc`가 없으며, 설치된 `locales\ko.pak`은 게임 아이템 로컬라이즈가 아닌 런처 UI 리소스입니다. 따라서 완성된 이름 포함 카탈로그 대신 PAZ 파일 인덱스, `manufacture.bss`·`itemenchant.dbss` 원시 테이블, 그리고 ID 기반 `data\manufacture.raw.json`을 저장합니다. 이 JSON에는 가공 입력 아이템 ID·수량·종류·성공률이 들어가며 결과물은 서버 드롭 그룹이라 별도 카탈로그와 병합해야 합니다. 영문 LOC 형식을 가진 지원 클라이언트에서만 전체 JSON을 만들려면 `-Mode Full`을, 원시 스냅샷을 강제하려면 `-Mode Raw`를 사용합니다.

## 로컬 실행

이 프로젝트는 Node.js 24 LTS를 사용합니다. nvm이 설치되어 있다면 저장소에서 아래 명령으로 맞춥니다.

```bash
nvm install
nvm use
```

그다음 Corepack으로 프로젝트에 고정된 pnpm을 활성화하고, 의존성을 설치해 개발 서버를 실행합니다.

```bash
corepack enable
pnpm install
pnpm dev
```

배포용 결과물 검증은 `pnpm build`로 할 수 있습니다. 결과 파일은 `dist/`에 생성됩니다.

## GitHub Pages 배포

현재 GitHub Actions는 커스텀 도메인 `bdo.katstack.dev`의 루트에 배포하므로 `VITE_BASE_PATH=/`로 빌드합니다. `public/CNAME`도 배포 결과에 포함됩니다.

커스텀 도메인 없이 GitHub Pages 프로젝트 주소로 배포할 경우에만 저장소 이름을 base path로 지정합니다.

```bash
VITE_BASE_PATH=/bdo-ship-materials/ pnpm build
```

생성된 `dist` 디렉터리를 GitHub Pages의 배포 원본으로 지정하세요. 사용자/조직 페이지(`username.github.io`)는 기본값 `/`로 빌드하면 됩니다. `vite.config.ts`에서 `VITE_BASE_PATH`를 읽으므로 배포 환경별로 바꿀 수 있습니다.

## Google Drive 동기화

OAuth Client ID는 앱 코드에 공개 식별자로 고정되어 있습니다. Client ID는 비밀값이 아니며, Client Secret은 이 앱에서 사용하거나 저장하지 않습니다.

```bash
VITE_BASE_PATH=/bdo-ship-materials/ pnpm build
```

Google Cloud Console에서 이 앱의 배포 주소와 로컬 개발 주소를 OAuth **승인된 JavaScript 원본**에 등록해야 합니다. 이 앱은 Google Identity Services의 브라우저 OAuth 토큰 흐름만 쓰며 Client Secret을 사용하거나 저장하지 않습니다. 요청 권한은 `https://www.googleapis.com/auth/drive.appdata` 하나이며, 데이터는 사용자 Drive 파일 목록에 표시되지 않는 앱 전용 `appDataFolder/bdo-ship-materials.json`에 저장됩니다.

Drive 연결 후 변경 내용은 약 1.5초 뒤 자동 저장됩니다. 앱 시작 때 로컬과 Drive의 수정 시각이 다르면 더 최신 데이터를 권장하고, 어느 쪽으로 덮어쓸지 직접 선택할 수 있습니다. 네트워크 오류가 나도 LocalStorage 저장은 계속되며 다음 Drive 연결 때 재시도합니다.

## 데이터와 초기 재료

초기 샘플 장비와 재료는 [src/sampleData.ts](src/sampleData.ts)에 분리되어 있습니다. 여기의 이름·필요량·메모를 실제 목표 장비 기준으로 바꾸거나, 앱의 **데이터 관리** 화면에서 바로 편집할 수 있습니다.

진행 데이터는 해당 브라우저의 LocalStorage에 자동 저장됩니다. 기기 변경이나 브라우저 데이터 삭제 전에는 데이터 관리 화면의 **JSON 내보내기**로 백업하고, 다른 환경에서 **JSON 가져오기**로 복원하세요.
