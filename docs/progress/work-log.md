# 구현 기록

## 2026-07-29: 대시보드 내 차트 편집 drawer

- Dashboard placement에 안정적인 ID를 추가하고 기존 ID 없는 document를 결정론적인 legacy ID로 호환 로드하도록 했다.
- 대시보드 패널을 클릭하면 우측 drawer에서 pinned ChartAsset revision을 직접 편집하도록 구현했다. 작은 화면에서는 drawer가 전체 화면으로 전환된다.
- 기존 ChartEditor의 설정 UI를 재사용 가능한 `ChartSettingsPanel`로 분리해 차트 애셋 화면과 대시보드 drawer가 같은 ChartDocument 편집 규칙을 사용하게 했다.
- drawer에서 차트를 저장하면 새 immutable revision을 만들고 선택 placement의 pinned revision만 대시보드 draft에 반영한다. 대시보드 저장은 별도 작업으로 유지한다.
- placement ID 기준으로 패널 조회 상태, loading/error, 새로고침, 복제, 삭제, 최신 revision 갱신을 구현했다.
- dashboard contract와 사용 playbook을 갱신했다. Web Vitest와 production build를 통과했다.

## 2026-07-29: 지속 가능한 개발 작업 지침

- 루트 `AGENTS.md`에 저장소 지도, 문서 탐색 순서, 보안 원칙, 완료 기준을 추가했다.
- Go API(`internal`), Web(`apps/web`), 공개 계약(`contracts`) 경로에 범위별 `AGENTS.md`를 추가해 필요한 규칙만 읽을 수 있게 했다.
- `docs/engineering/development-workflow.md`에 작업 시작·완료 절차, 검증 기준, 영어 Conventional Commit 형식, 변경 유형별 최소 체크와 ADR 기준을 기록했다.
- 단순 변경은 제목만 사용하는 규칙과, 커밋 요청 시 메시지를 먼저 제시하고 명시적 승인 후에만 실행하는 절차를 추가했다.
- README에 개발 작업 흐름 문서 링크를 추가했다.

## 2026-07-29: 표 열 너비와 고정 표시

- 표 차트의 기본 표시를 고정 table layout으로 바꿔 긴 텍스트 열이 숫자 지표를 화면 밖으로 밀어내지 않게 했다.
- ChartDocument `spec.visualization.table`에 `layout`, `columnWidths`, `frozenColumns` 계약을 추가했다. 맞춤 모드는 상대 비율로 컨테이너 폭을 채우고, 고정 모드는 픽셀 너비와 가로 스크롤을 사용한다.
- 차트 설정 패널에서 열별 너비와 고정할 왼쪽 열 수를 편집할 수 있게 했으며, 같은 설정은 JSON 고급 편집에서도 수정할 수 있다.

## 2026-07-29: UI 기반 차트 편집기

- ChartAsset 편집 화면을 JSON 중심 3열 화면에서 미리보기와 우측 설정 패널 중심으로 재구성했다. JSON 직접 편집과 import/export는 `JSON 고급 편집`에 유지했다.
- `/api/v1/datasets`의 Dataset Manifest를 읽어 데이터셋, 차원, 지표, 필터, 정렬의 선택지를 만들었다. 화면 코드에 특정 데이터셋의 필드 목록을 하드코딩하지 않는다.
- 차원·지표를 chip 형태로 추가·삭제할 수 있게 했고, KPI의 단일 지표 제한, 막대의 누적 표시, 표의 페이지 크기, 값 형식을 설정할 수 있게 했다.
- QuerySpec 필터의 `eq`, `in`, `contains`, `between`, `isNull`을 UI에서 입력할 수 있게 했으며, 배열·boolean 값으로 정확히 변환한다. 필터가 미완성인 경우 미리보기와 저장을 막는다.
- `docs/playbooks/chart-editor.md`에 사용 흐름과 현재 범위를 기록하고, 차트 계약과 QuerySpec 문서에 UI-Manifest 연결 규칙을 반영했다.
- `go test ./...`, `npm --prefix apps/web test -- --run`, `npm --prefix apps/web run build`, `make compose-config`를 통과했다. Vite 빌드는 Monaco와 ECharts에 따른 500 kB 초과 chunk 경고를 남긴다.

## 2026-07-27: 초기 MVP 구현 진행

- 한국어 계획, 아키텍처, QuerySpec, dashboard contract, ADR, 로컬 개발, 후속 로드맵 문서 기준선을 만들었다.
- OpenAPI와 생성된 Chi 계약, Chart/Dashboard JSON Schema, `ads_daily` Dataset Manifest를 추가했다.
- Go API에 QuerySpec 검증, PostgreSQL table function compiler, 10개 동시 실행 제한, Redis 5분 캐시와 singleflight를 구현했다.
- Metadata migration, immutable revision, ETag 충돌, 복원, outbox와 Redis/SSE invalidation을 구현했다.
- React Web에 KPI/라인/막대/표, Monaco JSON 편집, import/export, revision 복원, 12열 dashboard, pinned revision, URL 공통 필터를 구현했다.
- 개발/운영형 Compose와 Nginx 단일 origin, health/readiness/degraded 상태를 구성했다.
- Go/Vitest/build/Compose 및 실제 PostgreSQL table function query와 revision API를 검증했다. 세부 결과는 `docs/reports/validation-2026-07-27.md`에 기록했다.

## 2026-07-27: 비밀정보 정리와 문서 경로 변경

- 예시 환경 파일에서 외부 DB 주소와 DSN 예시를 제거하고 모든 값이 비어 있도록 변경했다.
- Compose에서 metadata PostgreSQL 계정, 비밀번호, DSN의 고정 기본값을 제거하고 명시적인 환경변수를 요구하도록 변경했다.
- 이전 검증 컨테이너를 제거해 컨테이너 환경에 주입되었던 외부 DSN을 폐기했다. metadata 볼륨은 보존했다.
- 저장소와 Git 이력을 감사했으며, 추적된 외부 DB 주소·개인키·인증 파일은 발견되지 않았다.
- 한국어 문서 경로를 표준 `docs` 디렉터리로 변경하고 README와 내부 링크를 갱신했다.
- 비밀정보 취급 및 사고 대응 기준을 `docs/security/secret-management.md`에 기록했다.

## 2026-07-27: 서비스 포트 변경

- 다른 로컬 서비스와의 충돌을 줄이기 위해 운영형 Web 포트를 5740으로 변경했다.
- API의 기본·공개 포트를 5741로 변경했다.
- Compose, Nginx, Vite proxy, Dockerfile, load test와 관련 한국어 문서의 포트 참조를 함께 갱신했다.
- Web healthcheck는 컨테이너 내부의 IPv4 listener를 명시하도록 `127.0.0.1:5740`을 사용한다.

## 2026-07-27: 분석 데이터소스 명칭 일반화

- 특정 회사나 서비스에 종속된 명칭을 환경변수, Connector, 상태 API, UI와 문서에서 제거했다.
- 외부 PostgreSQL 연결 환경변수는 `ANALYTICS_DATABASE_URL`, Connector 식별자는 `analytics-postgres`로 통일했다.
- `/api/v1/system/status`는 분석 연결 상태를 `analyticsDatasource`로 제공하며 OpenAPI 응답 계약과 테스트를 추가했다.
- 광고 스타터 데이터셋과 `analytics.adreport_daily` table function 계약은 브랜드 중립적인 예제로 유지했다.
- Go 및 Vitest 테스트, Go·Vite build, OpenAPI 재생성, 운영형·개발형 Compose 설정 검증을 통과했다.
- 새 환경변수로 스택을 재빌드했으며 Web 5740, API 5741, 전체 healthcheck와 실제 `ads_daily` query 응답을 확인했다.
