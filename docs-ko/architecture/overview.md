# Architecture Overview

이 문서는 FLooks의 구조를 짧게 요약한다. 기술 선택 이유, 대안 비교, 현재 구조와 향후 계획을 포함한 전체 설명은 `docs-ko/architecture/platform-dossier.md`를 기준 문서로 사용한다.

## Product frame

FLooks는 Linkmerce 기반 분석 데이터를 안전하게 소비하고, 권한이 적용된 대시보드 편집과 AI 보조 기능을 제공하는 내부용 엔터프라이즈 대시보드 플랫폼이다.

핵심 제품 원칙은 다음과 같다.

1. 데이터 접근 통제는 UI가 아니라 서버 정책으로 강제한다.
2. 대시보드 편집과 코드 기반 편집은 같은 문서 모델을 공유한다.
3. 패널과 AI는 동일한 governed query 계약 위에 올라간다.
4. 현재 단계의 운영 모델은 Compose-first이며, Helm-ready 경계를 유지한다.

## Runtime layers

### Web

- 인증 뒤 대시보드 조회, 편집, 관리, AI 상호작용을 담당한다.
- API를 통해서만 데이터와 메타데이터에 접근한다.
- dashboard document를 읽고, 동일한 문서를 UI와 code mode 양쪽에서 수정한다.

### API

- identity, permissions, data catalog, dashboard persistence, discussions, AI orchestration을 담당한다.
- Dataset manifest와 QuerySpec을 사용해 governed query를 실행한다.
- dashboard, panel, AI tool, request workflow에 대한 audit boundary를 가진다.

### Shared contract packages

- `packages/dashboard-schema`는 versioned dashboard document의 기준 계약이다.
- 이후 `panel-sdk`, `query-spec`, `ui` 패키지가 추가될 수 있다.

### Delivery layer

- `deploy/compose`는 현재 로컬 및 초기 운영 진입점이다.
- 이후 `deploy/helm`은 배포 표준화 목적의 skeleton으로 추가된다.

## Current state vs next state

현재 저장소는 아직 skeleton 단계지만, 이제 라이브 bootstrap slice, identity baseline slice, metadata persistence baseline이 들어가 있다. 웹 셸은 FastAPI의 `/api/v1/system` 과 `/api/v1/overview` 를 읽어서 현재 런타임 상태와 다음 구현 순서를 코드 열람 없이 바로 보여주고, API는 초기 auth 및 storage 계약을 위해 `/api/v1/identity/bootstrap` 과 `/api/v1/metadata/bootstrap` 을 노출한다.

이미 맞게 잡힌 축은 모노레포, React shell, FastAPI skeleton, identity 및 metadata bootstrap surface, dashboard schema package, Compose 구조다.

다음 구현 파동에서 바로 추가될 축은 아래와 같다.

1. Dataset manifest loader와 QuerySpec executor
2. 새 metadata table 위의 Dashboard CRUD, versioning, panel runtime
3. 전체 앱 셸을 위한 React Router, TanStack Query, TanStack Table, Apache ECharts
4. backend import, typing, module 규칙을 위한 `ruff` 기반 정적 체크

## Near-term execution plan

1. Delivered: `feat(backend)` 범위로 identity 및 permissions skeleton을 추가했고, `/api/v1/identity/bootstrap` 계약에 이메일 로그인 정책, 승인 단계, permission evaluation rule을 담았다.
2. Delivered: `feat(backend)` 범위로 metadata persistence를 추가했고, SQLAlchemy 설정, Alembic baseline, `/api/v1/metadata/bootstrap` 계약에 첫 dashboard 및 access-control table 기준을 담았다.
3. Next: `feat(backend)` 범위로 governed query bootstrap을 추가하고, dataset manifest loading, QuerySpec validation, 첫 Linkmerce connector stub을 만든다.
4. Phase 4: `feat(backend)` 범위로 새 relational schema 위의 dashboard CRUD 및 versioned document persistence를 만든다.
5. Phase 5: `feat(frontend)` 범위로 application shell을 확장하고, 라우팅, API client 구조, 인증 뒤 navigation surface를 만든다.
6. Phase 6: `feat(frontend)` 범위로 dashboard runtime basics를 추가하고, live API 응답을 쓰는 first-party table 및 scorecard panel을 만든다.
7. Phase 7: `chore(infra)` 범위로 delivery hardening을 진행하고, Compose health check, developer entrypoint, CI-ready validation 명령, `ruff` 기반 정적 체크를 정리한다.
