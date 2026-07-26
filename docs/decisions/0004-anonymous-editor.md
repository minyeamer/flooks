# ADR 0004: 사내망 anonymous editor

상태: MVP 한정 채택

인증 구현을 시각화 vertical slice와 분리하기 위해 모든 접속자를 editor로 취급한다. 인터넷 공개 배포는 지원하지 않는다. API의 capability 검사 지점은 이후 identity/ACL 구현이 대체한다.
