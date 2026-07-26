# ADR 0003: immutable revision과 Redis

상태: 채택

차트와 대시보드는 immutable revision으로 저장하고 ETag로 충돌을 감지한다. Redis는 query cache와 SSE fan-out에 사용하되 영구 데이터는 저장하지 않는다. DB outbox가 Redis 일시 장애에서 이벤트를 재시도한다.
