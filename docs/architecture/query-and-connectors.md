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

Connector 공개 계약은 `Kind`, `ValidateManifest`, `Execute`다. 새 connector는 contract test를 통과하고 compile-time registry에 등록한다. BigQuery 구현 시까지 공통 SQL AST나 런타임 플러그인 protocol은 만들지 않는다.

`ads_daily`는 15초 timeout, 최대 500행, 기본 100행, 5분 캐시를 사용한다. 분석 DB pool과 동시 실행 semaphore는 10개다.
