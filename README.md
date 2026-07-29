# Flooks

Flooks는 JSON과 UI가 같은 문서를 편집하는 오픈소스 대시보드 플랫폼입니다. 현재 MVP는 외부 분석 PostgreSQL의 `analytics.adreport_daily(date, date)`를 안전한 QuerySpec으로 조회해 KPI, 라인, 막대, 표로 표현합니다.

## 빠른 시작

1. 저장소 루트에서 `.env.example`을 `.env`로 복사하고 로컬 연결 정보를 설정합니다. 실제 연결 정보는 저장소에 기록하지 않습니다.
2. 운영형 Compose를 시작합니다.
3. <http://localhost:5740>을 엽니다.

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml up --build -d
```

개발 환경은 다음 명령으로 실행합니다.

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.dev.yml up --build
```

## 종료

데이터를 보존한 채 Flooks 컨테이너와 네트워크만 종료하려면 다음 명령을 실행합니다.

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml down
```

`down -v`는 metadata 데이터 볼륨까지 삭제하므로 사용하지 않습니다.

## 한국어 문서

- [MVP 계획](docs/architecture/mvp-plan.md)
- [아키텍처 개요](docs/architecture/overview.md)
- [QuerySpec과 Connector](docs/architecture/query-and-connectors.md)
- [대시보드 계약](docs/architecture/dashboard-contract.md)
- [비밀정보 관리](docs/security/secret-management.md)
- [로컬 개발](docs/playbooks/local-development.md)
- [차트 편집기 사용법](docs/playbooks/chart-editor.md)
- [개발 작업 흐름과 커밋 규칙](docs/engineering/development-workflow.md)
- [구현 기록](docs/progress/work-log.md)
- [검증 보고서](docs/reports/validation-2026-07-27.md)
- [MVP 이후 로드맵](docs/roadmap/post-mvp.md)

## 검증

```bash
make test
make build
make compose-config
```
