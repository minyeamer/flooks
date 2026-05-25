import { useEffect, useState, type CSSProperties, type KeyboardEvent, type WheelEvent } from 'react';

import {
  dataSourceKinds,
  starterDashboard,
  systemRoles,
  type DashboardDocument,
  type DashboardPage,
  type PanelPlacement,
  type PanelRef,
} from '@flooks/dashboard-schema';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '');
const API_ORIGIN = new URL(API_BASE_URL).origin;

type OverviewMetric = {
  label: string;
  value: string;
  note: string;
};

type DeliveryStep = {
  id: string;
  title: string;
  status: 'done' | 'in_progress' | 'next';
  outcome: string;
};

type ServiceLink = {
  label: string;
  href: string;
  description: string;
};

type OverviewResponse = {
  product: string;
  environment: string;
  headline: string;
  summary: string;
  metrics: OverviewMetric[];
  execution_plan: DeliveryStep[];
  service_links: ServiceLink[];
};

type SystemResponse = {
  name: string;
  version: string;
  environment: string;
  apiPrefix: string;
  roles: string[];
  dataSources: string[];
  modules: string[];
};

type ApiFieldReference = {
  name: string;
  type: string;
  description: string;
  required: boolean;
  example: unknown;
  enum_values: string[];
};

type ApiResponseReference = {
  status_code: number;
  description: string;
  fields: ApiFieldReference[];
  example: unknown;
};

type ApiEndpointReference = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  parameters: ApiFieldReference[];
  responses: ApiResponseReference[];
  openapi_href: string;
};

type ApiReferenceViewer = {
  label: string;
  href: string;
  description: string;
};

type ApiReferenceResponse = {
  title: string;
  summary: string;
  viewers: ApiReferenceViewer[];
  endpoints: ApiEndpointReference[];
};

type DashboardApiResponse = {
  slug: string;
  title: string;
  latestVersionNumber: number;
  latestVersionStatus: 'draft' | 'published' | 'archived';
  ownerPrincipalKey: string;
  updatedAt: string;
  document: DashboardDocument;
  versions: DashboardVersionSummaryResponse[];
};

type DashboardSummaryResponse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  ownerPrincipalKey: string;
  latestVersionNumber: number;
  latestVersionStatus: 'draft' | 'published' | 'archived';
  updatedAt: string;
};

type DashboardVersionSummaryResponse = {
  versionNumber: number;
  status: 'draft' | 'published' | 'archived';
  summary: string | null;
  createdBy: string;
  createdAt: string;
};

type QueryResultValue = string | number | boolean;

type QueryExecutionRow = Record<string, QueryResultValue>;

type QueryExecutionResponse = {
  results: QueryExecutionRow[];
  columnNames: string[];
  rowCount: number;
  executionMetadata: {
    connector?: string;
    durationMs?: number;
  };
};

type RequestState = 'loading' | 'ready' | 'error';

type PanelRuntimeEntry = {
  state: RequestState;
  data: QueryExecutionResponse | null;
  errorMessage: string | null;
};

type RuntimePanelEntry = {
  panel: PanelRef;
  placement: PanelPlacement;
};

type RuntimeChartDatum = {
  label: string;
  value: number;
  formattedValue: string;
};

type RuntimeNoticeFact = {
  label: string;
  value: string;
};

type StarterRefreshOutcome = 'created' | 'refreshed' | 'aligned' | null;

type StarterRefreshHistoryTone = 'success' | 'error';

type StarterRefreshHistoryKind = 'created' | 'refreshed' | 'aligned' | 'failed';

type StarterRefreshHistoryFilter = 'all' | StarterRefreshHistoryKind;

type StarterRefreshHistoryEntry = {
  id: string;
  summary: string;
  detail: string;
  rawDetail: string | null;
  timestampLabel: string;
  timestampMs: number | null;
  tone: StarterRefreshHistoryTone;
  actionKind: StarterRefreshHistoryKind | null;
  contextLabels: string[];
};

type RuntimeCanvasScaleMode = 'fit' | 'detail';

type RuntimeGridMetrics = {
  columnCount: number;
  rowCount: number;
  columnWidth: number;
  rowHeight: number;
  previewRowSizePx: number;
  previewHeightPx: number;
};

type RuntimeGridStyle = CSSProperties & {
  '--runtime-grid-columns'?: string;
  '--runtime-grid-rows'?: string;
  '--runtime-grid-row-size'?: string;
  '--runtime-col-start'?: string;
  '--runtime-col-span'?: string;
  '--runtime-row-start'?: string;
  '--runtime-row-span'?: string;
};

const numberFormatter = new Intl.NumberFormat('en-US');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en-US', {
  numeric: 'auto',
  style: 'short',
});

const runtimeCanvasScaleModes: Array<{
  id: RuntimeCanvasScaleMode;
  label: string;
  description: string;
}> = [
  {
    id: 'fit',
    label: 'Fit',
    description: 'Scale the preview to fit the current panel width.',
  },
  {
    id: 'detail',
    label: 'Detail',
    description: 'Enlarge the preview and allow horizontal panning for inspection.',
  },
];

const runtimeCanvasZoomPercentDefault = 100;
const runtimeCanvasZoomPercentStep = 15;
const runtimeCanvasZoomPercentMin = 85;
const runtimeCanvasZoomPercentMax = 170;
const clearStarterHistoryConfirmTimeoutMs = 4000;
const runtimeChartColors = ['#0f766e', '#d97706', '#2563eb', '#be123c', '#4d7c0f'] as const;
const starterDashboardBootstrapOwnerKey = 'system-bootstrap';
const starterRefreshHistoryStorageKey = 'flooks.starter-refresh-history';
const starterRefreshHistoryFilterStorageKey = 'flooks.starter-refresh-history-filter';
const starterRefreshHistoryOpenErrorsStorageKey = 'flooks.starter-refresh-history-open-errors';

function inferStarterRefreshHistoryKind(
  summary: string,
  tone: StarterRefreshHistoryTone,
): StarterRefreshHistoryKind | null {
  if (tone === 'error') {
    return 'failed';
  }

  if (summary === 'Created starter persistence' || summary === 'Starter persistence') {
    return 'created';
  }

  if (summary === 'Refreshed starter seed' || summary === 'Starter seed') {
    return 'refreshed';
  }

  if (summary === 'Starter already aligned' || summary === 'Starter alignment') {
    return 'aligned';
  }

  return null;
}

function formatRelativeTimeLabel(timestampMs: number, referenceTimestampMs = Date.now()): string {
  const offsetMs = timestampMs - referenceTimestampMs;
  const absoluteOffsetMs = Math.abs(offsetMs);

  if (absoluteOffsetMs < 60_000) {
    return relativeTimeFormatter.format(Math.round(offsetMs / 1000), 'second');
  }

  if (absoluteOffsetMs < 3_600_000) {
    return relativeTimeFormatter.format(Math.round(offsetMs / 60_000), 'minute');
  }

  if (absoluteOffsetMs < 86_400_000) {
    return relativeTimeFormatter.format(Math.round(offsetMs / 3_600_000), 'hour');
  }

  return relativeTimeFormatter.format(Math.round(offsetMs / 86_400_000), 'day');
}

function getStarterRefreshHistorySummary(actionKind: StarterRefreshHistoryKind): string {
  switch (actionKind) {
    case 'created':
      return 'Starter persistence';
    case 'refreshed':
      return 'Starter seed';
    case 'aligned':
      return 'Starter alignment';
    case 'failed':
      return 'Starter refresh';
  }
}

function getStarterRefreshHistoryKindLabel(
  actionKind: StarterRefreshHistoryKind | null,
): string | null {
  switch (actionKind) {
    case 'created':
      return 'Created';
    case 'refreshed':
      return 'Refreshed';
    case 'aligned':
      return 'Aligned';
    case 'failed':
      return 'Failed';
    default:
      return null;
  }
}

function getStarterRefreshHistoryFilterLabel(filter: StarterRefreshHistoryFilter): string {
  if (filter === 'all') {
    return 'All';
  }

  return getStarterRefreshHistoryKindLabel(filter) ?? 'All';
}

function loadStarterRefreshHistoryFilter(): StarterRefreshHistoryFilter {
  if (typeof window === 'undefined') {
    return 'all';
  }

  try {
    const savedFilter = window.sessionStorage.getItem(starterRefreshHistoryFilterStorageKey);

    if (
      savedFilter === 'all' ||
      savedFilter === 'created' ||
      savedFilter === 'refreshed' ||
      savedFilter === 'aligned' ||
      savedFilter === 'failed'
    ) {
      return savedFilter;
    }
  } catch {
    return 'all';
  }

  return 'all';
}

function loadStarterRefreshHistoryOpenErrors(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const savedOpenErrors = window.sessionStorage.getItem(
      starterRefreshHistoryOpenErrorsStorageKey,
    );

    if (savedOpenErrors == null) {
      return [];
    }

    const parsedOpenErrors = JSON.parse(savedOpenErrors) as unknown;

    if (!Array.isArray(parsedOpenErrors)) {
      return [];
    }

    return parsedOpenErrors
      .filter((entryId): entryId is string => typeof entryId === 'string')
      .slice(0, 4);
  } catch {
    return [];
  }
}

function loadStarterRefreshHistory(): StarterRefreshHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const savedHistory = window.sessionStorage.getItem(starterRefreshHistoryStorageKey);

    if (savedHistory == null) {
      return [];
    }

    const parsedHistory = JSON.parse(savedHistory) as unknown;

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .flatMap((entry) => {
        if (
          entry != null &&
          typeof entry === 'object' &&
          'id' in entry &&
          'summary' in entry &&
          'detail' in entry &&
          'timestampLabel' in entry &&
          'tone' in entry &&
          typeof entry.id === 'string' &&
          typeof entry.summary === 'string' &&
          typeof entry.detail === 'string' &&
          typeof entry.timestampLabel === 'string' &&
          (entry.tone === 'success' || entry.tone === 'error')
        ) {
          const rawContextLabels =
            'contextLabels' in entry && Array.isArray(entry.contextLabels)
              ? (entry.contextLabels as unknown[])
              : [];
          const contextLabels = rawContextLabels
            .filter((label): label is string => typeof label === 'string')
            .slice(0, 3);
          const rawDetailValue = 'rawDetail' in entry ? entry.rawDetail : undefined;
          const rawDetail =
            typeof rawDetailValue === 'string'
              ? rawDetailValue
              : rawDetailValue === null
                ? null
                : entry.tone === 'error'
                  ? entry.detail
                  : null;
          const rawTimestampMs = 'timestampMs' in entry ? entry.timestampMs : undefined;
          const inferredTimestampMs = Number.parseInt(entry.id.split('-')[0] ?? '', 10);
          const timestampMs =
            typeof rawTimestampMs === 'number' && Number.isFinite(rawTimestampMs) && rawTimestampMs > 0
              ? rawTimestampMs
              : Number.isFinite(inferredTimestampMs) && inferredTimestampMs > 0
                ? inferredTimestampMs
                : null;
          const actionKind =
            'actionKind' in entry &&
            (entry.actionKind === 'created' ||
              entry.actionKind === 'refreshed' ||
              entry.actionKind === 'aligned' ||
              entry.actionKind === 'failed')
              ? entry.actionKind
              : inferStarterRefreshHistoryKind(entry.summary, entry.tone);

          return [
            {
              id: entry.id,
              summary: entry.summary,
              detail:
                entry.tone === 'error' && rawDetail != null
                  ? 'Request failed. Expand raw error for details.'
                  : entry.detail,
              rawDetail,
              timestampLabel: entry.timestampLabel,
              timestampMs,
              tone: entry.tone,
              actionKind,
              contextLabels,
            } satisfies StarterRefreshHistoryEntry,
          ];
        }

        return [];
      })
      .slice(0, 4);
  } catch {
    return [];
  }
}

function buildStarterRefreshHistoryContextLabels(options: {
  versionNumber?: number | null;
  versionStatus?: string | null;
  ownerPrincipalKey?: string | null;
}): string[] {
  const contextLabels: string[] = [];

  if (options.versionNumber != null) {
    contextLabels.push(`v${options.versionNumber}`);
  }

  if (options.versionStatus != null) {
    contextLabels.push(options.versionStatus);
  }

  if (options.ownerPrincipalKey != null) {
    contextLabels.push(`Owner ${options.ownerPrincipalKey}`);
  }

  return contextLabels.slice(0, 3);
}

function persistStarterRefreshHistory(history: StarterRefreshHistoryEntry[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (history.length === 0) {
      window.sessionStorage.removeItem(starterRefreshHistoryStorageKey);
      return;
    }

    window.sessionStorage.setItem(starterRefreshHistoryStorageKey, JSON.stringify(history));
  } catch {
    return;
  }
}

function persistStarterRefreshHistoryFilter(filter: StarterRefreshHistoryFilter): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (filter === 'all') {
      window.sessionStorage.removeItem(starterRefreshHistoryFilterStorageKey);
      return;
    }

    window.sessionStorage.setItem(starterRefreshHistoryFilterStorageKey, filter);
  } catch {
    return;
  }
}

function persistStarterRefreshHistoryOpenErrors(openEntryIds: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (openEntryIds.length === 0) {
      window.sessionStorage.removeItem(starterRefreshHistoryOpenErrorsStorageKey);
      return;
    }

    window.sessionStorage.setItem(
      starterRefreshHistoryOpenErrorsStorageKey,
      JSON.stringify(openEntryIds),
    );
  } catch {
    return;
  }
}

function isScorecardPanel(
  panel: PanelRef | undefined,
): panel is PanelRef & {
  kind: 'scorecard';
  query: NonNullable<PanelRef['query']>;
  scorecard: NonNullable<PanelRef['scorecard']>;
} {
  return panel?.kind === 'scorecard' && panel.query != null && panel.scorecard != null;
}

function isTablePanel(
  panel: PanelRef | undefined,
): panel is PanelRef & {
  kind: 'table';
  query: NonNullable<PanelRef['query']>;
  table: NonNullable<PanelRef['table']>;
} {
  return panel?.kind === 'table' && panel.query != null && panel.table != null;
}

function isChartPanel(
  panel: PanelRef | undefined,
): panel is PanelRef & {
  kind: 'line' | 'bar' | 'pie';
  query: NonNullable<PanelRef['query']>;
} {
  return (
    (panel?.kind === 'line' || panel?.kind === 'bar' || panel?.kind === 'pie') &&
    panel.query != null
  );
}

function isNoticePanel(panel: PanelRef | undefined): panel is PanelRef & { kind: 'notice' } {
  return panel?.kind === 'notice';
}

const launchTracks = [
  {
    title: 'Live Runtime Surface',
    body: '웹 셸이 이제 실제 API 응답을 읽어 실행 상태, 다음 구현 순서, 접근 가능한 엔드포인트를 바로 보여줍니다.',
  },
  {
    title: 'Identity & Permissions',
    body: '다음 파동은 이메일 인증, 승인 플로우, 시스템 역할과 dataset grant를 실제 런타임 정책으로 연결하는 작업입니다.',
  },
  {
    title: 'Governed Query Path',
    body: 'Dataset manifest와 QuerySpec validation이 이제 live contract로 올라왔고, 현재 web shell에서 API reference까지 바로 확인할 수 있습니다.',
  },
];

function getStatusLabel(status: DeliveryStep['status']): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'in_progress':
      return 'In Progress';
    default:
      return 'Next';
  }
}

function getStatusClassName(status: DeliveryStep['status']): string {
  switch (status) {
    case 'done':
      return 'stepStatus stepStatusDone';
    case 'in_progress':
      return 'stepStatus stepStatusInProgress';
    default:
      return 'stepStatus stepStatusNext';
  }
}

function getServiceUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return new URL(href, API_ORIGIN).toString();
}

function getMethodClassName(method: ApiEndpointReference['method']): string {
  switch (method) {
    case 'POST':
      return 'methodBadge methodBadgePost';
    case 'PUT':
      return 'methodBadge methodBadgePut';
    case 'DELETE':
      return 'methodBadge methodBadgeDelete';
    default:
      return 'methodBadge methodBadgeGet';
  }
}

function formatJsonValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatQueryCellValue(value: QueryResultValue | undefined): string {
  if (typeof value === 'number') {
    return numberFormatter.format(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value ?? '';
}

function formatScorecardValue(
  value: QueryResultValue | undefined,
  valuePrefix?: string,
  valueSuffix?: string,
): string {
  const formattedValue = formatQueryCellValue(value);

  if (formattedValue.length === 0) {
    return 'No data';
  }

  return `${valuePrefix ?? ''}${formattedValue}${valueSuffix ?? ''}`;
}

function formatPlacementLabel(placement: PanelPlacement): string {
  return `Placement ${placement.x},${placement.y} · ${placement.width}×${placement.height}`;
}

function getRuntimeChartData(
  panel: PanelRef,
  runtime: PanelRuntimeEntry | undefined,
): RuntimeChartDatum[] {
  if (panel.query == null || runtime?.state !== 'ready' || runtime.data == null) {
    return [];
  }

  const metricField = panel.query.metrics[0]?.key;

  if (metricField == null) {
    return [];
  }

  const dimensionField = panel.query.dimensions[0];

  return runtime.data.results.reduce<RuntimeChartDatum[]>((entries, row, index) => {
    const rawMetricValue = row[metricField];
    const numericValue =
      typeof rawMetricValue === 'number'
        ? rawMetricValue
        : typeof rawMetricValue === 'string' && rawMetricValue.trim().length > 0
          ? Number(rawMetricValue)
          : null;

    if (numericValue == null || !Number.isFinite(numericValue)) {
      return entries;
    }

    const rawLabelValue = dimensionField != null ? row[dimensionField] : undefined;
    const label =
      typeof rawLabelValue === 'string' && rawLabelValue.length > 0
        ? rawLabelValue
        : rawLabelValue != null
          ? String(rawLabelValue)
          : `Row ${index + 1}`;

    entries.push({
      label,
      value: numericValue,
      formattedValue: formatQueryCellValue(rawMetricValue),
    });

    return entries;
  }, []);
}

function getRuntimeNoticeFacts(runtime: PanelRuntimeEntry | undefined): RuntimeNoticeFact[] {
  if (runtime?.state !== 'ready' || runtime.data == null) {
    return [];
  }

  const firstRow = runtime.data.results[0];

  if (firstRow == null) {
    return [];
  }

  return runtime.data.columnNames.slice(0, 4).map((columnName) => ({
    label: columnName,
    value: formatQueryCellValue(firstRow[columnName]),
  }));
}

function getRuntimeLineChartPath(chartData: RuntimeChartDatum[]): string {
  if (chartData.length === 0) {
    return '';
  }

  const maxValue = Math.max(...chartData.map((datum) => datum.value), 1);

  return chartData
    .map((datum, index) => {
      const x = chartData.length === 1 ? 50 : 8 + (84 * index) / (chartData.length - 1);
      const y = 90 - (datum.value / maxValue) * 68;

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function getRuntimePieChartBackground(chartData: RuntimeChartDatum[]): string {
  const total = chartData.reduce((sum, datum) => sum + datum.value, 0);

  if (total <= 0) {
    return 'rgba(24, 34, 45, 0.08)';
  }

  let currentOffset = 0;

  return `conic-gradient(${chartData
    .map((datum, index) => {
      const startOffset = (currentOffset / total) * 360;

      currentOffset += datum.value;

      return `${runtimeChartColors[index % runtimeChartColors.length]} ${startOffset.toFixed(2)}deg ${((currentOffset / total) * 360).toFixed(2)}deg`;
    })
    .join(', ')})`;
}

function formatRuntimeCanvasLabel(
  page: DashboardPage,
  gridMetrics: RuntimeGridMetrics,
): string {
  return `Canvas ${page.width}×${page.height}px · Snap ${page.snapGrid.columnWidth}×${page.snapGrid.rowHeight}px · ${gridMetrics.columnCount}×${gridMetrics.rowCount} cells`;
}

function clampRuntimeCanvasZoomPercent(zoomPercent: number): number {
  return clampGridValue(
    zoomPercent,
    runtimeCanvasZoomPercentMin,
    runtimeCanvasZoomPercentMax,
  );
}

function getNextRuntimeCanvasZoomPercent(
  currentZoomPercent: number,
  direction: 'in' | 'out',
): number {
  return clampRuntimeCanvasZoomPercent(
    currentZoomPercent + (direction === 'in' ? runtimeCanvasZoomPercentStep : -runtimeCanvasZoomPercentStep),
  );
}

function getRuntimeCanvasScaleFactor(
  scaleMode: RuntimeCanvasScaleMode,
  zoomPercent: number,
): number {
  const baseScale = scaleMode === 'detail' ? 1.35 : 1;

  return (baseScale * clampRuntimeCanvasZoomPercent(zoomPercent)) / 100;
}

function clampGridValue(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getRuntimeGridMetrics(page: DashboardPage): RuntimeGridMetrics {
  const previewRowSizePx = Math.max(12, Math.min(20, Math.round(page.snapGrid.rowHeight * 0.7)));

  return {
    columnCount: Math.max(1, Math.round(page.width / page.snapGrid.columnWidth)),
    rowCount: Math.max(1, Math.round(page.height / page.snapGrid.rowHeight)),
    columnWidth: page.snapGrid.columnWidth,
    rowHeight: page.snapGrid.rowHeight,
    previewRowSizePx,
    previewHeightPx: Math.max(
      360,
      Math.min(780, Math.round((page.height / page.snapGrid.rowHeight) * previewRowSizePx)),
    ),
  };
}

function getRuntimeCanvasStyle(
  page: DashboardPage,
  gridMetrics: RuntimeGridMetrics,
  scaleFactor: number,
): RuntimeGridStyle {
  return {
    aspectRatio: `${page.width} / ${page.height}`,
    width: scaleFactor === 1 ? '100%' : `calc(100% * ${scaleFactor})`,
    minHeight: `${Math.round(gridMetrics.previewHeightPx * scaleFactor)}px`,
    '--runtime-grid-columns': String(gridMetrics.columnCount),
    '--runtime-grid-rows': String(gridMetrics.rowCount),
    '--runtime-grid-row-size': `${Math.round(gridMetrics.previewRowSizePx * scaleFactor)}px`,
  };
}

function getRuntimePanelStyle(
  placement: PanelPlacement,
  gridMetrics: RuntimeGridMetrics,
): RuntimeGridStyle {
  const columnStart = clampGridValue(
    Math.floor(placement.x / gridMetrics.columnWidth) + 1,
    1,
    gridMetrics.columnCount,
  );
  const rowStart = clampGridValue(
    Math.floor(placement.y / gridMetrics.rowHeight) + 1,
    1,
    gridMetrics.rowCount,
  );
  const columnSpan = clampGridValue(
    Math.ceil(placement.width / gridMetrics.columnWidth),
    1,
    gridMetrics.columnCount - columnStart + 1,
  );
  const rowSpan = clampGridValue(
    Math.ceil(placement.height / gridMetrics.rowHeight),
    1,
    gridMetrics.rowCount - rowStart + 1,
  );

  return {
    '--runtime-col-start': String(columnStart),
    '--runtime-col-span': String(columnSpan),
    '--runtime-row-start': String(rowStart),
    '--runtime-row-span': String(rowSpan),
  };
}

function getDefaultDashboardPageId(dashboardDocument: DashboardDocument): string | null {
  return dashboardDocument.pages[0]?.id ?? null;
}

function getActiveDashboardPage(dashboardDocument: DashboardDocument, pageId: string | null) {
  if (pageId != null) {
    const selectedPage = dashboardDocument.pages.find((page) => page.id === pageId);

    if (selectedPage != null) {
      return selectedPage;
    }
  }

  return dashboardDocument.pages[0] ?? null;
}

function getDashboardRuntimePanelEntries(
  dashboardDocument: DashboardDocument,
  pageId: string | null,
): RuntimePanelEntry[] {
  const activePage = getActiveDashboardPage(dashboardDocument, pageId);

  if (activePage == null) {
    return [];
  }

  const panelsById = new Map(dashboardDocument.panelLibrary.map((panel) => [panel.id, panel]));
  const runtimeEntries = activePage.placements.reduce<Array<RuntimePanelEntry & { order: number }>>(
    (entries, placement, order) => {
      const panel = panelsById.get(placement.panelId);

      if (panel != null) {
        entries.push({
          panel,
          placement,
          order,
        });
      }

      return entries;
    },
    [],
  );

  runtimeEntries.sort(
    (left, right) =>
      left.placement.y - right.placement.y ||
      left.placement.x - right.placement.x ||
      left.placement.zIndex - right.placement.zIndex ||
      left.order - right.order,
  );

  return runtimeEntries.map(({ order: _order, ...entry }) => entry);
}

function buildInitialPanelRuntime(
  dashboardDocument: DashboardDocument,
  pageId: string | null,
): Record<string, PanelRuntimeEntry> {
  return getDashboardRuntimePanelEntries(dashboardDocument, pageId).reduce<Record<string, PanelRuntimeEntry>>(
    (state, { panel }) => {
      if (panel.query != null) {
        state[panel.id] = {
          state: 'loading',
          data: null,
          errorMessage: null,
        };
      }

      return state;
    },
    {},
  );
}

async function getResponseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as {
      detail?: { message?: string } | string;
    };

    if (typeof payload.detail === 'string' && payload.detail.length > 0) {
      return payload.detail;
    }

    if (typeof payload.detail === 'object' && payload.detail?.message) {
      return payload.detail.message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [system, setSystem] = useState<SystemResponse | null>(null);
  const [apiReference, setApiReference] = useState<ApiReferenceResponse | null>(null);
  const [dashboardSummaries, setDashboardSummaries] = useState<DashboardSummaryResponse[]>([]);
  const [dashboardVersions, setDashboardVersions] = useState<DashboardVersionSummaryResponse[]>([]);
  const [selectedDashboardSlug, setSelectedDashboardSlug] = useState<string>(starterDashboard.key);
  const [selectedDashboardVersionNumber, setSelectedDashboardVersionNumber] = useState<number | null>(
    null,
  );
  const [dashboardDirectoryState, setDashboardDirectoryState] = useState<RequestState>('loading');
  const [dashboardDirectoryErrorMessage, setDashboardDirectoryErrorMessage] = useState<string | null>(null);
  const [dashboardDocument, setDashboardDocument] = useState<DashboardDocument>(starterDashboard);
  const [activePageId, setActivePageId] = useState<string | null>(() =>
    getDefaultDashboardPageId(starterDashboard),
  );
  const [dashboardSourceLabel, setDashboardSourceLabel] = useState<string>('Starter seed');
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [dashboardNoticeTone, setDashboardNoticeTone] = useState<'default' | 'error' | 'success'>('default');
  const [persistedDashboardVersion, setPersistedDashboardVersion] = useState<number | null>(null);
  const [persistedDashboardUpdatedAt, setPersistedDashboardUpdatedAt] = useState<string | null>(null);
  const [persistedDashboardVersionStatus, setPersistedDashboardVersionStatus] = useState<string | null>(
    null,
  );
  const [dashboardOwnerPrincipalKey, setDashboardOwnerPrincipalKey] = useState<string | null>(null);
  const [starterRefreshOutcome, setStarterRefreshOutcome] = useState<StarterRefreshOutcome>(null);
  const [starterRefreshHistory, setStarterRefreshHistory] = useState<StarterRefreshHistoryEntry[]>(() =>
    loadStarterRefreshHistory(),
  );
  const [starterRefreshHistoryFilter, setStarterRefreshHistoryFilter] =
    useState<StarterRefreshHistoryFilter>(() => loadStarterRefreshHistoryFilter());
  const [openStarterRefreshHistoryErrors, setOpenStarterRefreshHistoryErrors] = useState<string[]>(
    () => loadStarterRefreshHistoryOpenErrors(),
  );
  const [isClearStarterHistoryArmed, setIsClearStarterHistoryArmed] = useState<boolean>(false);
  const [runtimeCanvasScaleMode, setRuntimeCanvasScaleMode] =
    useState<RuntimeCanvasScaleMode>('fit');
  const [runtimeCanvasZoomPercent, setRuntimeCanvasZoomPercent] = useState<number>(
    runtimeCanvasZoomPercentDefault,
  );
  const [isRefreshingStarterDashboard, setIsRefreshingStarterDashboard] = useState<boolean>(false);
  const [panelRuntime, setPanelRuntime] = useState<Record<string, PanelRuntimeEntry>>(() =>
    buildInitialPanelRuntime(starterDashboard, getDefaultDashboardPageId(starterDashboard)),
  );
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function applyDashboardPayload(payload: DashboardApiResponse): void {
    const isViewingLatestDashboardVersion = payload.document.version === payload.latestVersionNumber;

    setDashboardDocument(payload.document);
    setDashboardVersions(payload.versions);
    setSelectedDashboardSlug(payload.slug);
    setDashboardSourceLabel(
      isViewingLatestDashboardVersion
        ? `Persisted v${payload.latestVersionNumber}`
        : `Viewing v${payload.document.version} · latest v${payload.latestVersionNumber}`,
    );
    setPersistedDashboardVersion(payload.latestVersionNumber);
    setPersistedDashboardUpdatedAt(payload.updatedAt);
    setPersistedDashboardVersionStatus(payload.latestVersionStatus);
    setDashboardOwnerPrincipalKey(payload.ownerPrincipalKey);
  }

  function applyStarterSeedFallback(notice: string, tone: 'default' | 'error'): void {
    setDashboardDocument(starterDashboard);
    setDashboardVersions([]);
    setDashboardSourceLabel('Starter seed');
    setPersistedDashboardVersion(null);
    setPersistedDashboardUpdatedAt(null);
    setPersistedDashboardVersionStatus(null);
    setDashboardOwnerPrincipalKey(null);
    setSelectedDashboardVersionNumber(null);
    setStarterRefreshOutcome(null);
    setDashboardNotice(notice);
    setDashboardNoticeTone(tone);
  }

  function recordStarterRefreshHistory(
    summary: string,
    detail: string,
    tone: StarterRefreshHistoryTone,
    actionKind: StarterRefreshHistoryKind | null,
    contextLabels: string[] = [],
    rawDetail: string | null = null,
  ): void {
    const timestampMs = Date.now();
    const timestampLabel = dateTimeFormatter.format(new Date(timestampMs));

    setStarterRefreshHistory((currentHistory) => [
      {
        id: `${timestampMs}-${currentHistory.length}`,
        summary,
        detail,
        rawDetail,
        timestampLabel,
        timestampMs,
        tone,
        actionKind,
        contextLabels: contextLabels.slice(0, 3),
      },
      ...currentHistory,
    ].slice(0, 4));
  }

  function clearStarterRefreshHistory(): void {
    setIsClearStarterHistoryArmed(false);
    setStarterRefreshHistory([]);
    setStarterRefreshOutcome(null);
    setDashboardNotice('Cleared recent starter actions for this browser session.');
    setDashboardNoticeTone('default');
  }

  function handleClearStarterRefreshHistory(): void {
    if (!isClearStarterHistoryArmed) {
      setIsClearStarterHistoryArmed(true);
      return;
    }

    clearStarterRefreshHistory();
  }

  function setStarterRefreshHistoryErrorOpenState(entryId: string, isOpen: boolean): void {
    setOpenStarterRefreshHistoryErrors((currentOpenEntryIds) => {
      if (isOpen) {
        return Array.from(new Set([...currentOpenEntryIds, entryId]));
      }

      return currentOpenEntryIds.filter((currentEntryId) => currentEntryId !== entryId);
    });
  }

  async function loadDashboardDirectory(signal?: AbortSignal): Promise<void> {
    try {
      setDashboardDirectoryState('loading');
      setDashboardDirectoryErrorMessage(null);

      const response = await fetch(`${API_BASE_URL}/dashboards`, { signal });

      if (!response.ok) {
        throw new Error(
          await getResponseMessage(response, 'Unable to load dashboards from the metadata store.'),
        );
      }

      const payload = (await response.json()) as DashboardSummaryResponse[];

      if (signal?.aborted) {
        return;
      }

      setDashboardSummaries(payload);
      setSelectedDashboardSlug((currentSlug) =>
        payload.some((summary) => summary.slug === currentSlug)
          ? currentSlug
          : payload[0]?.slug ?? starterDashboard.key,
      );
      setDashboardDirectoryState('ready');
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setDashboardDirectoryState('error');
      setDashboardDirectoryErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load dashboards from the metadata store.',
      );
    }
  }

  async function loadDashboardDocument(
    slug: string,
    versionNumber: number | null,
    signal?: AbortSignal,
  ): Promise<void> {
    const requestedDashboardLabel =
      versionNumber != null ? `dashboard '${slug}' version ${versionNumber}` : `dashboard '${slug}'`;

    try {
      setDashboardNotice(null);
      setDashboardNoticeTone('default');

      const dashboardHref =
        versionNumber != null
          ? `${API_BASE_URL}/dashboards/${slug}?version=${versionNumber}`
          : `${API_BASE_URL}/dashboards/${slug}`;

      const response = await fetch(dashboardHref, {
        signal,
      });

      if (response.status === 404) {
        if (signal?.aborted) {
          return;
        }

        if (slug === starterDashboard.key && versionNumber == null) {
          applyStarterSeedFallback(
            `Persisted dashboard '${starterDashboard.key}' was not found yet. Using the starter document.`,
            'default',
          );
          return;
        }

        throw new Error(`${requestedDashboardLabel} was not found.`);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getResponseMessage(
            response,
            `Unable to load ${requestedDashboardLabel}.`,
          ),
        );
      }

      const payload = (await response.json()) as DashboardApiResponse;

      if (signal?.aborted) {
        return;
      }

      applyDashboardPayload(payload);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      if (slug === starterDashboard.key && versionNumber == null) {
        applyStarterSeedFallback(
          error instanceof Error
            ? `${error.message} Using the starter document instead.`
            : `Unable to load dashboard '${starterDashboard.key}'. Using the starter document instead.`,
          'error',
        );
        return;
      }

      setDashboardNotice(
        error instanceof Error ? error.message : `Unable to load ${requestedDashboardLabel}.`,
      );
      setDashboardNoticeTone('error');
    }
  }

  async function handleRefreshStarterDashboard(): Promise<void> {
    const previousPersistedVersion = persistedDashboardVersion;

    try {
      setIsClearStarterHistoryArmed(false);
      setIsRefreshingStarterDashboard(true);
      setDashboardNotice(null);
      setDashboardNoticeTone('default');

      const response = await fetch(
        `${API_BASE_URL}/dashboards/${starterDashboard.key}/refresh-starter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await getResponseMessage(
            response,
            `Unable to refresh starter dashboard '${starterDashboard.key}'.`,
          ),
        );
      }

      const payload = (await response.json()) as DashboardApiResponse;

      setSelectedDashboardVersionNumber(null);
      applyDashboardPayload(payload);
      const historyActionKind =
        previousPersistedVersion == null
          ? 'created'
          : payload.latestVersionNumber > previousPersistedVersion
            ? 'refreshed'
            : 'aligned';
      const historySummary = getStarterRefreshHistorySummary(historyActionKind);
      const historyDetail =
        previousPersistedVersion == null
          ? `Persisted as v${payload.latestVersionNumber}.`
          : payload.latestVersionNumber > previousPersistedVersion
            ? `Advanced v${previousPersistedVersion} -> v${payload.latestVersionNumber}.`
            : `No version change; stayed at v${payload.latestVersionNumber}.`;

      setDashboardNotice(
        previousPersistedVersion == null
          ? `Starter dashboard '${payload.slug}' is now persisted as version ${payload.latestVersionNumber}.`
          : payload.latestVersionNumber > previousPersistedVersion
            ? `Starter dashboard '${payload.slug}' refreshed to persisted version ${payload.latestVersionNumber}.`
            : `Starter dashboard '${payload.slug}' is already aligned at persisted version ${payload.latestVersionNumber}.`,
      );
      setStarterRefreshOutcome(
        previousPersistedVersion == null
          ? 'created'
          : payload.latestVersionNumber > previousPersistedVersion
            ? 'refreshed'
            : 'aligned',
      );
      recordStarterRefreshHistory(
        historySummary,
        historyDetail,
        'success',
        historyActionKind,
        buildStarterRefreshHistoryContextLabels({
          versionNumber: payload.latestVersionNumber,
          versionStatus: payload.latestVersionStatus,
          ownerPrincipalKey: payload.ownerPrincipalKey,
        }),
      );
      setDashboardNoticeTone('success');
      void loadDashboardDirectory();
    } catch (error) {
      const refreshErrorMessage =
        error instanceof Error
          ? error.message
          : `Unable to refresh starter dashboard '${starterDashboard.key}'.`;

      setStarterRefreshOutcome(null);
      recordStarterRefreshHistory(
        getStarterRefreshHistorySummary('failed'),
        'Request failed. Expand raw error for details.',
        'error',
        'failed',
        buildStarterRefreshHistoryContextLabels({
          versionNumber: persistedDashboardVersion,
          versionStatus: persistedDashboardVersionStatus,
          ownerPrincipalKey: dashboardOwnerPrincipalKey,
        }),
        refreshErrorMessage,
      );
      setDashboardNotice(
        refreshErrorMessage,
      );
      setDashboardNoticeTone('error');
    } finally {
      setIsRefreshingStarterDashboard(false);
    }
  }

  function resetRuntimeCanvasView(): void {
    setRuntimeCanvasScaleMode('fit');
    setRuntimeCanvasZoomPercent(runtimeCanvasZoomPercentDefault);
  }

  function stepRuntimeCanvasZoom(direction: 'in' | 'out'): void {
    setRuntimeCanvasZoomPercent((currentZoomPercent) =>
      getNextRuntimeCanvasZoomPercent(currentZoomPercent, direction),
    );
  }

  function handleRuntimeCanvasKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      stepRuntimeCanvasZoom('in');
      return;
    }

    if (event.key === '-') {
      event.preventDefault();
      stepRuntimeCanvasZoom('out');
      return;
    }

    if (event.key === '0') {
      event.preventDefault();
      resetRuntimeCanvasView();
    }
  }

  function handleRuntimeCanvasWheel(event: WheelEvent<HTMLDivElement>): void {
    if (!event.altKey) {
      return;
    }

    event.preventDefault();
    stepRuntimeCanvasZoom(event.deltaY < 0 ? 'in' : 'out');
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadBootstrapState() {
      try {
        setRequestState('loading');
        setErrorMessage(null);

        const [overviewResponse, systemResponse, referenceResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/overview`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/system`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/reference/apis`, { signal: controller.signal }),
        ]);

        if (!overviewResponse.ok || !systemResponse.ok || !referenceResponse.ok) {
          throw new Error('Live bootstrap API is not responding yet.');
        }

        const [overviewPayload, systemPayload, referencePayload] = await Promise.all([
          overviewResponse.json() as Promise<OverviewResponse>,
          systemResponse.json() as Promise<SystemResponse>,
          referenceResponse.json() as Promise<ApiReferenceResponse>,
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setOverview(overviewPayload);
        setSystem(systemPayload);
        setApiReference(referencePayload);
        setRequestState('ready');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load the live bootstrap API.',
        );
      }
    }

    void loadBootstrapState();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboardDirectory(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboardDocument(selectedDashboardSlug, selectedDashboardVersionNumber, controller.signal);

    return () => {
      controller.abort();
    };
  }, [selectedDashboardSlug, selectedDashboardVersionNumber]);

  useEffect(() => {
    setSelectedDashboardVersionNumber(null);
  }, [selectedDashboardSlug]);

  useEffect(() => {
    persistStarterRefreshHistory(starterRefreshHistory);
  }, [starterRefreshHistory]);

  useEffect(() => {
    persistStarterRefreshHistoryFilter(starterRefreshHistoryFilter);
  }, [starterRefreshHistoryFilter]);

  useEffect(() => {
    persistStarterRefreshHistoryOpenErrors(openStarterRefreshHistoryErrors);
  }, [openStarterRefreshHistoryErrors]);

  useEffect(() => {
    if (!isClearStarterHistoryArmed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsClearStarterHistoryArmed(false);
    }, clearStarterHistoryConfirmTimeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isClearStarterHistoryArmed]);

  useEffect(() => {
    setIsClearStarterHistoryArmed(false);
  }, [starterRefreshHistory]);

  useEffect(() => {
    const validOpenEntryIds = new Set(
      starterRefreshHistory
        .filter((entry) => entry.rawDetail != null)
        .map((entry) => entry.id),
    );

    setOpenStarterRefreshHistoryErrors((currentOpenEntryIds) => {
      const nextOpenEntryIds = currentOpenEntryIds.filter((entryId) =>
        validOpenEntryIds.has(entryId),
      );

      return nextOpenEntryIds.length === currentOpenEntryIds.length
        ? currentOpenEntryIds
        : nextOpenEntryIds;
    });
  }, [starterRefreshHistory]);

  useEffect(() => {
    if (
      starterRefreshHistoryFilter !== 'all' &&
      starterRefreshHistory.every((entry) => entry.actionKind !== starterRefreshHistoryFilter)
    ) {
      setStarterRefreshHistoryFilter('all');
    }
  }, [starterRefreshHistory, starterRefreshHistoryFilter]);

  useEffect(() => {
    setActivePageId((currentPageId) => {
      if (
        currentPageId != null &&
        dashboardDocument.pages.some((page) => page.id === currentPageId)
      ) {
        return currentPageId;
      }

      return getDefaultDashboardPageId(dashboardDocument);
    });
  }, [dashboardDocument]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardRuntimePanels() {
      const runtimePanelEntries = getDashboardRuntimePanelEntries(dashboardDocument, activePageId);

      setPanelRuntime(buildInitialPanelRuntime(dashboardDocument, activePageId));

      for (const { panel } of runtimePanelEntries) {
        if (panel.query == null) {
          continue;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/query/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(panel.query),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              await getResponseMessage(
                response,
                `${panel.title} is waiting for analytics data and connector access.`,
              ),
            );
          }

          const payload = (await response.json()) as QueryExecutionResponse;

          if (controller.signal.aborted) {
            return;
          }

          setPanelRuntime((currentState) => ({
            ...currentState,
            [panel.id]: {
              state: 'ready',
              data: payload,
              errorMessage: null,
            },
          }));
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setPanelRuntime((currentState) => ({
            ...currentState,
            [panel.id]: {
              state: 'error',
              data: null,
              errorMessage:
                error instanceof Error
                  ? error.message
                  : `Unable to execute the ${panel.title} panel preview.`,
            },
          }));
        }
      }
    }

    void loadDashboardRuntimePanels();

    return () => {
      controller.abort();
    };
  }, [activePageId, dashboardDocument]);

  const liveRoles = system?.roles ?? systemRoles;
  const liveDataSources = system?.dataSources ?? dataSourceKinds;
  const liveModules = system?.modules ?? [];
  const activeDashboardPage = getActiveDashboardPage(dashboardDocument, activePageId);
  const dashboardRuntimePanelEntries = getDashboardRuntimePanelEntries(dashboardDocument, activePageId);
  const selectedDashboardSummary =
    dashboardSummaries.find((summary) => summary.slug === selectedDashboardSlug) ?? null;
  const dashboardVersionsByRecency = [...dashboardVersions].sort(
    (leftVersion, rightVersion) => rightVersion.versionNumber - leftVersion.versionNumber,
  );
  const latestDashboardVersionSummary = dashboardVersionsByRecency[0] ?? null;
  const selectedDashboardVersionSummary =
    dashboardVersions.find((version) => version.versionNumber === dashboardDocument.version) ??
    latestDashboardVersionSummary;
  const isViewingLatestDashboardVersion =
    selectedDashboardVersionSummary != null &&
    latestDashboardVersionSummary != null &&
    selectedDashboardVersionSummary.versionNumber === latestDashboardVersionSummary.versionNumber;
  const formattedSelectedDashboardVersionCreatedAt =
    selectedDashboardVersionSummary != null
      ? dateTimeFormatter.format(new Date(selectedDashboardVersionSummary.createdAt))
      : null;
  const isSelectedStarterDashboard = dashboardDocument.key === starterDashboard.key;
  const isPersistedStarterDashboard = isSelectedStarterDashboard && persistedDashboardVersion != null;
  const isBootstrapManagedStarterDashboard =
    isPersistedStarterDashboard && dashboardOwnerPrincipalKey === starterDashboardBootstrapOwnerKey;
  const isUserManagedStarterDashboard =
    isPersistedStarterDashboard && dashboardOwnerPrincipalKey !== starterDashboardBootstrapOwnerKey;
  const starterDashboardStatusLabel = !isPersistedStarterDashboard
    ? 'Starter seed only'
    : isBootstrapManagedStarterDashboard
      ? `Bootstrap-managed v${persistedDashboardVersion}`
      : `User-managed v${persistedDashboardVersion}`;
  const starterDashboardStatusMessage = !isPersistedStarterDashboard
    ? 'Refresh starter will persist the canonical mixed-panel starter dashboard into the metadata store.'
    : isBootstrapManagedStarterDashboard
      ? 'The backend can refresh this starter dashboard because it is still owned by system-bootstrap.'
      : 'Refresh starter is disabled because the persisted starter dashboard is now user-managed.';
  const isStarterRefreshDisabled =
    !isSelectedStarterDashboard || isRefreshingStarterDashboard || isUserManagedStarterDashboard;
  const refreshStarterTitle = !isSelectedStarterDashboard
    ? 'Starter refresh only applies to the canonical starter dashboard.'
    : isUserManagedStarterDashboard
      ? 'User-managed starter dashboards cannot be refreshed from the canonical seed.'
      : 'Create or refresh the canonical starter dashboard';
  const isClearStarterHistoryDisabled =
    isRefreshingStarterDashboard || starterRefreshHistory.length === 0;
  const clearStarterHistoryTitle =
    isClearStarterHistoryArmed
      ? `Click again within ${clearStarterHistoryConfirmTimeoutMs / 1000} seconds to clear recent starter actions saved for this browser session`
      : starterRefreshHistory.length > 0
      ? 'Clear recent starter actions saved for this browser session'
      : 'No recent starter actions saved for this browser session';
  const starterRefreshHistoryFilterCounts: Record<StarterRefreshHistoryKind, number> = {
    created: starterRefreshHistory.filter((entry) => entry.actionKind === 'created').length,
    refreshed: starterRefreshHistory.filter((entry) => entry.actionKind === 'refreshed').length,
    aligned: starterRefreshHistory.filter((entry) => entry.actionKind === 'aligned').length,
    failed: starterRefreshHistory.filter((entry) => entry.actionKind === 'failed').length,
  };
  const visibleStarterRefreshHistory =
    starterRefreshHistoryFilter === 'all'
      ? starterRefreshHistory
      : starterRefreshHistory.filter((entry) => entry.actionKind === starterRefreshHistoryFilter);
  const starterRefreshHistoryFilterOptions: Array<{
    id: StarterRefreshHistoryFilter;
    label: string;
    count?: number;
  }> = [
    {
      id: 'all',
      label: 'All',
    },
    {
      id: 'created',
      label: 'Created',
      count: starterRefreshHistoryFilterCounts.created,
    },
    {
      id: 'refreshed',
      label: 'Refreshed',
      count: starterRefreshHistoryFilterCounts.refreshed,
    },
    {
      id: 'aligned',
      label: 'Aligned',
      count: starterRefreshHistoryFilterCounts.aligned,
    },
    {
      id: 'failed',
      label: 'Failed',
      count: starterRefreshHistoryFilterCounts.failed,
    },
  ];
  const activeStarterRefreshHistoryFilterLabel = getStarterRefreshHistoryFilterLabel(
    starterRefreshHistoryFilter,
  );
  const activeStarterRefreshHistoryCount = visibleStarterRefreshHistory.length;
  const latestVisibleStarterRefreshHistoryEntry = visibleStarterRefreshHistory[0] ?? null;
  const latestVisibleStarterRefreshHistoryRelativeLabel =
    latestVisibleStarterRefreshHistoryEntry?.timestampMs != null
      ? formatRelativeTimeLabel(latestVisibleStarterRefreshHistoryEntry.timestampMs)
      : null;
  const latestFailedStarterRefreshHistoryEntry =
    starterRefreshHistory.find((entry) => entry.actionKind === 'failed') ?? null;
  const latestFailedStarterRefreshHistoryRelativeLabel =
    latestFailedStarterRefreshHistoryEntry?.timestampMs != null
      ? formatRelativeTimeLabel(latestFailedStarterRefreshHistoryEntry.timestampMs)
      : null;
  const openVisibleStarterRefreshHistoryErrorsCount = visibleStarterRefreshHistory.filter(
    (entry) => entry.rawDetail != null && openStarterRefreshHistoryErrors.includes(entry.id),
  ).length;
  const formattedPersistedDashboardUpdatedAt =
    persistedDashboardUpdatedAt != null
      ? dateTimeFormatter.format(new Date(persistedDashboardUpdatedAt))
      : null;
  const starterRefreshOutcomeLabel =
    starterRefreshOutcome === 'created'
      ? 'Created'
      : starterRefreshOutcome === 'refreshed'
        ? 'Refreshed'
        : starterRefreshOutcome === 'aligned'
          ? 'Already aligned'
          : null;
  const runtimeGridMetrics = activeDashboardPage ? getRuntimeGridMetrics(activeDashboardPage) : null;
  const runtimeCanvasScaleFactor = getRuntimeCanvasScaleFactor(
    runtimeCanvasScaleMode,
    runtimeCanvasZoomPercent,
  );
  const runtimeCanvasStyle =
    activeDashboardPage && runtimeGridMetrics
      ? getRuntimeCanvasStyle(activeDashboardPage, runtimeGridMetrics, runtimeCanvasScaleFactor)
      : undefined;
  const runtimeCanvasLabel =
    activeDashboardPage && runtimeGridMetrics
      ? formatRuntimeCanvasLabel(activeDashboardPage, runtimeGridMetrics)
      : null;
  const runtimeCanvasZoomLabel = `${Math.round(runtimeCanvasScaleFactor * 100)}%`;
  const isRuntimeCanvasZoomOutDisabled = runtimeCanvasZoomPercent <= runtimeCanvasZoomPercentMin;
  const isRuntimeCanvasZoomInDisabled = runtimeCanvasZoomPercent >= runtimeCanvasZoomPercentMax;
  const isRuntimeCanvasDefaultView =
    runtimeCanvasScaleMode === 'fit' && runtimeCanvasZoomPercent === runtimeCanvasZoomPercentDefault;
  const runtimePreviewLabel = activeDashboardPage
    ? `${activeDashboardPage.title} · ${dashboardRuntimePanelEntries.length} live panel${dashboardRuntimePanelEntries.length === 1 ? '' : 's'}`
    : `${dashboardRuntimePanelEntries.length} live runtime panel${dashboardRuntimePanelEntries.length === 1 ? '' : 's'}`;
  const runtimeSnapshotCards = [
    {
      label: 'Dashboard',
      value: dashboardDocument.title,
      detail: `${dashboardSourceLabel} · ${dashboardDocument.key}`,
    },
    {
      label: 'Active page',
      value: activeDashboardPage?.title ?? 'Unavailable',
      detail: `${dashboardDocument.pages.length} page${dashboardDocument.pages.length === 1 ? '' : 's'}`,
    },
    {
      label: 'Live panels',
      value: `${dashboardRuntimePanelEntries.length}`,
      detail: `${dashboardDocument.panelLibrary.length} library panel${dashboardDocument.panelLibrary.length === 1 ? '' : 's'}`,
    },
    {
      label: 'Ownership',
      value: dashboardOwnerPrincipalKey ?? 'Starter seed',
      detail:
        persistedDashboardVersion != null
          ? `v${persistedDashboardVersion} · ${persistedDashboardVersionStatus ?? 'status unavailable'}`
          : 'Not persisted yet',
    },
  ];
  const heroTitle = overview?.headline ?? 'Flexible enterprise dashboards for governed commerce analytics.';
  const heroSummary =
    overview?.summary ??
    'V1은 Linkmerce mart 기반 사내 대시보드 플랫폼으로 시작하고, 이후 다양한 데이터 소스와 커스텀 패널 SDK를 열어가는 구조로 설계합니다.';

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FLooks</p>
          <h1>{heroTitle}</h1>
          <p className="lede">{heroSummary}</p>
          <div className="heroMeta">
            <span className={`statusBadge statusBadge${requestState}`}>{requestState}</span>
            <span className="heroHint">
              {system ? `${system.name} · ${system.environment} · v${system.version}` : API_BASE_URL}
            </span>
          </div>
          <div className="heroActions" aria-label="Jump to live shell sections">
            <a className="heroAction" href="#dashboard-directory">
              Browse dashboards
            </a>
            <a className="heroAction heroActionPrimary" href="#live-dashboard-runtime">
              Open live dashboard preview
            </a>
            <a className="heroAction" href="#api-reference">
              Browse API reference
            </a>
          </div>
          {errorMessage ? <p className="inlineNotice">{errorMessage}</p> : null}
        </div>
        <div className="heroCard">
          <span className="heroCardLabel">Live Shell</span>
          <strong>{overview?.product ?? dashboardDocument.title}</strong>
          <span>{runtimePreviewLabel}</span>
          <span>
            {overview
              ? `${overview.metrics.length} live metrics · ${overview.execution_plan.length} planned slices`
              : 'Connecting the web shell to the API surface'}
          </span>
          <span>
            {system
              ? `${liveModules.length} modules · ${liveRoles.length} roles · ${liveDataSources.length} sources`
              : dashboardDocument.supportedDataSources.join(', ')}
          </span>
        </div>
      </header>

      <main className="grid">
        <section className="panel panelWide" id="dashboard-directory">
          <div className="panelHeader">
            <span className="chip">Dashboard Directory</span>
            <h2>Choose a live dashboard</h2>
            <p className="sectionSummary">
              The metadata store can already list versioned dashboards. Select one to load it into
              the live runtime preview below.
            </p>
            <p className="runtimeMeta">
              {dashboardSummaries.length} dashboard{dashboardSummaries.length === 1 ? '' : 's'} in
              the current store{selectedDashboardSummary ? ` · ${selectedDashboardSummary.title} loaded` : ''}
            </p>
          </div>
          {dashboardDirectoryState === 'error' ? (
            <p className="callout calloutError">
              {dashboardDirectoryErrorMessage ?? 'The dashboard directory is not reachable yet.'}
            </p>
          ) : dashboardSummaries.length > 0 ? (
            <div className="dashboardDirectory">
              {dashboardSummaries.map((summary) => {
                const isSelectedDashboard = summary.slug === selectedDashboardSlug;
                const formattedSummaryUpdatedAt = dateTimeFormatter.format(new Date(summary.updatedAt));

                return (
                  <button
                    type="button"
                    className={`dashboardDirectoryCard${isSelectedDashboard ? ' dashboardDirectoryCardActive' : ''}`}
                    key={summary.id}
                    onClick={() => setSelectedDashboardSlug(summary.slug)}
                    aria-pressed={isSelectedDashboard}
                    title={
                      isSelectedDashboard
                        ? `Dashboard '${summary.slug}' is loaded in the live runtime preview.`
                        : `Load dashboard '${summary.slug}' into the live runtime preview.`
                    }
                  >
                    <div className="dashboardDirectoryCardHeader">
                      <div>
                        <strong>{summary.title}</strong>
                        <p className="runtimeMeta">{summary.slug}</p>
                      </div>
                      <span
                        className={`runtimeStatusPill${isSelectedDashboard ? ' runtimeStatusPillManaged' : ''}`}
                      >
                        {isSelectedDashboard ? 'Loaded' : `v${summary.latestVersionNumber}`}
                      </span>
                    </div>
                    <p>
                      {summary.description ?? 'No description has been recorded for this dashboard yet.'}
                    </p>
                    <div className="dashboardDirectoryLabels" aria-label="Dashboard summary metadata">
                      <span className="dashboardDirectoryTag">v{summary.latestVersionNumber}</span>
                      <span className="dashboardDirectoryTag">{summary.latestVersionStatus}</span>
                      <span className="dashboardDirectoryTag">{summary.ownerPrincipalKey}</span>
                      <span className="dashboardDirectoryTag">Updated {formattedSummaryUpdatedAt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="callout">
              {dashboardDirectoryState === 'loading'
                ? 'Loading dashboards from the metadata store...'
                : 'No dashboards have been persisted yet.'}
            </p>
          )}
          {selectedDashboardSummary != null && dashboardVersionsByRecency.length > 0 ? (
            <div className="dashboardVersionSection">
              <div className="dashboardVersionHeader">
                <div>
                  <h3>Version history</h3>
                  <p className="runtimeMeta">
                    {isViewingLatestDashboardVersion
                      ? `Viewing latest v${dashboardDocument.version}`
                      : `Viewing v${dashboardDocument.version} · latest v${latestDashboardVersionSummary?.versionNumber ?? dashboardDocument.version}`}
                  </p>
                </div>
                {formattedSelectedDashboardVersionCreatedAt ? (
                  <p className="runtimeMeta">Created {formattedSelectedDashboardVersionCreatedAt}</p>
                ) : null}
              </div>
              <div className="pageSelector" aria-label="Dashboard versions">
                <button
                  type="button"
                  className={`pageTab${isViewingLatestDashboardVersion ? ' pageTabActive' : ''}`}
                  onClick={() => setSelectedDashboardVersionNumber(null)}
                >
                  Latest v{latestDashboardVersionSummary?.versionNumber ?? dashboardDocument.version}
                </button>
                {dashboardVersionsByRecency
                  .filter(
                    (versionSummary) =>
                      latestDashboardVersionSummary == null ||
                      versionSummary.versionNumber !== latestDashboardVersionSummary.versionNumber,
                  )
                  .map((versionSummary) => (
                    <button
                      type="button"
                      className={`pageTab${
                        !isViewingLatestDashboardVersion &&
                        versionSummary.versionNumber === dashboardDocument.version
                          ? ' pageTabActive'
                          : ''
                      }`}
                      key={`${selectedDashboardSummary.slug}-version-${versionSummary.versionNumber}`}
                      onClick={() => setSelectedDashboardVersionNumber(versionSummary.versionNumber)}
                    >
                      v{versionSummary.versionNumber}
                    </button>
                  ))}
              </div>
              {selectedDashboardVersionSummary ? (
                <div className="dashboardVersionSummary">
                  <p>
                    {selectedDashboardVersionSummary.summary ??
                      'No summary was recorded for this persisted dashboard revision.'}
                  </p>
                  <div className="dashboardDirectoryLabels" aria-label="Selected dashboard version metadata">
                    <span className="dashboardDirectoryTag">
                      {selectedDashboardVersionSummary.status}
                    </span>
                    <span className="dashboardDirectoryTag">
                      {selectedDashboardVersionSummary.createdBy}
                    </span>
                    {formattedSelectedDashboardVersionCreatedAt ? (
                      <span className="dashboardDirectoryTag">
                        Created {formattedSelectedDashboardVersionCreatedAt}
                      </span>
                    ) : null}
                    {!isViewingLatestDashboardVersion && latestDashboardVersionSummary ? (
                      <span className="dashboardDirectoryTag">
                        Latest v{latestDashboardVersionSummary.versionNumber}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">Launch Tracks</span>
            <h2>Implementation priorities</h2>
          </div>
          <div className="cards">
            {launchTracks.map((track) => (
              <article className="card" key={track.title}>
                <h3>{track.title}</h3>
                <p>{track.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">Live API</span>
            <h2>Runtime overview</h2>
          </div>
          {overview ? (
            <div className="metricGrid">
              {overview.metrics.map((metric) => (
                <article className="metricCard" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.note}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className={`callout ${requestState === 'error' ? 'calloutError' : ''}`}>
              {requestState === 'error'
                ? 'The API is not reachable yet. Bring up the compose stack to populate the live overview.'
                : `Loading live runtime data from ${API_BASE_URL}`}
            </p>
          )}
        </section>

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">Execution Plan</span>
            <h2>What happens next</h2>
          </div>
          {overview ? (
            <div className="stepList">
              {overview.execution_plan.map((step) => (
                <article className="stepItem" key={step.id}>
                  <div className="stepItemHeader">
                    <div>
                      <p className="kicker">Execution slice</p>
                      <h3>{step.title}</h3>
                    </div>
                    <span className={getStatusClassName(step.status)}>{getStatusLabel(step.status)}</span>
                  </div>
                  <p>{step.outcome}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="callout">The next-step sequence will appear here once the overview endpoint responds.</p>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <span className="chip">System Roles</span>
            <h2>Access model baseline</h2>
          </div>
          <ul className="list">
            {liveRoles.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <span className="chip">Data Sources</span>
            <h2>Connector roadmap</h2>
          </div>
          <ul className="list compact">
            {liveDataSources.map((kind) => (
              <li key={kind}>{kind}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <span className="chip">Service Links</span>
            <h2>Reachable API surfaces</h2>
          </div>
          {overview ? (
            <div className="linkList">
              {overview.service_links.map((link) => (
                <a
                  className="linkItem"
                  href={getServiceUrl(link.href)}
                  key={link.label}
                  rel="noreferrer"
                  target="_blank"
                >
                  <strong>{link.label}</strong>
                  <span className="linkUrl">{getServiceUrl(link.href)}</span>
                  <p>{link.description}</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="callout">OpenAPI, health, and live overview links appear here after the API responds.</p>
          )}
        </section>

        <section className="panel panelWide" id="api-reference">
          <div className="panelHeader">
            <span className="chip">API Reference</span>
            <h2>{apiReference?.title ?? 'FLooks API reference'}</h2>
            <p className="sectionSummary">
              {apiReference?.summary ?? 'The API reference panel will appear once the structured reference endpoint responds.'}
            </p>
          </div>
          {apiReference ? (
            <div className="referenceLayout">
              <div className="referenceViewerList">
                {apiReference.viewers.map((viewer) => (
                  <a
                    className="referenceViewer"
                    href={getServiceUrl(viewer.href)}
                    key={viewer.label}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <strong>{viewer.label}</strong>
                    <span className="linkUrl">{getServiceUrl(viewer.href)}</span>
                    <p>{viewer.description}</p>
                  </a>
                ))}
              </div>

              <div className="referenceList">
                {apiReference.endpoints.map((endpoint) => (
                  <details className="referenceCard" key={endpoint.id} open={endpoint.id === 'query-validate'}>
                    <summary className="referenceSummary">
                      <div className="referenceHeadline">
                        <span className={getMethodClassName(endpoint.method)}>{endpoint.method}</span>
                        <div>
                          <h3>{endpoint.summary}</h3>
                          <p className="referencePath">{endpoint.path}</p>
                        </div>
                      </div>
                      <a
                        className="referenceOpenApi"
                        href={getServiceUrl(endpoint.openapi_href)}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        rel="noreferrer"
                        target="_blank"
                      >
                        OpenAPI
                      </a>
                    </summary>

                    <div className="referenceBody">
                      <p className="referenceDescription">{endpoint.description}</p>

                      <div className="referenceSection">
                        <h4>Input parameters</h4>
                        {endpoint.parameters.length > 0 ? (
                          <div className="referenceFieldList">
                            {endpoint.parameters.map((parameter) => (
                              <article className="referenceField" key={`${endpoint.id}-${parameter.name}`}>
                                <div className="referenceFieldHeader">
                                  <strong>{parameter.name}</strong>
                                  <span>{parameter.type}</span>
                                  <span>{parameter.required ? 'Required' : 'Optional'}</span>
                                </div>
                                <p>{parameter.description}</p>
                                {parameter.enum_values.length > 0 ? (
                                  <p className="referenceMeta">Allowed: {parameter.enum_values.join(', ')}</p>
                                ) : null}
                                {parameter.example != null ? (
                                  <pre className="referenceCode">{formatJsonValue(parameter.example)}</pre>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="callout">This endpoint does not require input parameters.</p>
                        )}
                      </div>

                      <div className="referenceSection">
                        <h4>Responses</h4>
                        <div className="referenceResponseList">
                          {endpoint.responses.map((responseItem) => (
                            <article className="referenceResponse" key={`${endpoint.id}-${responseItem.status_code}`}>
                              <div className="referenceResponseHeader">
                                <span className="responseBadge">HTTP {responseItem.status_code}</span>
                                <p>{responseItem.description}</p>
                              </div>
                              <div className="referenceFieldList compactFields">
                                {responseItem.fields.map((field) => (
                                  <article className="referenceField" key={`${endpoint.id}-${responseItem.status_code}-${field.name}`}>
                                    <div className="referenceFieldHeader">
                                      <strong>{field.name}</strong>
                                      <span>{field.type}</span>
                                      <span>{field.required ? 'Required' : 'Optional'}</span>
                                    </div>
                                    <p>{field.description}</p>
                                    {field.enum_values.length > 0 ? (
                                      <p className="referenceMeta">Allowed: {field.enum_values.join(', ')}</p>
                                    ) : null}
                                    {field.example != null ? (
                                      <pre className="referenceCode">{formatJsonValue(field.example)}</pre>
                                    ) : null}
                                  </article>
                                ))}
                              </div>
                              {responseItem.example != null ? (
                                <pre className="referenceCode referenceCodeBlock">{formatJsonValue(responseItem.example)}</pre>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : (
            <p className={`callout ${requestState === 'error' ? 'calloutError' : ''}`}>
              {requestState === 'error'
                ? 'The structured API reference is not reachable yet.'
                : `Loading API reference data from ${API_BASE_URL}/reference/apis`}
            </p>
          )}
        </section>

        <section className="panel panelWide" id="live-dashboard-runtime">
          <div className="panelHeader">
            <span className="chip">Dashboard Runtime</span>
            <h2>Live dashboard preview</h2>
            <p className="sectionSummary">
              The web shell reads first-party panel definitions from the active dashboard page,
              preserves their placement order, and executes each supported panel through the live
              query execution API.
            </p>
            <div className="runtimeSnapshot" aria-label="Dashboard runtime summary">
              {runtimeSnapshotCards.map((card) => (
                <article className="runtimeSnapshotCard" key={card.label}>
                  <span className="runtimeSnapshotLabel">{card.label}</span>
                  <strong>{card.value}</strong>
                  <p className="runtimeMeta">{card.detail}</p>
                </article>
              ))}
            </div>
            <div className="runtimeToolbar">
              <p className="runtimeMeta">{dashboardSourceLabel} · {dashboardDocument.key}</p>
              {activeDashboardPage ? (
                <p className="runtimeMeta">
                  Active page: {activeDashboardPage.title} · {activeDashboardPage.placements.length}{' '}
                  placements
                </p>
              ) : null}
              {isSelectedStarterDashboard ? (
                <>
                  <div className="runtimeStarterStatus">
                    <div className="runtimeStarterStatusHeader">
                      <span
                        className={`runtimeStatusPill${isUserManagedStarterDashboard ? ' runtimeStatusPillProtected' : isPersistedStarterDashboard ? ' runtimeStatusPillManaged' : ''}`}
                      >
                        Starter: {starterDashboardStatusLabel}
                      </span>
                      {starterRefreshOutcomeLabel ? (
                        <span className="runtimeStatusPill runtimeStatusPillOutcome">
                          Last action: {starterRefreshOutcomeLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="runtimeMeta">{starterDashboardStatusMessage}</p>
                    {isPersistedStarterDashboard ? (
                      <p className="runtimeMeta">
                        {persistedDashboardVersionStatus != null
                          ? `Version status: ${persistedDashboardVersionStatus}`
                          : 'Version status unavailable'}
                        {formattedPersistedDashboardUpdatedAt ? ` · Updated ${formattedPersistedDashboardUpdatedAt}` : ''}
                        {dashboardOwnerPrincipalKey ? ` · Owner ${dashboardOwnerPrincipalKey}` : ''}
                      </p>
                    ) : null}
                    {starterRefreshHistory.length > 0 ? (
                      <div className="runtimeStarterHistory" aria-label="Recent starter refresh actions">
                        <div className="runtimeStarterHistorySummary">
                          <div className="runtimeStarterHistorySummaryText">
                            <strong>Recent starter actions</strong>
                            <span>Persists for this browser session</span>
                            <div className="runtimeStarterHistorySummaryMeta" aria-label="Starter history view state">
                              <span className="runtimeStarterHistorySummaryBadge">
                                Viewing {activeStarterRefreshHistoryFilterLabel}
                              </span>
                              <span className="runtimeStarterHistorySummaryBadge">
                                {activeStarterRefreshHistoryCount} item
                                {activeStarterRefreshHistoryCount === 1 ? '' : 's'}
                              </span>
                              {latestVisibleStarterRefreshHistoryEntry ? (
                                <span
                                  className="runtimeStarterHistorySummaryBadge"
                                  title={latestVisibleStarterRefreshHistoryEntry.timestampLabel}
                                >
                                  Latest{' '}
                                  {latestVisibleStarterRefreshHistoryRelativeLabel ??
                                    latestVisibleStarterRefreshHistoryEntry.timestampLabel}
                                </span>
                              ) : null}
                              {latestFailedStarterRefreshHistoryEntry ? (
                                <span
                                  className="runtimeStarterHistorySummaryBadge runtimeStarterHistorySummaryBadgeAlert"
                                  title={latestFailedStarterRefreshHistoryEntry.timestampLabel}
                                >
                                  Latest failure{' '}
                                  {latestFailedStarterRefreshHistoryRelativeLabel ??
                                    latestFailedStarterRefreshHistoryEntry.timestampLabel}
                                </span>
                              ) : null}
                              {openVisibleStarterRefreshHistoryErrorsCount > 0 ? (
                                <span className="runtimeStarterHistorySummaryBadge runtimeStarterHistorySummaryBadgeAlert">
                                  {openVisibleStarterRefreshHistoryErrorsCount} raw error
                                  {openVisibleStarterRefreshHistoryErrorsCount === 1 ? '' : 's'} open
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="runtimeStarterHistoryFilters" aria-label="Starter history filters">
                            {starterRefreshHistoryFilterOptions.map((filterOption) => (
                              <button
                                type="button"
                                className={`runtimeStarterHistoryFilterButton${starterRefreshHistoryFilter === filterOption.id ? ' runtimeStarterHistoryFilterButtonActive' : ''}`}
                                disabled={filterOption.id !== 'all' && filterOption.count === 0}
                                onClick={() => setStarterRefreshHistoryFilter(filterOption.id)}
                                aria-label={
                                  filterOption.count != null
                                    ? `Show ${filterOption.label.toLowerCase()} starter actions (${filterOption.count})`
                                    : `Show ${filterOption.label.toLowerCase()} starter actions`
                                }
                                key={filterOption.id}
                                title={
                                  filterOption.count == null
                                    ? 'Show all starter actions in this browser session'
                                    : filterOption.count > 0
                                      ? `Show ${filterOption.count} ${filterOption.label.toLowerCase()} starter action${filterOption.count === 1 ? '' : 's'}`
                                      : `No ${filterOption.label.toLowerCase()} starter actions in this browser session`
                                }
                              >
                                <span>{filterOption.label}</span>
                                {filterOption.count != null ? (
                                  <span className="runtimeStarterHistoryFilterCount" aria-hidden="true">
                                    {filterOption.count}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                        {visibleStarterRefreshHistory.length > 0 ? (
                          visibleStarterRefreshHistory.map((entry) => (
                            <article
                              className={`runtimeStarterHistoryItem${entry.tone === 'error' ? ' runtimeStarterHistoryItemError' : ''}`}
                              key={entry.id}
                            >
                              <div className="runtimeStarterHistoryHeader">
                                <div className="runtimeStarterHistoryHeadline">
                                  {entry.actionKind ? (
                                    <span
                                      className={`runtimeStarterHistoryBadge runtimeStarterHistoryBadge${entry.actionKind[0].toUpperCase()}${entry.actionKind.slice(1)}`}
                                    >
                                      {getStarterRefreshHistoryKindLabel(entry.actionKind)}
                                    </span>
                                  ) : null}
                                  <strong>{entry.summary}</strong>
                                </div>
                                <span>{entry.timestampLabel}</span>
                              </div>
                              <p>{entry.detail}</p>
                              {entry.rawDetail != null ? (
                                <details
                                  className="runtimeStarterHistoryErrorDetails"
                                  onToggle={(event) => {
                                    setStarterRefreshHistoryErrorOpenState(
                                      entry.id,
                                      event.currentTarget.open,
                                    );
                                  }}
                                  open={openStarterRefreshHistoryErrors.includes(entry.id)}
                                >
                                  <summary className="runtimeStarterHistoryErrorSummary">Raw error</summary>
                                  <p className="runtimeStarterHistoryErrorMessage">{entry.rawDetail}</p>
                                </details>
                              ) : null}
                              {entry.contextLabels.length > 0 ? (
                                <div className="runtimeStarterHistoryLabels" aria-label="Starter action context">
                                  {entry.contextLabels.map((label) => (
                                    <span className="runtimeStarterHistoryTag" key={`${entry.id}-${label}`}>
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </article>
                          ))
                        ) : (
                          <p className="runtimeStarterHistoryEmpty">
                            No {activeStarterRefreshHistoryFilterLabel.toLowerCase()} starter actions in this browser session.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="runtimeControlGroup" aria-label="Starter dashboard actions">
                    <button
                      type="button"
                      className="runtimeControl"
                      disabled={isStarterRefreshDisabled}
                      onClick={() => {
                        void handleRefreshStarterDashboard();
                      }}
                      title={refreshStarterTitle}
                    >
                      {isRefreshingStarterDashboard ? 'Refreshing starter...' : 'Refresh starter'}
                    </button>
                    <button
                      type="button"
                      className={`runtimeControl${isClearStarterHistoryArmed ? ' runtimeControlActive' : ''}`}
                      disabled={isClearStarterHistoryDisabled}
                      onClick={handleClearStarterRefreshHistory}
                      title={clearStarterHistoryTitle}
                    >
                      {isClearStarterHistoryArmed
                        ? `Confirm clear (${clearStarterHistoryConfirmTimeoutMs / 1000}s)`
                        : 'Clear history'}
                    </button>
                  </div>
                </>
              ) : null}
              <div className="runtimeControlGroup" aria-label="Runtime canvas view mode">
                {runtimeCanvasScaleModes.map((mode) => (
                  <button
                    type="button"
                    className={`runtimeControl${mode.id === runtimeCanvasScaleMode ? ' runtimeControlActive' : ''}`}
                    key={mode.id}
                    onClick={() => setRuntimeCanvasScaleMode(mode.id)}
                    title={mode.description}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="runtimeControlGroup" aria-label="Runtime canvas zoom controls">
                <button
                  type="button"
                  className="runtimeControl"
                  disabled={isRuntimeCanvasZoomOutDisabled}
                  onClick={() => stepRuntimeCanvasZoom('out')}
                  title="Zoom out runtime canvas"
                >
                  -
                </button>
                <button
                  type="button"
                  className={`runtimeControl${isRuntimeCanvasDefaultView ? ' runtimeControlActive' : ''}`}
                  onClick={resetRuntimeCanvasView}
                  title="Reset runtime canvas view"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="runtimeControl"
                  disabled={isRuntimeCanvasZoomInDisabled}
                  onClick={() => stepRuntimeCanvasZoom('in')}
                  title="Zoom in runtime canvas"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {dashboardNotice ? (
            <p
              className={`callout${dashboardNoticeTone === 'error' ? ' calloutError' : dashboardNoticeTone === 'success' ? ' calloutSuccess' : ''}`}
            >
              {dashboardNotice}
            </p>
          ) : null}
          {dashboardDocument.pages.length > 1 ? (
            <div className="pageSelector" aria-label="Dashboard pages">
              {dashboardDocument.pages.map((page) => (
                <button
                  type="button"
                  className={`pageTab${page.id === activeDashboardPage?.id ? ' pageTabActive' : ''}`}
                  key={page.id}
                  onClick={() => setActivePageId(page.id)}
                >
                  {page.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="runtimeLayout">
            {dashboardRuntimePanelEntries.length === 0 ? (
              <p className="callout">
                The active dashboard document does not define any placed runtime panels yet.
              </p>
            ) : (
              <div className="runtimeCanvasFrame">
                <div className="runtimeCanvasHeader">
                  {runtimeCanvasLabel ? <p className="runtimeCanvasMeta">{runtimeCanvasLabel}</p> : null}
                  <p className="runtimeMeta">
                    View: {runtimeCanvasScaleModes.find((mode) => mode.id === runtimeCanvasScaleMode)?.label} · Zoom {runtimeCanvasZoomLabel}
                  </p>
                </div>
                <p className="runtimeMeta">Shortcuts: + zoom in, - zoom out, 0 reset, Alt + wheel zoom.</p>
                <div
                  className="runtimeCanvasScroller"
                  aria-label="Runtime canvas preview"
                  onKeyDown={handleRuntimeCanvasKeyDown}
                  onWheel={handleRuntimeCanvasWheel}
                  tabIndex={0}
                >
                  <div className="runtimePanelList runtimeCanvas" style={runtimeCanvasStyle}>
                    {dashboardRuntimePanelEntries.map(({ panel, placement }) => {
                      const runtime = panelRuntime[panel.id];
                      const runtimePanelKey = `${panel.id}-${placement.x}-${placement.y}-${placement.zIndex}`;
                      const runtimePanelStyle = runtimeGridMetrics
                        ? getRuntimePanelStyle(placement, runtimeGridMetrics)
                        : undefined;

                      if (isScorecardPanel(panel)) {
                        const value = runtime?.data?.results[0]?.[panel.scorecard.valueField];

                        return (
                          <article className="runtimeCanvasItem runtimeStat" key={runtimePanelKey} style={runtimePanelStyle}>
                            <span>{panel.title}</span>
                            <strong>
                              {runtime?.state === 'ready'
                                ? formatScorecardValue(
                                    value,
                                    panel.scorecard.valuePrefix,
                                    panel.scorecard.valueSuffix,
                                  )
                                : runtime?.state === 'error'
                                  ? 'Unavailable'
                                  : 'Loading'}
                            </strong>
                            <p>{panel.scorecard.description}</p>
                            <p className="runtimeMeta">
                              {panel.datasetKey} ·{' '}
                              {runtime?.data?.executionMetadata.connector ?? 'POST /query/execute'}
                            </p>
                            <p className="runtimeMeta">
                              {runtime?.data?.executionMetadata.durationMs != null
                                ? `${runtime.data.executionMetadata.durationMs} ms`
                                : 'Awaiting panel result'}
                            </p>
                            <p className="runtimeMeta">{formatPlacementLabel(placement)}</p>
                            {runtime?.state === 'error' && runtime.errorMessage ? (
                              <p className="inlineNotice">{runtime.errorMessage}</p>
                            ) : null}
                          </article>
                        );
                      }

                      if (isTablePanel(panel)) {
                        return (
                          <div className="runtimeCanvasItem runtimeTableCard" key={runtimePanelKey} style={runtimePanelStyle}>
                            <div className="runtimeTableHeader">
                              <span className="kicker">{panel.title}</span>
                              <span className="queryBadge">
                                {panel.datasetKey} · top {panel.query.limit ?? 0}
                              </span>
                            </div>
                            <p className="runtimeMeta">{panel.table.description}</p>
                            <p className="runtimeMeta">{formatPlacementLabel(placement)}</p>

                            {runtime?.state === 'ready' && runtime.data ? (
                              (runtime.data.results.length ?? 0) > 0 ? (
                                <div className="queryTableWrap">
                                  <table className="queryTable">
                                    <thead>
                                      <tr>
                                        {panel.table.columns.map((column) => (
                                          <th key={column} scope="col">
                                            {column}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {runtime.data.results.map((row, index) => (
                                        <tr key={`row-${index}`}>
                                          {panel.table.columns.map((column) => (
                                            <td key={`${index}-${column}`}>{formatQueryCellValue(row[column])}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="callout">The table panel executed successfully, but the dataset returned no rows.</p>
                              )
                            ) : runtime?.state === 'error' ? (
                              <p className="callout calloutError">
                                {runtime.errorMessage ?? 'The table panel could not be rendered yet.'}
                              </p>
                            ) : (
                              <p className="callout">
                                Executing the active dashboard table panel against {API_BASE_URL}/query/execute
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (isChartPanel(panel)) {
                        const chartData = getRuntimeChartData(panel, runtime);
                        const metricLabel = panel.query.metrics[0]?.key ?? 'metric';
                        const dimensionLabel = panel.query.dimensions[0] ?? 'row';
                        const chartMaxValue = Math.max(...chartData.map((datum) => datum.value), 1);
                        const pieTotalValue = chartData.reduce((sum, datum) => sum + datum.value, 0);
                        const linePath = getRuntimeLineChartPath(chartData);

                        return (
                          <article className="runtimeCanvasItem runtimeChartCard" key={runtimePanelKey} style={runtimePanelStyle}>
                            <div className="runtimeTableHeader">
                              <span className="kicker">{panel.title}</span>
                              <span className="queryBadge">
                                {panel.kind} · {metricLabel}
                              </span>
                            </div>
                            <p className="runtimeMeta">
                              {panel.kind === 'line'
                                ? `${metricLabel} trend grouped by ${dimensionLabel}`
                                : `${metricLabel} grouped by ${dimensionLabel}`}
                            </p>
                            <p className="runtimeMeta">{formatPlacementLabel(placement)}</p>

                            {runtime?.state === 'ready' && chartData.length > 0 ? (
                              panel.kind === 'line' ? (
                                <>
                                  <div className="runtimeLineChart">
                                    <svg
                                      aria-label={`${panel.title} line chart preview`}
                                      className="runtimeLineSvg"
                                      preserveAspectRatio="none"
                                      viewBox="0 0 100 100"
                                    >
                                      <path className="runtimeLineAxis" d="M 6 90 H 94" />
                                      <path className="runtimeLinePath" d={linePath} />
                                      {chartData.map((datum, index) => {
                                        const x =
                                          chartData.length === 1 ? 50 : 8 + (84 * index) / (chartData.length - 1);
                                        const y = 90 - (datum.value / chartMaxValue) * 68;

                                        return (
                                          <circle
                                            className="runtimeLinePoint"
                                            cx={x}
                                            cy={y}
                                            key={`${panel.id}-${datum.label}`}
                                            r="2.6"
                                          />
                                        );
                                      })}
                                    </svg>
                                  </div>
                                  <div className="runtimeLineLabels">
                                    {chartData.slice(0, 6).map((datum) => (
                                      <span key={`${panel.id}-${datum.label}-label`}>{datum.label}</span>
                                    ))}
                                  </div>
                                </>
                              ) : panel.kind === 'bar' ? (
                                <div className="runtimeBarChart">
                                  {chartData.map((datum, index) => {
                                    const ratio = `${Math.max(10, (datum.value / chartMaxValue) * 100)}%`;

                                    return (
                                      <div className="runtimeBarRow" key={`${panel.id}-${datum.label}`}>
                                        <div className="runtimeBarLabelRow">
                                          <span>{datum.label}</span>
                                          <strong>{datum.formattedValue}</strong>
                                        </div>
                                        <div className="runtimeBarTrack">
                                          <span
                                            className="runtimeBarFill"
                                            style={{
                                              background: runtimeChartColors[index % runtimeChartColors.length],
                                              width: ratio,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="runtimePieLayout">
                                  <div
                                    aria-label={`${panel.title} pie chart preview`}
                                    className="runtimePieChart"
                                    style={{ background: getRuntimePieChartBackground(chartData) }}
                                  >
                                    <span>{formatQueryCellValue(pieTotalValue)}</span>
                                  </div>
                                  <div className="runtimePieLegend">
                                    {chartData.map((datum, index) => {
                                      const sharePercent = pieTotalValue > 0 ? (datum.value / pieTotalValue) * 100 : 0;

                                      return (
                                        <div className="runtimePieLegendItem" key={`${panel.id}-${datum.label}`}>
                                          <span
                                            className="runtimePieSwatch"
                                            style={{ background: runtimeChartColors[index % runtimeChartColors.length] }}
                                          />
                                          <span className="runtimePieLabel">{datum.label}</span>
                                          <strong>{sharePercent.toFixed(0)}%</strong>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )
                            ) : runtime?.state === 'error' ? (
                              <p className="callout calloutError">
                                {runtime.errorMessage ?? `The ${panel.kind} panel could not be rendered yet.`}
                              </p>
                            ) : runtime?.state === 'ready' ? (
                              <p className="callout">
                                The {panel.kind} panel executed successfully, but the dataset returned no numeric series.
                              </p>
                            ) : (
                              <p className="callout">
                                Executing the active dashboard {panel.kind} panel against {API_BASE_URL}/query/execute
                              </p>
                            )}

                            <p className="runtimeMeta">
                              {runtime?.data?.rowCount != null
                                ? `${runtime.data.rowCount} rows · ${runtime.data.executionMetadata.connector ?? 'POST /query/execute'}`
                                : `${panel.datasetKey} · ${panel.query.limit ?? 0} row limit`}
                            </p>
                            <p className="runtimeMeta">
                              {runtime?.data?.executionMetadata.durationMs != null
                                ? `${runtime.data.executionMetadata.durationMs} ms`
                                : 'Awaiting panel result'}
                            </p>
                          </article>
                        );
                      }

                      if (isNoticePanel(panel)) {
                        const noticeFacts = getRuntimeNoticeFacts(runtime);

                        return (
                          <article className="runtimeCanvasItem runtimeNoticeCard" key={runtimePanelKey} style={runtimePanelStyle}>
                            <div className="runtimeTableHeader">
                              <span className="kicker">{panel.title}</span>
                              <span className="queryBadge">notice</span>
                            </div>
                            {runtime?.state === 'ready' && noticeFacts.length > 0 ? (
                              <>
                                <p className="runtimeNoticeLead">
                                  Live notice facts are sourced from the first governed query row.
                                </p>
                                <div className="runtimeNoticeGrid">
                                  {noticeFacts.map((fact) => (
                                    <div className="runtimeNoticeFact" key={`${panel.id}-${fact.label}`}>
                                      <span>{fact.label}</span>
                                      <strong>{fact.value}</strong>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : runtime?.state === 'error' ? (
                              <p className="callout calloutError">
                                {runtime.errorMessage ?? 'The notice panel could not load its summary data.'}
                              </p>
                            ) : panel.query != null ? (
                              <p className="callout">
                                Executing the active dashboard notice panel against {API_BASE_URL}/query/execute
                              </p>
                            ) : (
                              <p className="runtimeNoticeLead">
                                Static notice panels can hold rollout guidance or alert copy even before a live query is attached.
                              </p>
                            )}
                            <p className="runtimeMeta">{panel.datasetKey}</p>
                            {runtime?.data != null ? (
                              <p className="runtimeMeta">
                                {runtime.data.rowCount} rows · {runtime.data.executionMetadata.connector ?? 'POST /query/execute'}
                              </p>
                            ) : null}
                            <p className="runtimeMeta">{formatPlacementLabel(placement)}</p>
                          </article>
                        );
                      }

                      return (
                        <article className="runtimeCanvasItem runtimeFallbackCard" key={runtimePanelKey} style={runtimePanelStyle}>
                          <div className="runtimeTableHeader">
                            <span className="kicker">{panel.title}</span>
                            <span className="queryBadge">{panel.kind}</span>
                          </div>
                          <p className="runtimeMeta">
                            This panel is stored on the active dashboard page, but the bootstrap shell does
                            not render this panel kind yet.
                          </p>
                          <p className="runtimeMeta">{panel.datasetKey}</p>
                          <p className="runtimeMeta">{formatPlacementLabel(placement)}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">Dashboard Document</span>
            <h2>Page and library seed data</h2>
            <p className="runtimeMeta">
              {dashboardSourceLabel} · {dashboardDocument.pages.length} pages · {dashboardDocument.panelLibrary.length}{' '}
              library panels
            </p>
          </div>
          <div className="documentPreview">
            <div>
              <h3>Pages</h3>
              <p>
                {dashboardDocument.pages
                  .map(
                    (page) =>
                      `${page.title} (${page.width}×${page.height}px, ${page.placements.length} placements)`,
                  )
                  .join(' / ')}
              </p>
            </div>
            <div>
              <h3>Panel Library</h3>
              <p>
                {dashboardDocument.panelLibrary
                  .map((panel) => `${panel.title} (${panel.kind})`)
                  .join(' / ')}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
