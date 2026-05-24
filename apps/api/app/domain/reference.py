"""Structured API reference models for the FLooks bootstrap service.

These models describe the currently implemented HTTP surfaces in a format that
the web shell can render directly. The payload is intentionally explicit so the
API reference remains stable even while the OpenAPI surface evolves.
"""

from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel

JsonValue: TypeAlias = dict[str, object] | list[object] | str | int | float | bool | None


class ApiFieldReference(BaseModel):
    name: str
    type: str
    description: str
    required: bool = True
    example: JsonValue = None
    enum_values: list[str] = []


class ApiResponseReference(BaseModel):
    status_code: int
    description: str
    fields: list[ApiFieldReference]
    example: JsonValue = None


class ApiEndpointReference(BaseModel):
    id: str
    method: Literal["GET", "POST", "PUT", "DELETE"]
    path: str
    summary: str
    description: str
    parameters: list[ApiFieldReference]
    responses: list[ApiResponseReference]
    openapi_href: str


class ApiReferenceViewer(BaseModel):
    label: str
    href: str
    description: str


class ApiReferenceResponse(BaseModel):
    title: str
    summary: str
    viewers: list[ApiReferenceViewer]
    endpoints: list[ApiEndpointReference]