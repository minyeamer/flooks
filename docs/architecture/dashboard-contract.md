# 차트와 대시보드 계약

ChartDocument와 DashboardDocument는 `apiVersion: flooks.io/v1alpha1`과 `kind`를 가진 JSON document다.

## 차트 편집

차트 편집기는 Dataset Manifest가 공개한 필드만 선택할 수 있는 설정 패널을 기본 편집 수단으로 사용한다. 사용자가 선택한 데이터셋, 차원, 지표, 필터, 정렬, 기간과 표시 옵션은 모두 기존 ChartDocument의 `spec.query`와 `spec.visualization`에 저장된다. 따라서 UI에서 편집한 결과와 JSON 내보내기 결과는 같은 문서다.

- 차원과 지표는 각각 여러 개를 추가하거나 제거할 수 있다. KPI는 차원을 사용하지 않고 하나의 지표를 표시한다.
- 필터는 field, operator, value로 저장하며 값 형태는 QuerySpec 계약을 따른다. `in`은 문자열 배열, `between`은 두 값 배열, `isNull`은 boolean이다.
- 정렬은 field와 `asc` 또는 `desc`를 저장한다. 표의 페이지 크기도 QuerySpec의 `limit`이다.
- JSON 편집과 import/export는 고급 기능으로 계속 제공한다. JSON 문법 오류 또는 불완전한 필터가 있으면 미리보기와 저장을 진행하지 않는다.
- UI는 임의 SQL, JavaScript, HTML, CSS를 저장하거나 실행하지 않는다.

### 표 열 표시

표 차트는 `visualization.table`로 열 표시를 저장한다. 이 설정은 QuerySpec과 독립적이므로 같은 조회 결과를 다시 질의하지 않고도 표현만 바꿀 수 있다.

- `layout: "fit"`은 기본값이다. `columnWidths` 숫자를 상대 비율로 해석해 선택한 모든 열이 표 컨테이너를 채우도록 한다. 컨테이너 크기가 변하면 열도 다시 계산된다.
- `layout: "fixed"`는 `columnWidths` 숫자를 픽셀로 해석한다. 표 전체 폭이 컨테이너보다 넓으면 가로 스크롤하며, `frozenColumns`만큼의 왼쪽 열은 고정한다.
- 너비가 없는 열은 맞춤 모드에서 비율 `1`, 고정 모드에서 `180px`을 기본값으로 사용한다. 열 키를 바꾸거나 삭제해도 사용하지 않는 너비 설정은 렌더링에 영향을 주지 않는다.

- ChartAsset의 모든 저장은 immutable revision을 만든다.
- Dashboard는 chart ID와 특정 revision을 참조한다.
- 차트 새 revision은 자동 전파하지 않고 사용자가 dashboard reference를 갱신한다.
- 수정은 `If-Match` ETag가 필요하고 충돌은 HTTP 412다.
- 복원은 과거 row를 최신으로 바꾸지 않고 과거 document를 복제한 새 revision을 만든다.
- Archive된 차트는 라이브러리 신규 선택에서만 숨기고 기존 dashboard는 계속 렌더링한다.

Dashboard V1은 단일 페이지와 12열 grid를 사용한다. Desktop 좌표가 canonical이며 좁은 화면은 y/x 순서의 단일 열 view mode다.

Export는 portable document를 반환한다. Dashboard bundle은 pinned chart revision을 포함한다. Import는 schema 검증과 충돌 preview 후 새 애셋 또는 새 revision으로 적용한다.
