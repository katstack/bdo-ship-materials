# 검은사막 무역선 파템 재료 관리

브라우저의 LocalStorage만 사용하는 정적 React 웹앱입니다. 보유 수량은 같은 이름의 재료끼리 모든 장비에서 공유되며, 장비/전체 진행률과 부족량은 자동 계산됩니다.

함대·단계·고정 게임 데이터의 의도와 다음 작업자가 따라야 할 기준은 [앱 설계 문서](docs/APP_INTENT.md)를 참고하세요.

## 로컬 실행

```bash
npm install
npm run dev
```

배포용 결과물 검증은 `npm run build`로 할 수 있습니다. 결과 파일은 `dist/`에 생성됩니다.

## GitHub Pages 배포

GitHub Actions 또는 Pages 빌드 환경에서 아래처럼 저장소 이름을 base path로 지정합니다. 예: 저장소가 `bdo-ship-materials`일 때

```bash
VITE_BASE_PATH=/bdo-ship-materials/ npm run build
```

생성된 `dist` 디렉터리를 GitHub Pages의 배포 원본으로 지정하세요. 사용자/조직 페이지(`username.github.io`)는 기본값 `/`로 빌드하면 됩니다. `vite.config.ts`에서 `VITE_BASE_PATH`를 읽으므로 배포 환경별로 바꿀 수 있습니다.

## Google Drive 동기화

설정 화면에서 OAuth Client ID를 입력하거나, 빌드 시 `VITE_GOOGLE_CLIENT_ID` 환경변수를 설정할 수 있습니다.

제공된 Client ID로 시작하려면 `.env.example`을 `.env`로 복사한 뒤 빌드하세요. `VITE_` 값은 프론트엔드에 공개되는 값이므로 Client Secret을 넣으면 안 됩니다.

```bash
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID VITE_BASE_PATH=/bdo-ship-materials/ npm run build
```

Google Cloud Console에서 이 앱의 배포 주소와 로컬 개발 주소를 OAuth **승인된 JavaScript 원본**에 등록해야 합니다. 이 앱은 Google Identity Services의 브라우저 OAuth 토큰 흐름만 쓰며 Client Secret을 사용하거나 저장하지 않습니다. 요청 권한은 `https://www.googleapis.com/auth/drive.appdata` 하나이며, 데이터는 사용자 Drive 파일 목록에 표시되지 않는 앱 전용 `appDataFolder/bdo-ship-materials.json`에 저장됩니다.

Drive 연결 후 변경 내용은 약 1.5초 뒤 자동 저장됩니다. 앱 시작 때 로컬과 Drive의 수정 시각이 다르면 더 최신 데이터를 권장하고, 어느 쪽으로 덮어쓸지 직접 선택할 수 있습니다. 네트워크 오류가 나도 LocalStorage 저장은 계속되며 다음 Drive 연결 때 재시도합니다.

## 데이터와 초기 재료

초기 샘플 장비와 재료는 [src/sampleData.ts](src/sampleData.ts)에 분리되어 있습니다. 여기의 이름·필요량·메모를 실제 목표 장비 기준으로 바꾸거나, 앱의 **데이터 관리** 화면에서 바로 편집할 수 있습니다.

진행 데이터는 해당 브라우저의 LocalStorage에 자동 저장됩니다. 기기 변경이나 브라우저 데이터 삭제 전에는 데이터 관리 화면의 **JSON 내보내기**로 백업하고, 다른 환경에서 **JSON 가져오기**로 복원하세요.
