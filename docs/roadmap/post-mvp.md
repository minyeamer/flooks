# MVP 이후 로드맵

1. Identity와 ACL: OIDC/SSO, workspace, VIEWER/EDITOR, dataset grant, 감사 actor
2. BigQuery connector: 동일 Manifest/QuerySpec contract test, 비용 제한, job cancellation
3. Kubernetes/Helm: migration Job, Ingress, HPA, secret, Redis/PostgreSQL 외부화
4. 다중 페이지와 responsive layout 편집
5. 별도 AI API: governed QuerySpec tool만 사용
6. 언어 독립 connector protocol: 실제 외부 connector 수요가 확인된 뒤 HTTP/gRPC 계약 검토
7. CRDT 기반 동시 편집과 presence

각 항목은 선행 MVP 지표와 운영 요구가 확인된 뒤 ADR을 추가하고 구현한다.
