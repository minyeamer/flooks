# 차트와 대시보드 계약

ChartDocument와 DashboardDocument는 `apiVersion: flooks.io/v1alpha1`과 `kind`를 가진 JSON document다.

- ChartAsset의 모든 저장은 immutable revision을 만든다.
- Dashboard는 chart ID와 특정 revision을 참조한다.
- 차트 새 revision은 자동 전파하지 않고 사용자가 dashboard reference를 갱신한다.
- 수정은 `If-Match` ETag가 필요하고 충돌은 HTTP 412다.
- 복원은 과거 row를 최신으로 바꾸지 않고 과거 document를 복제한 새 revision을 만든다.
- Archive된 차트는 라이브러리 신규 선택에서만 숨기고 기존 dashboard는 계속 렌더링한다.

Dashboard V1은 단일 페이지와 12열 grid를 사용한다. Desktop 좌표가 canonical이며 좁은 화면은 y/x 순서의 단일 열 view mode다.

Export는 portable document를 반환한다. Dashboard bundle은 pinned chart revision을 포함한다. Import는 schema 검증과 충돌 preview 후 새 애셋 또는 새 revision으로 적용한다.
