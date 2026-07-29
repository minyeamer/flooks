# 개발 작업 흐름

이 문서는 Flooks의 일관성, 검증 가능성, 그리고 작업 지시를 읽는 비용을 낮추기 위한 최소 절차다. 상세 규칙은 저장소 루트와 각 경로의 `AGENTS.md`에 둔다.

## 작업 시작

1. `git status --short`로 기존 변경을 확인한다. 관련 없는 변경은 보존한다.
2. 작업에 맞는 가장 가까운 `AGENTS.md`와 architecture/playbook 문서만 읽는다.
3. 공개 계약, 데이터 모델, 배포 환경을 바꾸는지 먼저 판단한다.
4. 계약 변경이면 구현보다 먼저 관련 문서와 schema/OpenAPI/Manifest를 갱신한다.

## 작업 중

- 작은 변경 단위로 구현하고, 경계가 다른 코드를 한 파일에 섞지 않는다.
- 사용자에게 보이는 동작은 오류·빈 상태·충돌 상태를 함께 설계한다.
- 기존 revision과 저장된 document를 깨뜨릴 수 있는 변경은 ADR을 추가한다.
- 실제 연결정보는 런타임 `.env`에서만 읽고 출력하지 않는다.

## 작업 완료

다음 항목 중 변경 범위에 해당하는 것을 수행한다.

- Go 변경: `go test ./...`
- Web 변경: `npm --prefix apps/web test -- --run`, `npm --prefix apps/web run build`
- OpenAPI 변경: `make generate` 후 생성 코드 차이 확인
- Compose 변경: `make compose-config`
- 전체 변경: `make test`, `make build`, `git diff --check`
- 문서: architecture/playbook과 `docs/progress/work-log.md` 갱신
- 실행 환경 변경: healthcheck와 영향받은 endpoint smoke test

실행하지 못한 검증이 있다면 완료로 표현하지 말고 work log와 작업 결과에 이유를 남긴다.

## 커밋 메시지

기본 형식은 다음과 같다.

```text
type(scope): imperative English summary
```

사용하는 type은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `build`, `ci`다. 권장 scope는 `api`, `web`, `query`, `connector`, `contract`, `compose`, `docs`, `security`다.

제목은 한 줄의 영어 명령형으로 작성한다. 단순한 변경은 제목만 사용하고 본문을 생략한다. 여러 영역에 영향을 주거나 변경 이유를 설명해야 할 때만 본문을 추가한다.

여러 경계를 함께 바꾼 경우에는 빈 줄 뒤에 영어 bullet 본문을 쓴다. 파일 목록을 나열하지 말고 변경의 목적과 결과를 쓴다.

```text
feat(web): improve chart editing and table configuration

Chart editor:

- Add manifest-driven field controls and query settings.

Table visualization:

- Add responsive sizing, fixed-width columns, and frozen columns.

Contracts and documentation:

- Store table configuration in ChartDocument and document the behavior.
```

커밋 하나에는 가능한 한 하나의 사용자 가치 또는 기술적 목적만 담는다. 별도 롤백이 어려운 리팩터링·포맷 변경·의존성 갱신은 기능 변경과 분리한다.

## 커밋 승인 절차

사용자가 커밋을 요청해도 바로 실행하지 않는다.

1. 현재 변경 파일과 검증 결과를 확인한다.
2. 변경사항 요약과 제안 커밋 메시지를 사용자에게 보여준다.
3. `이 메시지로 커밋할까요?`라고 명시적으로 승인 여부를 묻는다.
4. 사용자가 승인한 뒤에만 필요한 파일을 stage하고 `git commit`을 실행한다.

사용자가 메시지를 직접 지정했거나 승인한 경우에만 커밋한다. 승인 전에는 커밋 메시지 작성과 검증까지만 수행한다. 사용자가 명시하지 않은 파일을 임의로 포함하지 않으며, 커밋 후에는 hash와 포함된 변경 범위를 보고한다.

## 변경 유형별 최소 체크

| 변경 | 함께 확인할 것 |
| --- | --- |
| API endpoint | OpenAPI, 오류 형식, Go test, Web client 영향 |
| Chart/Dashboard document | JSON Schema, TypeScript type, UI/JSON 왕복, renderer, revision 호환성 |
| Dataset/connector | Manifest, QuerySpec allowlist, bind parameter, cache key, connector test |
| Compose/환경변수 | `.env.example` 비밀정보, config, healthcheck, 문서 |
| 사용자 경험 | 작은 화면, 빈 상태, 오류 상태, 저장 충돌, playbook |

## ADR을 추가하는 경우

다음은 `docs/decisions`에 ADR을 추가한다.

- 공개 API 또는 저장 document의 호환성을 깨는 변경
- 새 데이터베이스 또는 connector 지원
- 인증·권한 모델 변경
- 배포 플랫폼 또는 핵심 런타임 의존성 변경
- revision, cache, 동시 편집의 일관성 모델 변경

ADR은 문맥, 결정, 검토한 대안, 영향과 후속 작업을 짧게 기록한다.
