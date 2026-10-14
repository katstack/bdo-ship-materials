# 제작 노트 데이터 파이프라인

## 목적

게임 클라이언트의 정적 데이터를 출발점으로 하여, 함선 관리 앱과 독립된 제작 노트 카탈로그가 같은 아이템 ID를 참조하게 한다. 게임 설치 폴더는 읽기 전용으로 취급하며, 원본 추출물과 웹 배포용 데이터는 섞지 않는다.

## 실행 흐름

한국판과 NA/EU판을 결합하는 현재 자동 실행법은 [한국어 제작노트 자동 추출](CRAFTING_NOTES_EXTRACTION.md)을 참고한다. `scripts/extract-crafting-notes.cmd` 한 번으로 두 스냅샷과 결합 카탈로그를 만든다.

1. Windows에서 `scripts\\extract-bdo-client.cmd`를 더블클릭한다.
2. 스크립트가 `bdo-data-extractor`로 클라이언트의 아이템, 제작식, 의뢰, NPC, 월드 데이터를 읽는다.
3. 원본 JSON은 `%LOCALAPPDATA%\\bdo-ship-materials\\extracted\\<실행시각>`에 날짜별 스냅샷으로 저장한다.
4. 다음 단계의 정규화 스크립트가 해당 스냅샷만 입력으로 받아, 웹에서 필요한 필드만 가진 카탈로그 JSON을 생성한다.

원본은 재현·검증용이고 GitHub Pages에 그대로 올리지 않는다. 웹 앱에는 정규화된 결과와 필요한 아이콘만 배포한다.

## 원본에서 확인할 필드

영문 LOC 형식을 지원하는 클라이언트에서 `bdo-data-extractor`가 만드는 전체 출력 기준으로 제작 노트에 필요한 주 데이터는 다음과 같다.

- `items.json`: `id`, 이름·설명, 아이콘 경로, NPC 판매처, 채집처/노드, 강화 정보
- `recipes.json`: 결과 아이템 ID, 제작 유형, 공방/작업장, 재료 아이템 ID와 수량
- `npcs.json`, `world.json`: NPC와 노드·지역 연결 정보
- `quests.json`: 의뢰 ID, 이름, 선행·완료 조건 원문

실시간 거래소 가격, 실제 제작 대성공 수량·확률처럼 서버가 결정하는 값은 클라이언트 원본만으로 확정하지 않는다.

### 한국 클라이언트의 현재 원시 출력

한국 설치본은 별도 LOC와 아이템별 제작 XML이 없어 전체 카탈로그 모드가 동작하지 않는다. 아이템 표시명은 `itemenchant.dbss` 인라인 UTF-16 문자열에서 추출된다. `Auto`/`Raw` 모드는 다음을 만든다.

- `paz-index/paz_files.json`: 클라이언트 아카이브 파일 목록
- `raw/gamecommondata/binary/itemenchant.dbss`: 아이템 ID·정적 스탯 원본
- `raw/gamecommondata/binary/manufacture.bss`: 가공 원본
- `data/manufacture.raw.json`: `manufacture.bss`에서 디코딩한 `{group,type,success,inputs:[{item,count}]}`
- `data/item-names.ko.json`: 한국어 아이템 이름을 ID로 연결한 맵

`group`은 서버가 결과물로 해석하는 드롭 그룹이라, 이것만으로 결과 아이템을 확정해 재귀 제작 트리를 만들면 안 된다. 후속 병합기는 이름·결과물을 가진 별도 버전 카탈로그를 명시적으로 입력받아야 한다.

## 정규화 결과 설계

`scripts/normalize-kr-crafting-notes.mjs`는 한국 클라이언트의 원시 가공식과, 같은 버전의 전체 카탈로그를 아래처럼 조인한다.

```powershell
node .\\scripts\\normalize-kr-crafting-notes.mjs `
  --snapshot "$env:LOCALAPPDATA\\bdo-ship-materials\\extracted\\<실행시각>" `
  --catalog "D:\\BDO-Catalog\\data" `
  --output .\\public\\data\\crafting-notes.json
```

원시 `manufacture.bss`는 입력 ID·수량·가공 유형은 가지지만 결과물은 서버 드롭 그룹이다. 따라서 변환기는 전체 카탈로그의 가공식과 **가공 유형 + 입력 ID/수량 서명**으로 조인하고, `matched`·`ambiguous`·`unmatched` 상태를 남긴다. 일치하지 않는 레코드를 추측으로 결과물에 연결하지 않는다.

전체 제작 노트 앱의 아이템 레코드는 최소한 다음을 보존한다.

```ts
{
  id: string,
  name: string,
  description?: string,
  icon?: string,
  recipes: [{ type: string, station?: string, inputs: [{ itemId: string, count?: number }] }],
  acquisition: { vendorNpcIds: string[], gatheredFrom: string[], nodeIds: string[] }
}
```

모든 연결은 이름이 아니라 게임 아이템·NPC·노드 ID로 유지한다. 따라서 화면 URL도 `#/crafting-notes/item/<id>`처럼 안정적으로 만들 수 있다.

## 구현 순서

1. 실제 스냅샷의 JSON 모양과 한국어 로컬라이즈 가능 범위를 검증한다. 완료: 한국 설치본에는 별도 게임 LOC·아이템별 제작 XML이 없지만 인라인 한국어 아이템명 71,344개를 추출했다.
2. 입력 ID·수량·가공 유형 기반 `manufacture.raw.json`을 생성한다. 완료: 현재 설치본에서 7,077개를 디코딩했다.
3. 전체 카탈로그와의 서명 조인 정규화기를 실행한다. 완료: 글로벌 XML 제작식 13,316개, 한국어 이름 연결 70,231개, 한국 제조식 단일 결과 일치 2,022개. 복수 후보 207개와 미일치 4,848개는 추가 분석 대상이다. 한국과 글로벌 패치가 동일하다고 가정하지 않는다.
4. 제작 노트 전용 화면에서 검색, 아이템 상세, 재료 트리, NPC/노드 출처를 읽기 전용으로 표시한다.
5. 데이터의 버전·추출 시각을 앱에 표시해 게임 패치 이후 재생성 여부를 판단하게 한다.
