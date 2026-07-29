# Web 작업 지침

`apps/web`은 ChartDocument와 DashboardDocument를 UI로 편집하고 안전하게 렌더링한다.

## 상태와 계약

- API 요청은 `src/api.ts`를 통해서만 수행한다.
- 서버 응답과 저장 문서의 타입은 `src/types.ts`에 명시한다.
- 폼, 차트 편집 UI, Monaco JSON 편집기는 같은 document 상태를 사용한다.
- 새 UI 제어 항목은 ChartDocument 또는 DashboardDocument에 저장되는 의미를 먼저 정의한다.
- Dataset의 차원·지표·연산자는 화면에 하드코딩하지 않고 Dataset Manifest API 응답에서 가져온다.
- 새 ChartDocument 필드는 `contracts/dashboard/chart.schema.json`과 관련 한국어 문서를 같은 변경에서 갱신한다.

## 렌더링과 보안

- 임의 SQL, JavaScript, HTML, CSS를 document에 저장하거나 실행하지 않는다.
- 차트 옵션은 선언형 데이터만 사용한다.
- 표는 좁은 컨테이너에서도 숫자 지표를 잃지 않도록 맞춤 또는 가로 스크롤 동작을 명시한다.
- keyboard 접근, 버튼의 이름, 작은 화면 레이아웃을 함께 확인한다.

## 구현 방식

- 작은 순수 변환 함수는 컴포넌트 밖으로 꺼내 Vitest로 검증한다.
- 네트워크 상태, 오류, 빈 결과, 저장 충돌을 화면에서 구분해 보여 준다.
- Monaco와 ECharts는 번들 크기가 크므로 새로운 대형 의존성을 추가하기 전 기존 도구로 해결 가능한지 확인한다.
- CSS 변경은 기존 대시보드와 차트 화면의 반응형 레이아웃을 깨지 않는지 확인한다.

## 검증

최소 `npm --prefix apps/web test -- --run`과 `npm --prefix apps/web run build`를 실행한다. 사용자 흐름이 바뀌면 차트 생성·미리보기·저장·JSON 왕복 중 영향을 받는 흐름을 수동으로 확인한다.
