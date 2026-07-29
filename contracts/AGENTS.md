# 계약 작업 지침

`contracts`는 API, UI, 저장 데이터가 공유하는 공개 약속이다. 구현 편의를 위해 계약을 조용히 바꾸지 않는다.

## 대상

- `openapi.yaml`: HTTP endpoint, request, response, 오류 형식
- `dashboard/*.schema.json`: ChartDocument와 DashboardDocument 저장 형식
- `datasets/*.yaml`: connector가 실행할 수 있는 데이터셋 allowlist

## 변경 규칙

- 새 필드에는 타입, 기본 동작, 기존 revision과의 호환성을 정의한다.
- 필드 이름 변경이나 삭제, 의미 변경은 ADR을 추가하고 migration·fallback 필요성을 검토한다.
- ChartDocument와 DashboardDocument 계약 변경은 TypeScript 타입, UI, JSON import/export, renderer 영향을 함께 확인한다.
- Manifest에는 비밀번호, DSN, 실제 접속 주소를 넣지 않는다.
- Manifest의 field, filter operator, metric 변경은 QuerySpec validator와 connector 테스트를 함께 갱신한다.
- OpenAPI 변경 후 `make generate`를 실행한다. 생성 파일은 결과물이며 직접 편집하지 않는다.

## 검증

계약 변경은 해당 단위 테스트와 `make test`, `make build`를 실행한다. Compose 환경변수나 서비스 구성이 바뀌면 `make compose-config`도 실행한다.
