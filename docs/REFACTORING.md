# 구조와 검증 경계

## 현재 구성

| 영역                 | 책임                                                         | 주요 위치                                                     |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 선박 화면 조합       | 선택된 화면과 사용자 이벤트 연결                             | `src/ShipWorkspace.tsx`                                       |
| 로컬 저장            | 변경 시각 기록, 저장 오류 안내, 원격 데이터의 수정 시각 보존 | `src/ship/useFleetData.ts`                                    |
| 제작 완료 UI         | 제작/구매 확인과 취소, 도메인 명령 호출                      | `src/ship/useCraftCompletion.ts`                              |
| 수요·제작 규칙       | 완료된 장비 제외, 요구량 차감과 0 하한, 복구                 | `src/domain/`                                                 |
| 물교 선택자          | 교환 가치·부족량과 정렬, 입력 불변성                         | `src/ship/materialRows.ts`                                    |
| 수급 계획과 대화상자 | 표시 및 콜백 전달                                            | `src/features/SupplyPlanPage.tsx`, `src/ship/ShipDialogs.tsx` |
| 동기화 공통 계약     | 화면에서 사용하는 상태와 명령                                | `src/sync/types.ts`                                           |
| 동기화 판단          | 신규 브라우저 복원, 같은 수정본, 충돌                        | `src/sync/policy.ts`                                          |
| Drive 저장소         | appData 파일 접근, HTTP 상태·응답 검증                       | `src/sync/driveFiles.ts`                                      |
| 인증 어댑터          | 서버 방식과 기존 GIS 방식의 빌드 시 선택                     | `src/useDriveSync.ts`                                         |
| 서버 방식 동기화     | 재시도, 업로드 순서, 연결 해제 시 오래된 작업 무효화         | `src/useServerDriveSync.ts`, `src/sync/serialQueue.ts`        |
| Worker 라우터        | 경로·메서드 분기와 보안 응답 헤더                            | `worker/src/index.ts`                                         |
| OAuth·세션·갱신      | 각 인증 수명주기 처리                                        | `worker/src/auth/oauth.ts`, `sessions.ts`, `tokens.ts`        |
| DB·암호화            | 파라미터 쿼리와 레코드별 인증 암호화                         | `worker/src/db.ts`, `security.ts`                             |
| 만료 정리            | 인증 시작 시 만료된 state·세션·요청 제한만 정리              | `worker/src/auth/maintenance.ts`                              |

도메인 규칙은 React나 UI 타입을 참조하지 않습니다. 기존 저장 형식과 DB 스키마를 유지하므로 이번 분리만을 위한 마이그레이션은 없습니다. 기존 제작 시뮬레이터 변경은 별도 작업이며 이 리팩토링의 일괄 커밋 대상이 아닙니다.

## 검증 하네스

두 프로젝트에 고정 설치한 뒤 루트에서 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm --dir worker install --frozen-lockfile
pnpm check
VITE_AUTH_API_URL=http://localhost:8787 pnpm check:e2e
```

`check`는 포맷, 양쪽 타입, 프론트·Worker·스크립트·E2E 코드의 ESLint, 카탈로그 검증, 단위 테스트, 양쪽 빌드를 검사합니다. `check:e2e`는 현재 환경변수로 프론트를 빌드한 뒤 브라우저 테스트를 실행합니다. 서버 인증 E2E는 API 주소를 빌드와 테스트 모두에 지정해야 활성화되며 실제 Google 동의는 테스트에서 요청하지 않습니다.

CI는 Worker를 별도 작업에서 검증합니다. 프론트 작업의 타입 검사는 루트 `tsc -b`이며 별도 작업의 node_modules를 공유한다고 가정하지 않습니다. Playwright 실패 시에만 trace와 스크린샷을 보관하며 CI artifact 보존 기간은 7일입니다. trace에 테스트 데이터가 포함될 수 있으므로 실제 사용자 토큰이나 운영 계정으로 테스트하지 않습니다.

## 배포와 비밀값

코드 분리만으로 세션 쿠키·암호화 키·OAuth 콜백·Drive 파일 이름·DB 스키마를 변경하지 않습니다. 운영 Worker 갱신 시 기존 저장소 밖 secrets 파일의 키를 유지해야 합니다. 비밀값은 진단 artifact에 넣지 않습니다. 자세한 운영 절차는 `AUTH_WORKER.md`, 버전 선택은 `TOOLCHAIN.md`를 참고합니다.

네트워크 단절 시 로컬 저장을 유지합니다. 충돌 선택 전에는 원격 파일을 덮어쓰지 않고, 대기 중인 저장은 순서대로 처리합니다. 연결 해제 직전에 이미 Google에 전송된 요청까지 취소된다고 보장하지는 않으며, 연결 해제 이후 오래된 작업이 UI 상태를 되살리지 않도록 세대 번호로 차단합니다.
