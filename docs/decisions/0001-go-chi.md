# ADR 0001: Go와 Chi

상태: 채택

Core API는 Go와 표준 `net/http` 기반 Chi를 사용한다. 요청 context를 PostgreSQL까지 전달하고 작은 런타임과 명시적인 계층을 유지한다. Spring Boot는 엔터프라이즈 기능이 강하지만 1인 MVP의 초기 복잡도가 더 커 제외했다.
