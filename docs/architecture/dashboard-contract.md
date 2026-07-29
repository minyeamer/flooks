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

## 대시보드 내 차트 편집

Dashboard placement는 안정적인 `id`와 `chartId`, `chartRevision`을 가진다. `id`는 grid, 선택 상태, 조회 결과를 구분하는 패널 인스턴스 식별자다. 같은 ChartAsset을 여러 패널에 배치해도 각 패널은 독립적으로 위치·조회 상태·pinned revision을 가진다.

기존에 placement `id`가 없는 DashboardDocument는 Web이 `chartId`, revision, 좌표, 배열 순서에서 결정론적인 legacy ID를 만들어 호환 로드한다. 다음 대시보드 저장 시 생성된 ID가 document에 포함된다.

대시보드에서 패널을 선택하면 pinned ChartDocument revision을 우측 편집기에서 draft로 연다.

1. `차트 저장`은 ChartAsset의 새 immutable revision을 만든다.
2. 성공하면 현재 대시보드 draft의 선택 placement만 새 revision을 pin한다.
3. `대시보드 저장`을 눌러야 placement 변경이 Dashboard revision으로 저장된다.

따라서 차트 저장 후 대시보드를 저장하지 않고 닫아도 새 ChartAsset revision은 남지만, 기존 대시보드의 pinned revision은 변하지 않는다. 다른 dashboard와 다른 placement도 자동으로 갱신하지 않는다. ChartAsset 저장의 ETag 충돌은 자동 병합하거나 덮어쓰지 않고 오류로 표시한다.

패널 삭제는 placement만 제거하고 ChartAsset을 archive하거나 삭제하지 않는다. 패널 복제는 동일한 `chartId`와 pinned revision을 새 placement ID와 기본 좌표로 추가한다.

Export는 portable document를 반환한다. Dashboard bundle은 pinned chart revision을 포함한다. Import는 schema 검증과 충돌 preview 후 새 애셋 또는 새 revision으로 적용한다.
