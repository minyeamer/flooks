# Flooks 작업 지침

이 파일은 Flooks에서 작업할 때의 공통 기준이다. 더 가까운 경로의 `AGENTS.md`가 있으면 그 규칙을 함께 적용하고, 충돌하면 더 가까운 규칙을 따른다.

## 빠른 판단

- 화면·차트 편집 작업은 `apps/web/AGENTS.md`를 먼저 읽는다.
- Go API, QuerySpec, connector, metadata 변경은 `internal/AGENTS.md`를 먼저 읽는다.
- OpenAPI, JSON Schema, Dataset Manifest 변경은 `contracts/AGENTS.md`를 먼저 읽는다.
- 작업 절차, 검증, 커밋 형식은 `docs/engineering/development-workflow.md`를 따른다.

필요한 문서만 읽는다. 예를 들어 CSS만 바꾸는 작업에 connector 문서 전체를 읽지 않는다. 반대로 공개 계약을 바꾸는 작업은 구현 전에 관련 architecture 문서를 반드시 갱신한다.

## 저장소 지도

- `apps/web`: React, TypeScript, Vite 기반 사용자 인터페이스
- `cmd`, `internal`: Go와 Chi 기반 API 및 실행 파일
- `contracts`: OpenAPI, Chart/Dashboard JSON Schema, Dataset Manifest
- `db/migrations`: metadata PostgreSQL migration
- `deploy`: Docker Compose와 Nginx 설정
- `docs`: 한국어 아키텍처, 결정, 사용법, 작업 기록

## 반드시 지킬 원칙

- 비밀정보, 실제 DSN, 주소, 계정, 토큰을 코드·문서·예제·로그·커밋 메시지에 넣지 않는다.
- 사용자 입력을 SQL 또는 실행 가능한 JavaScript/HTML/CSS로 해석하지 않는다.
- Dataset Manifest allowlist 밖의 필드나 식별자를 쿼리하지 않는다.
- UI 편집과 JSON 편집은 같은 versioned document를 만들어야 한다.
- 생성된 OpenAPI 코드는 직접 수정하지 않는다.
- 기존 작업 트리의 관련 없는 변경을 되돌리거나 정리하지 않는다.
- `docker compose down -v`는 metadata 데이터를 삭제하므로, 명시적인 요청 없이는 실행하지 않는다.

## 변경 완료 기준

1. 변경 범위에 맞는 문서와 계약을 함께 갱신한다.
2. 관련 테스트와 빌드를 실행한다.
3. `docs/progress/work-log.md`에 구현 내용, 검증, 남은 제한을 기록한다.
4. `git diff --check`로 공백 오류를 확인한다.
5. 커밋 메시지는 `docs/engineering/development-workflow.md`의 형식을 사용한다.
6. 사용자가 커밋을 요청하면 먼저 변경사항 요약과 제안 커밋 메시지를 보여주고 승인 여부를 묻는다. 명시적인 승인 전에는 `git commit`을 실행하지 않는다.

## 기본 명령

```bash
make test
make build
make compose-config
```

Compose 실행·종료 방법은 `README.md`와 `docs/playbooks/local-development.md`를 따른다. `.env`는 로컬 전용이며 Git에 추가하지 않는다.
