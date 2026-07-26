# ADR 0002: raw SQL 대신 QuerySpec

상태: 채택

차트와 향후 AI는 같은 Dataset Manifest와 QuerySpec을 사용한다. 필드와 연산자를 allowlist로 제한해 권한, 캐시, 감사, connector 확장을 한 경계에서 처리한다.
