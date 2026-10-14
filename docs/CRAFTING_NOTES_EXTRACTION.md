# 한국어 제작노트 자동 추출

Windows에서 `scripts/extract-crafting-notes.cmd`를 실행합니다. 게임 폴더는 읽기 전용이며 생성 파일은 `%LOCALAPPDATA%\bdo-ship-materials\crafting-notes`에 저장합니다. Git과 Node.js가 필요하며 Go는 공식 배포본을 해시 검증하여 사용자 도구 폴더에 준비합니다.

처음 저장소를 받았을 때:

```sh
git submodule update --init --recursive
```

기본 게임 경로:

- 한국판: `C:\Pearlabyss\BlackDesert`
- NA/EU: `C:\Pearlabyss\BlackDesert_NAEU\BlackDesert`

경로를 바꾸려면 PowerShell에서:

```powershell
.\scripts\extract-crafting-notes.ps1 -KoreanGameDir 'D:\Games\KR' -GlobalGameDir 'D:\Games\NAEU'
```

## 도구 소스

`tools/bdo-data-extractor`는 공개 upstream 저장소의 Git 서브모듈입니다. 현재 고정 커밋은 `228196ed5fe3b0903f1410bf60ea3136f0de67c8`이며 최신 글로벌 클라이언트 3464의 버프·경험치 테이블 변경을 다루는 upstream PR #6의 수정입니다. 자동 실행 중 임의로 latest를 가져오지 않습니다. 버전 변경은 서브모듈 커밋을 검증한 후 부모 저장소에 커밋합니다.

Windows Go 빌드를 위해 서브모듈 소스를 LocalAppData의 독립 디렉터리에 복사합니다. 한국어 이름·제조식 probe는 이 복사본 안에서 빌드하므로 서브모듈에는 변경이 생기지 않습니다.

## 산출물

한 실행 디렉터리 안에 `korean`, `global`, `catalog`가 만들어집니다.

- `catalog/items.ko.json`: 글로벌 아이템 속성 + 한국판 ID 기반 한국어 이름. 원래 이름은 `nameEn`, 실제 표시 언어는 `nameLocale`로 보존합니다.
- `catalog/recipes.json`: 글로벌 XML 전체 제작식. 결과와 재료를 공통 아이템 ID로 연결하여 원재료 트리를 구성할 수 있습니다.
- `catalog/manufacture.ko.json`: 한국판 제조식과 글로벌 XML을 제작 방식·재료 ID·수량으로 대조한 결과. `matched`, `ambiguous`, `unmatched`로 구분하며 모호한 결과물을 추측하지 않습니다.
- `catalog/report.json`: 이름 커버리지, 영어 대체 항목 수, 제조식 검증 통계 및 입력 경로.

아이템 설명·공방명 등은 영어가 유지됩니다. 한국어 이름이 없거나 글로벌판과 패치가 다른 아이템도 있을 수 있으므로 전체 텍스트가 완전히 한국어로 번역된 데이터는 아닙니다. 글로벌 XML 제작식 전체와 한국 제조식의 검증 범위는 서로 다릅니다.

이 산출물은 별도 제작노트 앱의 입력 데이터이며 현재 함선 앱에 자동으로 덮어쓰지 않습니다.
