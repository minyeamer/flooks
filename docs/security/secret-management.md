# 비밀정보 관리

## 적용 범위

다음 값은 저장소, 문서, 예시, 테스트 fixture, 컨테이너 이미지, 로그, 이슈와 스크린샷에 기록하지 않는다.

- 외부 데이터베이스의 호스트와 IP 주소
- 포트, 데이터베이스 이름, 사용자 이름을 포함한 실제 연결 정보
- 비밀번호, DSN, API 키, 토큰, 개인키와 인증서
- 개인 로컬 경로와 dbt 프로필 원문

Dataset Manifest에는 논리적인 connector reference와 허용된 relation 또는 function 식별자만 둔다. 인증정보는 런타임 환경변수나 향후 도입할 secret manager에서 주입한다.

## 로컬 개발

- `.env.example`은 변수 이름만 제공하고 값을 비워 둔다.
- 개발자는 `.env.example`을 `.env`로 복사한 뒤 실제 값을 로컬에서만 입력한다.
- `.env`는 `.gitignore`와 `.dockerignore`로 제외한다.
- Compose 파일에는 비밀번호나 DSN 기본값을 두지 않으며, 필수 값이 없으면 즉시 실패하게 한다.
- 실제 연결값을 사용한 명령의 전체 문자열이나 환경변수를 작업 기록에 복사하지 않는다.

## 검토 절차

커밋 전에는 추적 파일과 Git diff에서 credential URL, 비어 있지 않은 secret 변수, 개인키 헤더, 외부 호스트와 개인 경로를 검사한다. lockfile의 무결성 해시와 공개 스키마·함수 이름은 비밀정보로 보지 않는다.

실제 비밀값이 Git 이력에 들어간 경우 파일만 삭제하는 것으로 끝내지 않는다. 먼저 해당 credential을 폐기하고 재발급한 뒤, 저장소 관리자와 협의해 이력 정리 및 공개 범위를 점검한다.

## 현재 제한

MVP는 로컬 `.env` 주입까지만 제공한다. Docker secrets, Kubernetes Secret, Vault와 클라우드 secret manager 연동은 배포 대상이 확장될 때 별도 ADR과 위협 모델을 작성한 뒤 도입한다.
