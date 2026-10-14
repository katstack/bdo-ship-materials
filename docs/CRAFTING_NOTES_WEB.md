# 제작노트 웹 데이터

전체 아이템 속성과 원본 제작식을 보존하고, 웹 첫 진입에는 검색 인덱스만 내려받는다. 아이템 상세·재료 트리는 해당 아이템의 청크만 요청한다.

## 생성

Node.js 24 LTS 이상에서, 한국/글로벌 결합 카탈로그를 생성한 후:

```sh
pnpm crafting:chunks --catalog /path/to/catalog --output public/crafting
pnpm crafting:verify
pnpm build
```

`--catalog`는 `items.ko.json`, `recipes.json`, 선택적으로 `report.json`을 포함하는 디렉터리다. Windows에서도 Node.js 24 이상으로 같은 명령을 실행할 수 있다. Windows 추출에서 `extract-crafting-notes.ps1 -WebOutputDir <public/crafting 경로> -NodeExe <Node24 실행 파일>`을 지정하면 결합 직후 청크를 생성한다.

## 배포 구조

- `manifest.json`: 버전, 데이터 추출 시각, 청크 파일명·SHA-256·압축/해제 크기
- `index-<hash>.json.zst`: ID·표시명·영문명·분류·청크 위치만 담은 검색 인덱스
- `items-<number>-<hash>.json.zst`: 원본 아이템 전체 속성, 원본 제작식, 사용처 아이템 ID

기본 청크 크기는 압축 전 약 1MiB다. 단일 아이템의 속성이 그보다 크면 해당 항목은 하나의 더 큰 청크에 들어간다. 파일별 독립 zstd 프레임이므로 원하는 파일만 받을 수 있다. 압축 레벨은 9이며 브라우저의 `fzstd` 디코더로 전 산출물 해제 및 인덱스 연결을 검증한다.

이미 받은 파일은 Cache API에 저장한다. 파일명은 콘텐츠 해시를 포함하므로 데이터 갱신 후 새 청크와 충돌하지 않는다. 최신 manifest는 재진입 때 재검증하고, 디코딩한 상세 청크는 메모리에 최대 8개 유지한다. 디스크 캐시를 쓸 수 없는 브라우저에서는 네트워크와 메모리 캐시로 계속 동작한다. 압축 해제와 JSON 파싱은 Web Worker에서 실행한다.

GitHub Pages에서는 `.zst`를 일반 정적 파일로 내려받아 앱에서 해제한다. 커스텀 Content-Encoding 헤더가 필요 없다. `#/crafting/item/<아이템 ID>` 링크는 새로고침해도 아이템 선택을 복원한다.

추출기 서브모듈은 웹 빌드에 필요하지 않다. GitHub Actions는 이미 생성되어 커밋된 `public/crafting` 파일을 그대로 배포한다. 게임 클라이언트 설치본·원시 추출물은 Pages 산출물에 포함하지 않는다.

한국어 이름이 없는 일부 항목은 영문명을 표시한다. 설명·공방명 등은 원본 영어다. 재료 트리의 수량은 각 제작식 1회 입력량이며, 생산량을 추정해 원재료 총량으로 곱하지 않는다. 글로벌 XML과 한국 제조식의 검증 범위는 [추출 문서](CRAFTING_NOTES_EXTRACTION.md)를 참고한다.
