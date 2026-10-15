# 가모스 숙련도 표 스냅샷

## 저장 범위

2026-10-15 확인한 공개 표 8개, 숙련도 구간 총 503개. 요리·연금·채집·낚시·수렵·조련·항해는 각각 61개, 가공은 76개다. 모든 열을 보존한다. 요리 황실 납품 보너스처럼 현재 제작 계산에서 쓰지 않는 열도 삭제하지 않는다.

- `data/sources/garmoth-mastery.snapshot.json`: 출처 URL, 확인 시각, 표 머리글, 원문 숫자 문자열. 사이트 설명문·이미지·레이아웃은 복제하지 않는다.
- `src/data/garmothMastery.json`: 분야·열 키·표시 단위가 있는 정규화 데이터. 원본 SHA-256, 비교 결과, 미확인 사항 포함.
- `scripts/build-garmoth-mastery.mjs`: 스냅샷 검증과 JSON 생성. 네트워크 수집을 가장하는 스크립트가 아니다.

```sh
pnpm mastery:garmoth
pnpm test
```

`pnpm mastery:fetch`는 기존 Codex/공식 수집기이며 별개다. 가모스에 대한 일반 HTTP 요청은 접근 거부 페이지를 반환했다. 이번 스냅샷은 웹 탐색에서 읽을 수 있는 공개 표 텍스트를 구조적으로 수집했다. 접근 제한을 우회하지 않았다. 갱신하려면 접근 가능한 공개 페이지에서 원본 스냅샷을 갱신한 뒤 위 명령을 실행한다. 불완전한 표는 생성 단계에서 거부한다.

## 단위와 의미

`34.11`은 **34.11%**다. 확률 계산에 쓸 경우 의미를 먼저 확인하고 100으로 나눈다. 증가율은 100%를 초과할 수 있으므로 0~100 제한을 적용하지 않는다. `materialCount`, `prizeHarpoonLevel`은 정수 단위다.

가모스 영문 열 이름은 `sourceLabel`로 보존한다. `By Product Amount Increase` 등의 명칭을 임의로 한국 게임의 특정 확률과 동일시하지 않는다. 숙련도 표 자체는 레시피별 기본 생산량·요구 생활 등급·출력 분포가 아니므로 이 자료 추가만으로 제작식별 생산 규칙이 완성되지는 않는다.

채집 `?extra=1`의 표시 증분은 `displayDeltas`에 별도로 저장한다. 증분 없는 셀은 `null`이다. 다른 분야의 Extra URL은 탐색 도구에서 가져오지 못했으므로 추가 데이터가 있다고 추정해서 채우지 않았다.

가공 첫 구간은 가모스에 표시된 `2`를 보존했다. 기존 공식 표의 `0`으로 조용히 교정하지 않는다. 기존 계산에 사용 중인 `masteryTables.json`도 덮어쓰지 않는다. 공통 구간 기준 요리 244개 셀·연금 61개 셀·가공 75개 셀이 기존 자료와 일치했다.

## 가모스는 어디서 확인했는가?

**가모스 페이지에는 해당 표의 원출처나 수집 방법이 명시되어 있지 않다.** 따라서 Codex 복사·공식 수기 입력·클라이언트 추출 중 무엇인지 단정할 수 없다. 데이터에도 `upstreamSource: null`로 저장한다.

숫자를 직접 확인할 수 있는 경로는 별개로 존재한다.

1. [공식 2025-01-08 업데이트](https://www.kr.playblackdesert.com/ko-KR/News/Detail?groupContentNo=13398)는 숙련도 확장과 효과 표를 제공한다.
2. [공식 요리 가이드](https://www.kr.playblackdesert.com/ko-kr/Wiki?wikiNo=102)는 요리 숙련도의 최대 수량·상위 요리·대량 요리 효과를 설명한다.
3. 현재 저장소의 `tools/bdo-data-extractor/internal/build/mastery.go`와 `internal/tables/mastery.go`에는 `cookingstatdata.bss`, `alchemystatdata.bss`, `manufacturingstat.bss`를 읽는 구현이 있다. 클라이언트에 숙련도 곡선 데이터가 존재한다는 구현 근거이며, 가모스가 그 구현을 사용했다는 근거는 아니다. 연금 일부 열 의미는 추출기 자체도 미확정이라고 기록한다.

원문 표:

- [요리](https://garmoth.com/mastery-brackets/cooking)
- [연금](https://garmoth.com/mastery-brackets/alchemy)
- [채집](https://garmoth.com/mastery-brackets/gathering), [증분 표시](https://garmoth.com/mastery-brackets/gathering?extra=1)
- [낚시](https://garmoth.com/mastery-brackets/fishing)
- [수렵](https://garmoth.com/mastery-brackets/hunting)
- [조련](https://garmoth.com/mastery-brackets/training)
- [항해](https://garmoth.com/mastery-brackets/sailing)
- [가공](https://garmoth.com/mastery-brackets/processing)
