# 로컬 개발

## 환경

`.env.example`을 `.env`로 복사한 뒤 비어 있는 값을 로컬 환경에 맞게 입력한다. 외부 데이터소스 설정은 로컬 dbt 프로필에서 확인하되 프로필 파일, 호스트, 계정, 비밀번호, DSN을 저장소나 컨테이너 이미지에 복사하지 않는다.

`.env`는 Git과 Docker build context에서 제외된다. 명령 출력, 스크린샷, 이슈, 문서에도 실제 값을 남기지 않는다. 상세 원칙은 [비밀정보 관리](../security/secret-management.md)를 따른다.

`ANALYTICS_DATABASE_URL`에는 read-only 분석 PostgreSQL 연결을 설정한다. `METADATA_DATABASE_URL`은 Flooks metadata 전용이며 두 연결의 pool과 권한을 분리한다.

## 실행

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.dev.yml up --build
```

운영형 로컬 실행:

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml up --build -d

종료:

```bash
docker compose --env-file .env -p flooks \
  -f deploy/compose/compose.yml down
```
```

API는 5741, Vite 개발 서버는 5173, 운영형 Web은 5740을 사용한다. `/api/v1/system/status`에서 metadata, Redis, 분석 데이터소스 상태를 확인한다. 분석 데이터소스 장애는 liveness를 실패시키지 않고 `analyticsDatasource`를 `degraded`로 표시한다.
