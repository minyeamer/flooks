# Go API 작업 지침

`internal` 변경은 API의 안정성, QuerySpec 통제, 외부 분석 데이터소스 보호를 우선한다.

## 책임 경계

- `httpapi`는 HTTP 입출력, 인증 전의 요청 검증, Problem Details 변환만 담당한다.
- `query`는 QuerySpec 검증, 정규화, 캐시 키, 실행 조정을 담당한다.
- `connector`는 검증된 QuerySpec을 물리 데이터소스 질의로 번역한다.
- `assets`는 Chart/Dashboard identity, revision, ETag, 복원을 담당한다.
- `events`는 outbox, Redis Pub/Sub, SSE invalidation을 담당한다.
- `manifest`는 데이터셋 선언을 읽고 검증한다.

새 기능이 두 경계 이상을 건드리면 handler에 로직을 쌓지 말고 책임에 맞는 패키지로 나눈다.

## 데이터와 오류

- 모든 I/O는 전달받은 `context.Context`를 사용한다.
- 사용자 값은 항상 bind parameter로 전달한다.
- SQL 식별자, 함수 이름, 컬럼명은 Manifest allowlist에서만 가져온다.
- metadata DB와 분석 데이터소스 pool을 섞지 않는다.
- API 오류는 RFC 9457 Problem Details와 request ID 규칙을 유지한다.
- 분석 데이터소스 장애는 API liveness를 실패시키지 않고 해당 의존성만 `degraded`로 표현한다.

## 계약 변경

OpenAPI 또는 JSON 응답을 바꾸기 전 관련 문서를 갱신한다. OpenAPI 변경 뒤에는 `make generate`를 실행하고 생성 코드 차이를 확인한다. 공개 응답의 이름 변경·삭제는 ADR 없이는 하지 않는다.

## 검증

변경한 패키지의 단위 테스트를 먼저 실행하고, 완료 전 `go test ./...`를 실행한다. connector나 QuerySpec을 바꿨다면 allowlist, bind parameter, 취소, cache key와 관련된 테스트를 반드시 추가하거나 갱신한다.
