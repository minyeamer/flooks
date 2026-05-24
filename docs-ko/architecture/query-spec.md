# Query Spec

이 문서는 FLooks가 왜 raw SQL 중심 제품이 아니라 governed query 중심 제품이어야 하는지와, 그 핵심 계약인 QuerySpec을 설명한다.

전체 기술 선택 배경은 `docs-ko/architecture/platform-dossier.md`를 참고한다.

## 1. Intent

FLooks의 패널과 AI 도구는 임의 SQL을 직접 실행하지 않는다. 대신 curated dataset contract 위에서 동작하는 QuerySpec을 제출한다.

이 원칙은 단순한 편의 기능 제한이 아니라 제품의 핵심 보안/운영 전략이다.

## 2. Why FLooks does not expose raw SQL by default

기업형 대시보드 플랫폼에서 raw SQL을 기본 기능으로 열면 다음 문제가 빠르게 발생한다.

1. 데이터 권한 검증이 화면마다 분산된다.
2. connector별 SQL dialect 차이가 그대로 사용자에게 노출된다.
3. panel, AI, export 기능이 서로 다른 질의 경로를 갖게 된다.
4. cache invalidation, audit logging, row/column masking을 일관되게 적용하기 어렵다.
5. 사용자 정의 차트와 AI가 같은 데이터 계약을 공유하지 못한다.

따라서 FLooks는 기본 모델을 아래처럼 고정한다.

- 사용자는 dataset을 선택한다.
- panel 또는 AI는 QuerySpec을 만든다.
- API는 dataset manifest와 권한 정책을 기준으로 QuerySpec을 검증한다.
- 서버가 안전한 실행 계획으로 변환한다.

## 3. Core contracts

### 3.1 Dataset manifest

각 dataset은 단순한 테이블 이름이 아니라 통제된 계약이다.

- `key`: `mart_commerce_daily` 같은 안정적인 식별자
- `source`: 실제 connector와 물리 뷰/테이블 매핑
- `dimensions`: group-by 가능한 필드
- `metrics`: 허용된 집계 항목
- `defaultFilters`: 강제 기본 조건
- `sorts`: 허용 정렬 항목
- `joins`: 허용된 조인 또는 lookup 범위
- `visibility`: user / team / department / role / workspace grant 정책
- `cache`: TTL, invalidation, stale-while-revalidate 정책
- `masking`: row / column masking 규칙

### 3.2 QuerySpec

QuerySpec은 panel과 AI가 공통으로 사용하는 질의 요청 형식이다.

- dataset key
- dimensions
- metrics
- filters
- sort
- limit
- optional time range, pagination, comparison window

## 4. QuerySpec shape

```json
{
  "datasetKey": "mart_commerce_daily",
  "dimensions": ["order_date", "channel_name"],
  "metrics": [
    { "key": "revenue", "aggregate": "sum" },
    { "key": "gmv", "aggregate": "sum" }
  ],
  "filters": [
    {
      "field": "order_date",
      "op": "between",
      "value": ["2026-05-01", "2026-05-24"]
    }
  ],
  "sort": [
    { "field": "revenue", "direction": "desc" }
  ],
  "limit": 500
}
```

## 5. Execution flow

```mermaid
flowchart LR
  P[Panel or AI Tool] --> Q[QuerySpec]
  Q --> V[API validator]
  V --> G[Grant evaluation]
  G --> M[Dataset manifest lookup]
  M --> X[Execution planner]
  X --> D[Connector execution]
  D --> C[Cache and audit]
  C --> R[Result]
```

실행 순서는 아래와 같다.

1. caller가 QuerySpec을 제출한다.
2. API가 dataset key가 실제 manifest에 존재하는지 확인한다.
3. caller의 system role, resource ACL, dataset grant를 함께 평가한다.
4. dimensions, metrics, filters, sorts가 manifest에 선언된 범위 안인지 검증한다.
5. limit, pagination, execution timeout 정책을 서버 기준으로 보정한다.
6. connector별 실행 계획으로 변환한다.
7. 결과를 cache policy와 audit boundary 안에서 반환한다.

## 6. Why this model matters for FLooks

### 6.1 Panel reuse

사용자는 다른 사람이 만든 패널 객체를 자기 대시보드에 재사용할 수 있다. 이때 panel 내부가 raw SQL이면 가시성/권한 검증이 각 패널마다 제각각 될 수 있다. QuerySpec 기반이면 재사용 가능한 panel object에도 동일한 정책을 적용할 수 있다.

### 6.2 AI safety

AI assistant는 dataset을 설명하고 전략을 제안할 수 있어야 하지만, 사용자가 보지 못하는 데이터를 우회해서 참조하면 안 된다. QuerySpec과 dataset manifest를 쓰면 AI도 panel과 같은 안전 경계 안에 넣을 수 있다.

### 6.3 Connector extensibility

V1은 Linkmerce PostgreSQL mart만 지원하지만, 이후 BigQuery, ClickHouse, JDBC, CSV connector가 추가될 수 있다. QuerySpec은 이때 frontend와 AI의 호출 방식을 바꾸지 않고 backend translator만 교체할 수 있게 한다.

### 6.4 Audit and cache coherence

기업형 제품에서는 “어떤 데이터가 누구에게 어떤 조건으로 노출되었는가”를 추적해야 한다. QuerySpec 기반이면 audit logging과 cache key 설계를 표준화하기 쉽다.

## 7. Rules

1. API는 dataset key를 모든 실행보다 먼저 검증한다.
2. 모든 dimension, metric, filter, sort는 manifest에 선언돼 있어야 한다.
3. row limit와 timeout은 항상 서버가 상한을 가진다.
4. cache key는 dataset policy와 caller visibility context를 포함한다.
5. AI 도구는 QuerySpec을 생성하거나 수정할 수 있지만 raw SQL을 직접 제출하지 않는다.
6. connector 추가는 QuerySpec 계약을 깨지 않는 방향으로만 허용한다.

## 8. Planned extensions

향후 아래 기능이 QuerySpec 위에 추가될 수 있다.

- comparison window
- pivot or matrix projection
- derived metric references
- export presets
- saved filter bundles
- parameterized date macros

이 확장도 raw SQL 노출이 아니라 QuerySpec 필드 확장으로 처리하는 것을 기본 원칙으로 한다.
