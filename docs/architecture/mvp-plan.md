# 광고 대시보드 MVP 계획

## 목표

첫 vertical slice는 `analytics.adreport_daily(start_date, end_date)`를 Dataset Manifest와 QuerySpec으로 조회하고, 공유 가능한 차트 애셋과 단일 페이지 대시보드로 저장하는 것이다. UI 편집기와 JSON 편집기는 동일한 versioned document를 사용한다.

## 확정 범위

- Go + Chi API, React + TypeScript + Vite Web
- Flooks metadata PostgreSQL, Redis 캐시·이벤트, 외부 분석 PostgreSQL
- KPI, 라인, 막대, 표
- 차트/대시보드 immutable revision, ETag 충돌, 복원
- 12열 대시보드 배치와 pinned chart revision
- 신뢰된 사내망의 anonymous editor
- 개발용 및 운영형 Docker Compose

## 제외 범위

로그인과 ACL, raw SQL, AI, BigQuery 실제 구현, 데이터소스 관리 UI, 다중 페이지, CRDT, 런타임 플러그인, Helm은 MVP 이후로 둔다.

## 완료 기준

Compose clean start, 실제/fixture PostgreSQL 질의, UI와 JSON의 왕복 편집, 두 브라우저의 SSE 갱신, revision 충돌·복원, 한국어 문서와 코드의 일치를 완료 조건으로 삼는다.
