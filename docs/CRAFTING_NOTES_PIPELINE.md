# 제작 노트 데이터 파이프라인

## 목적

게임 클라이언트의 정적 데이터를 출발점으로 하여, 함선 관리 앱과 독립된 제작 노트 카탈로그가 같은 아이템 ID를 참조하게 한다. 게임 설치 폴더는 읽기 전용으로 취급하며, 원본 추출물과 웹 배포용 데이터는 섞지 않는다.

## 실행 흐름

1. Windows에서 `scripts\\extract-bdo-client.cmd`를 더블클릭한다.
2. 스크립트가 `bdo-data-extractor`로 클라이언트의 아이템, 제작식, 의뢰, NPC, 월드 데이터를 읽는다.
3. 원본 JSON은 `%LOCALAPPDATA%\\bdo-ship-materials\\extracted\\<실행시각>\\data`에 날짜별 스냅샷으로 저장한다.
4. 다음 단계의 정규화 스크립트가 해당 스냅샷만 입력으로 받아, 웹에서 필요한 필드만 가진 카탈로그 JSON을 생성한다.

원본은 재현·검증용이고 GitHub Pages에 그대로 올리지 않는다. 웹 앱에는 정규화된 결과와 필요한 아이콘만 배포한다.

## 원본에서 확인할 필드

`bdo-data-extractor`의 현재 출력 기준으로 제작 노트에 필요한 주 데이터는 다음과 같다.

- `items.json`: `id`, 이름·설명, 아이콘 경로, NPC 판매처, 채집처/노드, 강화 정보
- `recipes.json`: 결과 아이템 ID, 제작 유형, 공방/작업장, 재료 아이템 ID와 수량
- `npcs.json`, `world.json`: NPC와 노드·지역 연결 정보
- `quests.json`: 의뢰 ID, 이름, 선행·완료 조건 원문

실시간 거래소 가격, 실제 제작 대성공 수량·확률처럼 서버가 결정하는 값은 클라이언트 원본만으로 확정하지 않는다.

## 정규화 결과 설계

`scripts/normalize-crafting-notes.mjs`는 나중에 아래처럼 실행한다.

```powershell
node .\\scripts\\normalize-crafting-notes.mjs `
  --input "$env:LOCALAPPDATA\\bdo-ship-materials\\extracted\\<실행시각>\\data" `
  --output .\\public\\data\\crafting-notes.json
```

결과의 각 아이템은 최소한 다음을 보존한다.

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

1. 실제 스냅샷의 JSON 모양과 한국어 로컬라이즈 가능 범위를 검증한다.
2. 입력 검증·중복 제거·ID 참조 검증을 포함한 정규화기를 작성한다.
3. 작은 샘플 스냅샷으로 단위 테스트를 추가한다.
4. 제작 노트 전용 화면에서 검색, 아이템 상세, 재료 트리, NPC/노드 출처를 읽기 전용으로 표시한다.
5. 데이터의 버전·추출 시각을 앱에 표시해 게임 패치 이후 재생성 여부를 판단하게 한다.
