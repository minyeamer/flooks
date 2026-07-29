# QuerySpec과 Connector

## 경계

사용자 입력은 SQL이 아니라 QuerySpec이다. Core는 manifest allowlist로 필드, metric, filter, limit을 검증하고 Connector가 물리 질의로 번역한다.

```json
{
  "datasetKey": "ads_daily",
  "timeRange": {"start": "2026-07-01", "end": "2026-07-25"},
  "dimensions": ["ymd", "platform_name"],
  "metrics": ["ad_cost", "conv_amount"],
  "filters": [{"field": "brand_name", "op": "in", "value": ["브랜드"]}],
  "sort": [{"field": "ymd", "direction": "asc"}],
  "limit": 100,
  "offset": 0
}
```

지원 연산자는 `eq`, `in`, `contains`, `between`, `isNull`이다. PostgreSQL connector는 식별자를 manifest에서만 가져오고 값은 모두 bind parameter로 전달한다. 날짜는 table function 인자로 전달한다.

## 편집기와 Manifest의 연결

차트 편집기는 `/api/v1/datasets`에서 받은 Manifest를 사용해 데이터셋 선택 목록과 차원·지표·필터·정렬 후보를 만든다. 화면에 보이는 선택지는 편의를 위한 것이며, 최종 검증 책임은 API의 QuerySpec validator에 있다.

- 차원에 선언된 `filterOperators`만 해당 필터의 연산자 선택지로 표시한다.
- `in`은 쉼표로 입력한 값을 배열로 바꾸고, `between`은 시작·끝 값 배열로, `isNull`은 boolean으로 전송한다.
- 정렬 후보는 현재 데이터셋의 차원과 지표의 합집합이며 방향은 오름차순 또는 내림차순이다.
- UI가 모르는 새 데이터셋이나 새 필드는 Manifest만 올바르게 제공하면 선택할 수 있어야 한다. 특정 광고 데이터셋의 필드명을 화면 코드에 하드코딩하지 않는다.

Connector 공개 계약은 `Kind`, `ValidateManifest`, `Execute`다. 새 connector는 contract test를 통과하고 compile-time registry에 등록한다. BigQuery 구현 시까지 공통 SQL AST나 런타임 플러그인 protocol은 만들지 않는다.

`ads_daily`는 15초 timeout, 최대 500행, 기본 100행, 5분 캐시를 사용한다. 분석 DB pool과 동시 실행 semaphore는 10개다.
