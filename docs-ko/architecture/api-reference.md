# API Reference

이 문서는 FLooks에 현재 구현된 bootstrap API를 정리하며, 각 endpoint가 어떤 입력 파라미터를 받고 어떤 응답 필드를 반환하는지 빠르게 검토할 수 있게 만든다.

기계가 읽을 수 있는 기준 payload는 `GET /api/v1/reference/apis` 에서 제공하며, 웹 셸도 같은 payload를 렌더링해서 Swagger를 먼저 열지 않아도 현재 API 계약을 바로 볼 수 있게 한다.

## Viewer

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- Structured reference payload: `/api/v1/reference/apis`

## Endpoint 요약

| Method | Path | 목적 |
| --- | --- | --- |
| `GET` | `/api/v1/health` | 실행 중인 API 컨테이너의 가장 빠른 smoke test. |
| `GET` | `/api/v1/system` | 앱 이름, 버전, 역할, 모듈, 데이터소스 목록을 주는 bootstrap metadata. |
| `GET` | `/api/v1/overview` | 웹 셸이 읽는 현재 런타임 overview payload. |
| `GET` | `/api/v1/identity/bootstrap` | identity, approval, permission baseline 계약. |
| `GET` | `/api/v1/metadata/bootstrap` | metadata persistence baseline과 Alembic revision 정보. |
| `GET` | `/api/v1/query/bootstrap` | starter dataset manifest registry와 governed-query rule set. |
| `POST` | `/api/v1/query/validate` | QuerySpec semantic validation과 normalized execution preview. |
| `GET` | `/api/v1/reference/apis` | 현재 구현된 API를 설명하는 structured human-readable reference. |

## Endpoint 상세

### `GET /api/v1/health`

입력 파라미터:

- 없음

응답 필드:

- `status`: 헬스 체크 결과 문자열. 현재 구현은 `ok`를 반환한다.
- `service`: 응답을 만든 서비스 식별자. 현재 구현은 `flooks-api`를 반환한다.

### `GET /api/v1/system`

입력 파라미터:

- 없음

응답 필드:

- `name`: API 서비스 이름.
- `version`: 배포된 backend 버전.
- `environment`: 현재 실행 환경 이름.
- `apiPrefix`: versioned API prefix.
- `roles[]`: 클라이언트가 참고할 시스템 전역 역할 목록.
- `dataSources[]`: 현재 지원 또는 계획된 데이터소스 종류.
- `modules[]`: 플랫폼 모듈 key 목록.

### `GET /api/v1/overview`

입력 파라미터:

- 없음

응답 필드:

- `product`: 웹 셸에 표시되는 제품 이름.
- `environment`: 현재 실행 환경.
- `headline`: hero 영역 headline.
- `summary`: 현재 bootstrap 범위를 설명하는 요약 문장.
- `metrics[]`: `label`, `value`, `note`를 가진 요약 카드 목록.
- `execution_plan[]`: `id`, `title`, `status`, `outcome`를 가진 실행 단계 목록.
- `service_links[]`: `label`, `href`, `description`를 가진 링크 목록.

### `GET /api/v1/identity/bootstrap`

입력 파라미터:

- 없음

응답 필드:

- `identity.authentication_methods[]`: 현재 bootstrap에서 허용하는 로그인 방식.
- `identity.approval_stages[]`: 가입 후 거치는 승인 단계.
- `identity.email_verification_required`: 이메일 인증 강제 여부.
- `identity.admin_approval_required`: 관리자 승인 강제 여부.
- `identity.self_signup_enabled`: 셀프 가입 허용 여부.
- `identity.default_role`: 신규 사용자 기본 시스템 역할.
- `identity.session_policy.*`: access token 전달 방식과 token TTL 설정.
- `permissions.system_roles[]`: 시스템 전역 역할 목록.
- `permissions.resource_acl_targets[]`: ACL 규칙이 적용되는 리소스 종류.
- `permissions.dataset_grant_axes[]`: dataset visibility 평가에 쓰는 grant 축.
- `permissions.hidden_resource_behavior.*`: discovery, editor, AI context에서 접근 거부 시 적용되는 동작.

### `GET /api/v1/metadata/bootstrap`

입력 파라미터:

- 없음

응답 필드:

- `dialect`: 현재 데이터베이스 dialect.
- `driver`: 현재 데이터베이스 driver.
- `host`: 있으면 데이터베이스 호스트.
- `database`: 있으면 데이터베이스 이름.
- `expected_revision`: API가 기대하는 Alembic revision.
- `tables[]`: 각 항목이 `name`을 갖는 metadata table 목록.

### `GET /api/v1/query/bootstrap`

입력 파라미터:

- 없음

응답 필드:

- `datasets[]`: manifest 목록.
- `datasets[].key`: dataset 안정 식별자.
- `datasets[].label`: 표시용 이름.
- `datasets[].description`: dataset 용도 설명.
- `datasets[].source.kind`: connector kind.
- `datasets[].source.relation`: 실제 relation 또는 view 이름.
- `datasets[].dimensions[]`: `key`, `label`, `dataType`, `filterOperators`를 가진 group-by 허용 필드 목록.
- `datasets[].metrics[]`: `key`, `label`, `defaultAggregate`, `supportedAggregates`를 가진 metric 목록.
- `datasets[].defaultFilters[]`: 항상 적용되는 baseline filter 목록.
- `datasets[].sorts[]`: 허용된 sort field 목록.
- `datasets[].visibility.*`: dataset grant 정책.
- `datasets[].cache.*`: cache TTL 및 stale-while-revalidate 정책.
- `datasets[].masking.maskedFields[]`: 마스킹 대상 필드 목록.
- `datasets[].limitPolicy.*`: 기본/최대 row limit.
- `rules.rawSqlAllowed`: raw SQL 허용 여부.
- `rules.datasetManifestRequired`: manifest 기반 dataset 등록 필수 여부.
- `rules.executionPreviewOnly`: 현재 단계가 execution preview까지만 제공하는지 여부.

### `POST /api/v1/query/validate`

입력 body 파라미터:

- `datasetKey`: 대상 dataset manifest key.
- `dimensions[]`: 선택적인 group-by dimension 목록.
- `metrics[].key`: 선택할 metric key.
- `metrics[].aggregate`: metric에 적용할 aggregate.
- `filters[].field`: 선택적 filter 대상 field.
- `filters[].op`: 선택적 filter 연산자.
- `filters[].value`: 선택적 filter 값. `between`은 2개 원소 리스트를 기대한다.
- `sort[].field`: 선택적 sort field.
- `sort[].direction`: 선택적 sort 방향.
- `limit`: 선택적 row limit. 필요하면 서버가 dataset 최대치로 보정한다.

성공 응답 필드:

- `valid`: 검증 성공 시 `true`.
- `manifest`: 검증에 사용된 manifest 전체.
- `normalizedSpec`: default filter와 limit enforcement를 반영한 최종 QuerySpec.
- `normalizedSpec.filters[]`: manifest 기본 filter까지 합쳐진 최종 filter 목록.
- `normalizedSpec.limit`: 서버가 강제한 최종 row limit.
- `executionPlan.datasetKey`: preview 생성에 사용한 dataset key.
- `executionPlan.connectorKind`: 대상 connector kind.
- `executionPlan.relation`: 대상 relation 이름.
- `executionPlan.enforcedLimit`: 보정 후 최종 row limit.
- `executionPlan.defaultFilterCount`: 자동 병합된 manifest 기본 filter 개수.
- `executionPlan.selectedDimensionCount`: 선택된 dimension 개수.
- `executionPlan.selectedMetricCount`: 선택된 metric 개수.

검증 실패 응답 필드:

- `detail.field`: 검증 실패가 발생한 payload 영역.
- `detail.message`: 사람이 읽을 수 있는 실패 원인 설명.

## 참고

- Swagger와 ReDoc은 생성된 OpenAPI schema를 가장 빠르게 살펴보는 도구다.
- structured reference endpoint는 web shell이 그대로 사용하므로 앱 안 문서가 backend 계약과 같이 움직인다.
- query validation은 아직 semantic validation과 execution preview까지만 제공하며, connector-backed SQL execution은 다음 단계다.