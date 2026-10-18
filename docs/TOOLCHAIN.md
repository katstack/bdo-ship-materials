# 개발 도구 버전

## 고정 원칙

- WSL Ubuntu-26.04에서 Node는 루트 `.nvmrc`, pnpm은 양쪽 `package.json`의 `packageManager`를 따릅니다.
- 프론트와 인증 Worker는 pnpm 12.14.0으로 통일합니다. 각 프로젝트의 lockfile은 별도로 유지합니다.
- 직접 의존성은 검증한 정확한 버전으로 고정합니다. `latest`나 `beta` 태그가 설치 시점에 다른 버전으로 바뀌지 않게 합니다.
- Vite와 React Vite 플러그인은 개발 의존성입니다. 사용자 브라우저에서 실행되는 React와 압축 해제 라이브러리는 실행 의존성입니다.
- Cloudflare 도구는 현재 검증된 베타 버전으로 고정했으며 안정판이라는 의미는 아닙니다.

## TypeScript 7 전환 제약

2026-10-19 확인 기준 Worker는 TypeScript 7.0.2를 사용합니다. 프론트는 TypeScript 6.0.3을 유지합니다.

프론트에서 사용하는 `typescript-eslint` 8.70.1과 조회 당시 최신 8.71.2의 TypeScript peer 범위는 모두 `>=4.8.4 <6.1.0`입니다. TypeScript 7을 강제로 설치하거나 peer 검사를 끄지 않습니다. 지원 도구가 준비되면 프론트 타입 검사·ESLint·단위 테스트·브라우저 테스트를 함께 통과한 뒤 전환합니다.

확인 명령:

```bash
pnpm view typescript-eslint@latest version peerDependencies --json
```

## 재현 검증

저장소 루트에서:

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Worker에서:

```bash
cd worker
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

버전 변경 시 manifest와 lockfile을 함께 갱신하고 두 프로젝트 모두 검사합니다. 이 작업만으로 운영 Worker를 재배포하거나 DB 스키마를 변경하지 않습니다.
