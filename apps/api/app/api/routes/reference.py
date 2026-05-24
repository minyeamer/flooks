"""Structured API reference routes for the current bootstrap surface."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.domain.reference import (
    ApiEndpointReference,
    ApiFieldReference,
    ApiReferenceResponse,
    ApiReferenceViewer,
    ApiResponseReference,
)

router = APIRouter(tags=["reference"])


@router.get(
    "/reference/apis",
    response_model=ApiReferenceResponse,
    summary="Structured API reference",
)
async def get_api_reference() -> ApiReferenceResponse:
    api_prefix = settings.api_v1_prefix

    return ApiReferenceResponse(
        title="FLooks Bootstrap API Reference",
        summary=(
            "현재 구현된 bootstrap API의 파라미터, 응답 필드, 예시 payload를 한곳에 모아 "
            "web shell과 사람 검토용 문서에서 함께 사용할 수 있게 정리한 reference입니다."
        ),
        viewers=[
            ApiReferenceViewer(
                label="Swagger UI",
                href="/docs",
                description="FastAPI OpenAPI 기반의 interactive API explorer입니다.",
            ),
            ApiReferenceViewer(
                label="ReDoc",
                href="/redoc",
                description="응답 스키마 중심으로 읽기 쉬운 문서 viewer입니다.",
            ),
        ],
        endpoints=[
            ApiEndpointReference(
                id="health",
                method="GET",
                path=f"{api_prefix}/health",
                summary="Health check",
                description="API 컨테이너가 살아 있는지 빠르게 확인하는 가장 가벼운 smoke-test endpoint입니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="서비스가 정상 응답할 때 반환됩니다.",
                        fields=[
                            ApiFieldReference(
                                name="status",
                                type="string",
                                description="헬스 체크 결과입니다. 현재 구현에서는 항상 `ok`를 반환합니다.",
                                example="ok",
                            ),
                            ApiFieldReference(
                                name="service",
                                type="string",
                                description="응답을 만든 서비스 식별자입니다.",
                                example="flooks-api",
                            ),
                        ],
                        example={"status": "ok", "service": "flooks-api"},
                    ),
                ],
                openapi_href="/docs#/health/get_health_api_v1_health_get",
            ),
            ApiEndpointReference(
                id="system",
                method="GET",
                path=f"{api_prefix}/system",
                summary="Bootstrap metadata",
                description="클라이언트 초기화에 필요한 시스템 메타데이터와 enum 기반 bootstrap 목록을 제공합니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="서비스 이름, 버전, 환경, 역할/모듈/데이터소스 목록을 반환합니다.",
                        fields=[
                            ApiFieldReference(name="name", type="string", description="API 서비스 이름입니다.", example="FLooks API"),
                            ApiFieldReference(name="version", type="string", description="배포된 API 버전입니다.", example="0.1.0"),
                            ApiFieldReference(name="environment", type="string", description="현재 실행 환경입니다.", example="development"),
                            ApiFieldReference(name="apiPrefix", type="string", description="모든 versioned API route의 prefix입니다.", example="/api/v1"),
                            ApiFieldReference(name="roles[]", type="string[]", description="시스템 전역 역할 목록입니다.", example=["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
                            ApiFieldReference(name="dataSources[]", type="string[]", description="지원 예정 connector kind 목록입니다.", example=["LINKMERCE_POSTGRES"]),
                            ApiFieldReference(name="modules[]", type="string[]", description="플랫폼 모듈 구분자 목록입니다.", example=["AUTH", "CATALOG", "DASHBOARDS"]),
                        ],
                    ),
                ],
                openapi_href="/docs#/system/get_system_metadata_api_v1_system_get",
            ),
            ApiEndpointReference(
                id="overview",
                method="GET",
                path=f"{api_prefix}/overview",
                summary="Bootstrap overview",
                description="web shell이 현재 구현 상태, 다음 단계, 서비스 링크를 실시간으로 보여주기 위해 사용하는 overview payload입니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="현재 bootstrap 진행 상태와 링크 모음을 반환합니다.",
                        fields=[
                            ApiFieldReference(name="product", type="string", description="제품 이름입니다.", example="FLooks"),
                            ApiFieldReference(name="environment", type="string", description="현재 환경 이름입니다.", example="development"),
                            ApiFieldReference(name="headline", type="string", description="웹 hero 영역에 노출되는 현재 상태 headline입니다."),
                            ApiFieldReference(name="summary", type="string", description="현재 bootstrap 범위를 요약한 설명입니다."),
                            ApiFieldReference(name="metrics[].label", type="string", description="요약 metric 이름입니다."),
                            ApiFieldReference(name="metrics[].value", type="string", description="metric 값입니다."),
                            ApiFieldReference(name="metrics[].note", type="string", description="metric의 해설 문장입니다."),
                            ApiFieldReference(name="execution_plan[].id", type="string", description="실행 단계 식별자입니다."),
                            ApiFieldReference(name="execution_plan[].title", type="string", description="실행 단계 제목입니다."),
                            ApiFieldReference(name="execution_plan[].status", type="string", description="단계 상태입니다.", enum_values=["done", "in_progress", "next"]),
                            ApiFieldReference(name="execution_plan[].outcome", type="string", description="해당 단계가 만드는 결과입니다."),
                            ApiFieldReference(name="service_links[].label", type="string", description="표시용 링크 이름입니다."),
                            ApiFieldReference(name="service_links[].href", type="string", description="상대 또는 절대 링크 주소입니다."),
                            ApiFieldReference(name="service_links[].description", type="string", description="링크가 가리키는 surface 설명입니다."),
                        ],
                    ),
                ],
                openapi_href="/docs#/overview/get_overview_api_v1_overview_get",
            ),
            ApiEndpointReference(
                id="identity-bootstrap",
                method="GET",
                path=f"{api_prefix}/identity/bootstrap",
                summary="Identity bootstrap",
                description="이메일 로그인, 승인 단계, 세션 정책, 권한 축을 포함한 identity baseline contract를 반환합니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="identity와 permission baseline을 반환합니다.",
                        fields=[
                            ApiFieldReference(name="identity.authentication_methods[]", type="string[]", description="허용된 인증 방식입니다."),
                            ApiFieldReference(name="identity.approval_stages[]", type="string[]", description="가입 후 거치는 승인 단계입니다."),
                            ApiFieldReference(name="identity.email_verification_required", type="boolean", description="이메일 인증 강제 여부입니다.", example=True),
                            ApiFieldReference(name="identity.admin_approval_required", type="boolean", description="관리자 승인 강제 여부입니다.", example=True),
                            ApiFieldReference(name="identity.self_signup_enabled", type="boolean", description="셀프 가입 허용 여부입니다.", example=True),
                            ApiFieldReference(name="identity.default_role", type="string", description="초기 부여 시스템 역할입니다.", example="VIEWER"),
                            ApiFieldReference(name="identity.session_policy.access_token_transport", type="string", description="access token 전달 방식입니다."),
                            ApiFieldReference(name="identity.session_policy.access_token_ttl_minutes", type="integer", description="access token TTL(분)입니다."),
                            ApiFieldReference(name="identity.session_policy.refresh_token_ttl_days", type="integer", description="refresh token TTL(일)입니다."),
                            ApiFieldReference(name="identity.session_policy.rotate_refresh_tokens", type="boolean", description="refresh token rotation 여부입니다."),
                            ApiFieldReference(name="permissions.system_roles[]", type="string[]", description="시스템 전역 역할 목록입니다."),
                            ApiFieldReference(name="permissions.resource_acl_targets[]", type="string[]", description="ACL 적용 대상 리소스 유형입니다."),
                            ApiFieldReference(name="permissions.dataset_grant_axes[]", type="string[]", description="dataset grant 평가 축입니다."),
                            ApiFieldReference(name="permissions.hidden_resource_behavior.discovery", type="string", description="비인가 리소스를 discovery에서 처리하는 방식입니다."),
                            ApiFieldReference(name="permissions.hidden_resource_behavior.editor", type="string", description="에디터 picker에서 비인가 리소스를 처리하는 방식입니다."),
                            ApiFieldReference(name="permissions.hidden_resource_behavior.ai", type="string", description="AI context에서 비인가 리소스를 처리하는 방식입니다."),
                        ],
                    ),
                ],
                openapi_href="/docs#/identity/get_identity_bootstrap_api_v1_identity_bootstrap_get",
            ),
            ApiEndpointReference(
                id="metadata-bootstrap",
                method="GET",
                path=f"{api_prefix}/metadata/bootstrap",
                summary="Metadata bootstrap",
                description="현재 metadata 저장소 연결 정보와 Alembic baseline, 테이블 목록을 요약해서 보여줍니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="metadata persistence baseline을 반환합니다.",
                        fields=[
                            ApiFieldReference(name="dialect", type="string", description="DB dialect 이름입니다.", example="postgresql"),
                            ApiFieldReference(name="driver", type="string", description="DB driver 이름입니다.", example="psycopg"),
                            ApiFieldReference(name="host", type="string | null", description="연결 대상 호스트입니다.", required=False, example="localhost"),
                            ApiFieldReference(name="database", type="string | null", description="연결 대상 데이터베이스 이름입니다.", required=False, example="flooks_meta"),
                            ApiFieldReference(name="expected_revision", type="string", description="API가 기대하는 Alembic revision입니다.", example="20260524_0001"),
                            ApiFieldReference(name="tables[].name", type="string", description="등록된 metadata table 이름입니다."),
                        ],
                    ),
                ],
                openapi_href="/docs#/metadata/get_metadata_bootstrap_api_v1_metadata_bootstrap_get",
            ),
            ApiEndpointReference(
                id="query-bootstrap",
                method="GET",
                path=f"{api_prefix}/query/bootstrap",
                summary="Governed query bootstrap",
                description="Dataset manifest registry와 governed-query rule set을 내려주는 bootstrap endpoint입니다.",
                parameters=[],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="manifest registry와 query rule set을 반환합니다.",
                        fields=[
                            ApiFieldReference(name="datasets[].key", type="string", description="dataset의 안정적인 식별자입니다."),
                            ApiFieldReference(name="datasets[].label", type="string", description="표시용 dataset 이름입니다."),
                            ApiFieldReference(name="datasets[].description", type="string", description="dataset 용도 설명입니다."),
                            ApiFieldReference(name="datasets[].source.kind", type="string", description="connector kind입니다.", example="LINKMERCE_POSTGRES"),
                            ApiFieldReference(name="datasets[].source.relation", type="string", description="실제 relation 또는 view 이름입니다."),
                            ApiFieldReference(name="datasets[].dimensions[].key", type="string", description="선택 가능한 dimension key입니다."),
                            ApiFieldReference(name="datasets[].dimensions[].dataType", type="string", description="dimension 데이터 타입입니다."),
                            ApiFieldReference(name="datasets[].dimensions[].filterOperators[]", type="string[]", description="해당 dimension에 허용된 filter 연산자입니다."),
                            ApiFieldReference(name="datasets[].metrics[].key", type="string", description="선택 가능한 metric key입니다."),
                            ApiFieldReference(name="datasets[].metrics[].defaultAggregate", type="string", description="기본 aggregate입니다."),
                            ApiFieldReference(name="datasets[].metrics[].supportedAggregates[]", type="string[]", description="허용된 aggregate 목록입니다."),
                            ApiFieldReference(name="datasets[].defaultFilters[].field", type="string", description="항상 강제되는 baseline filter 필드입니다."),
                            ApiFieldReference(name="datasets[].defaultFilters[].op", type="string", description="강제 filter 연산자입니다."),
                            ApiFieldReference(name="datasets[].defaultFilters[].value", type="string | number | boolean | list", description="강제 filter 값입니다."),
                            ApiFieldReference(name="datasets[].sorts[]", type="string[]", description="허용된 sort field 목록입니다."),
                            ApiFieldReference(name="datasets[].visibility.grantAxes[]", type="string[]", description="dataset grant를 평가하는 축입니다."),
                            ApiFieldReference(name="datasets[].cache.ttlSeconds", type="integer", description="기본 캐시 TTL(초)입니다."),
                            ApiFieldReference(name="datasets[].cache.staleWhileRevalidateSeconds", type="integer", description="stale-while-revalidate 유지 시간입니다."),
                            ApiFieldReference(name="datasets[].masking.maskedFields[]", type="string[]", description="마스킹 대상 필드 목록입니다."),
                            ApiFieldReference(name="datasets[].limitPolicy.defaultRows", type="integer", description="기본 row limit입니다."),
                            ApiFieldReference(name="datasets[].limitPolicy.maxRows", type="integer", description="허용되는 최대 row limit입니다."),
                            ApiFieldReference(name="rules.rawSqlAllowed", type="boolean", description="raw SQL 허용 여부입니다.", example=False),
                            ApiFieldReference(name="rules.datasetManifestRequired", type="boolean", description="manifest 등록이 필수인지 여부입니다.", example=True),
                            ApiFieldReference(name="rules.executionPreviewOnly", type="boolean", description="현재 단계가 preview-only인지 여부입니다.", example=True),
                        ],
                    ),
                ],
                openapi_href="/docs#/query/get_query_bootstrap_api_v1_query_bootstrap_get",
            ),
            ApiEndpointReference(
                id="query-validate",
                method="POST",
                path=f"{api_prefix}/query/validate",
                summary="Validate QuerySpec",
                description="QuerySpec payload를 dataset manifest에 대조해 semantic validation, default filter 병합, row limit 보정을 수행합니다.",
                parameters=[
                    ApiFieldReference(name="datasetKey", type="string", description="검증 대상 dataset manifest key입니다.", example="mart_commerce_daily"),
                    ApiFieldReference(name="dimensions[]", type="string[]", description="group-by에 사용할 dimension key 목록입니다.", required=False, example=["order_date", "channel_name"]),
                    ApiFieldReference(name="metrics[].key", type="string", description="선택할 metric key입니다.", example="revenue"),
                    ApiFieldReference(name="metrics[].aggregate", type="string", description="metric에 적용할 aggregate입니다.", example="sum", enum_values=["sum", "count", "avg", "min", "max"]),
                    ApiFieldReference(name="filters[].field", type="string", description="필터 대상 field 이름입니다.", required=False, example="channel_name"),
                    ApiFieldReference(name="filters[].op", type="string", description="필터 연산자입니다.", required=False, example="in", enum_values=["eq", "in", "between", "gte", "lte"]),
                    ApiFieldReference(name="filters[].value", type="string | number | boolean | list", description="필터 값입니다. `between`은 길이 2의 리스트를 기대합니다.", required=False, example=["smartstore", "coupang"]),
                    ApiFieldReference(name="sort[].field", type="string", description="정렬 기준 field입니다.", required=False, example="revenue"),
                    ApiFieldReference(name="sort[].direction", type="string", description="정렬 방향입니다.", required=False, example="desc", enum_values=["asc", "desc"]),
                    ApiFieldReference(name="limit", type="integer", description="요청 row limit입니다. 서버가 manifest 최대치 안으로 보정합니다.", required=False, example=9999),
                ],
                responses=[
                    ApiResponseReference(
                        status_code=200,
                        description="payload가 유효하면 manifest, normalized spec, execution preview를 반환합니다.",
                        fields=[
                            ApiFieldReference(name="valid", type="boolean", description="semantic validation 통과 여부입니다.", example=True),
                            ApiFieldReference(name="manifest", type="object", description="검증에 사용된 dataset manifest 전체입니다."),
                            ApiFieldReference(name="normalizedSpec.datasetKey", type="string", description="정규화된 dataset key입니다."),
                            ApiFieldReference(name="normalizedSpec.dimensions[]", type="string[]", description="허용 범위 안에서 유지된 dimension 목록입니다."),
                            ApiFieldReference(name="normalizedSpec.metrics[]", type="object[]", description="허용 범위 안에서 유지된 metric 목록입니다."),
                            ApiFieldReference(name="normalizedSpec.filters[]", type="object[]", description="기본 filter가 합쳐진 최종 filter 목록입니다."),
                            ApiFieldReference(name="normalizedSpec.sort[]", type="object[]", description="검증 후 유지된 정렬 목록입니다."),
                            ApiFieldReference(name="normalizedSpec.limit", type="integer", description="manifest maxRows를 반영한 최종 row limit입니다.", example=5000),
                            ApiFieldReference(name="executionPlan.datasetKey", type="string", description="preview execution 대상 dataset key입니다."),
                            ApiFieldReference(name="executionPlan.connectorKind", type="string", description="예정 connector kind입니다.", example="LINKMERCE_POSTGRES"),
                            ApiFieldReference(name="executionPlan.relation", type="string", description="예정 relation 이름입니다."),
                            ApiFieldReference(name="executionPlan.enforcedLimit", type="integer", description="강제 적용된 row limit입니다."),
                            ApiFieldReference(name="executionPlan.defaultFilterCount", type="integer", description="자동으로 병합된 default filter 수입니다."),
                            ApiFieldReference(name="executionPlan.selectedDimensionCount", type="integer", description="선택된 dimension 수입니다."),
                            ApiFieldReference(name="executionPlan.selectedMetricCount", type="integer", description="선택된 metric 수입니다."),
                        ],
                    ),
                    ApiResponseReference(
                        status_code=400,
                        description="payload가 manifest 규칙을 위반하면 detail 필드에 실패 이유를 반환합니다.",
                        fields=[
                            ApiFieldReference(name="detail.field", type="string", description="실패가 발생한 payload 영역입니다.", example="metrics"),
                            ApiFieldReference(name="detail.message", type="string", description="실패 원인 설명입니다."),
                        ],
                        example={
                            "detail": {
                                "field": "metrics",
                                "message": "Metric 'unknown_metric' is not declared in dataset 'mart_channel_performance'.",
                            },
                        },
                    ),
                ],
                openapi_href="/docs#/query/validate_query_validate_post",
            ),
        ],
    )