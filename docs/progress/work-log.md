# 구현 기록

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
