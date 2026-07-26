# 2026-07-27 MVP 검증 보고서

## 실행 환경

- Go 1.26.3, Node 25.2.1, Docker Compose 5.1.4
- Metadata PostgreSQL 17, Redis 8.2
- 실제 PostgreSQL table function `analytics.adreport_daily(date, date)`

## 확인 결과

- Go 전체 패키지 test와 PostgreSQL compiler/QuerySpec unit test 통과
- Vitest 통과, TypeScript 및 Vite production build 통과
- 개발/운영형 Compose config 검증 통과
- Metadata migration, API/Web 이미지 build, healthcheck 통과
- `/api/v1/system/status`에서 metadata, Redis, 분석 데이터소스 모두 `ok`
- 2026-07-01~25 플랫폼 집계: 5행, cold 138ms
- 동일 QuerySpec 재실행에서 `cached: true` 확인
- ChartAsset 생성, revision 2 저장, stale ETag의 HTTP 412, revision 이력 확인
- Nginx 5740 단일 origin에서 Web과 `/api` 응답 확인
- 50개 동시 SSE 연결과 최대 10개 동시 cached query: 실패 0건, p95 166.7ms
- npm audit 결과 0건. Monaco 전이 의존성 DOMPurify는 3.4.12로 고정했다.

## 남은 품질 작업

- Monaco/ECharts가 포함된 초기 JavaScript bundle은 약 1.52MB다. 기능별 lazy loading과 vendor chunk 분리는 MVP 이후 첫 성능 작업으로 둔다.
- 실제 브라우저 Playwright 시각 회귀와 장시간 Redis 장애 복구 시험은 후속 검증으로 남긴다.
