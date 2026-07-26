# Flooks

Flooks는 JSON과 UI가 같은 문서를 편집하는 오픈소스 대시보드 플랫폼입니다. 현재 MVP는 외부 분석 PostgreSQL의 `analytics.adreport_daily(date, date)`를 안전한 QuerySpec으로 조회해 KPI, 라인, 막대, 표로 표현합니다.

## 빠른 시작

1. `.env.example`을 `.env`로 복사하고 비어 있는 환경변수를 로컬에서 설정합니다. 실제 연결 정보는 저장소에 기록하지 않습니다.
2. `docker compose -f deploy/compose/compose.yml up --build`를 실행합니다.
3. <http://localhost:5740>을 엽니다.

개발 환경은 `docker compose -f deploy/compose/compose.yml -f deploy/compose/compose.dev.yml up --build`로 실행합니다.

## 한국어 문서

- [MVP 계획](docs/architecture/mvp-plan.md)
- [아키텍처 개요](docs/architecture/overview.md)
- [QuerySpec과 Connector](docs/architecture/query-and-connectors.md)
- [대시보드 계약](docs/architecture/dashboard-contract.md)
- [비밀정보 관리](docs/security/secret-management.md)
- [로컬 개발](docs/playbooks/local-development.md)
- [구현 기록](docs/progress/work-log.md)
- [검증 보고서](docs/reports/validation-2026-07-27.md)
- [MVP 이후 로드맵](docs/roadmap/post-mvp.md)

## 검증

```bash
make test
make build
make compose-config
```
