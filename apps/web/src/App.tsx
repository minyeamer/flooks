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
  document: DashboardDocument;
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

const launchTracks = [
  {
    title: 'Live Bootstrap Surface',
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
  const [dashboardDocument, setDashboardDocument] = useState<DashboardDocument>(starterDashboard);
  const [activePageId, setActivePageId] = useState<string | null>(() =>
    getDefaultDashboardPageId(starterDashboard),
  );
  const [dashboardSourceLabel, setDashboardSourceLabel] = useState<string>('Starter seed');
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [runtimeCanvasScaleMode, setRuntimeCanvasScaleMode] =
    useState<RuntimeCanvasScaleMode>('fit');
  const [runtimeCanvasZoomPercent, setRuntimeCanvasZoomPercent] = useState<number>(
    runtimeCanvasZoomPercentDefault,
  );
  const [panelRuntime, setPanelRuntime] = useState<Record<string, PanelRuntimeEntry>>(() =>
    buildInitialPanelRuntime(starterDashboard, getDefaultDashboardPageId(starterDashboard)),
  );
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    async function loadDashboardDocument() {
      try {
        setDashboardNotice(null);

        const response = await fetch(`${API_BASE_URL}/dashboards/${starterDashboard.key}`, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (controller.signal.aborted) {
            return;
          }

          setDashboardDocument(starterDashboard);
          setDashboardSourceLabel('Starter seed');
          setDashboardNotice(
            `Persisted dashboard '${starterDashboard.key}' was not found yet. Using the starter document.`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            await getResponseMessage(
              response,
              `Unable to load dashboard '${starterDashboard.key}'. Using the starter document instead.`,
            ),
          );
        }

        const payload = (await response.json()) as DashboardApiResponse;

        if (controller.signal.aborted) {
          return;
        }

        setDashboardDocument(payload.document);
        setDashboardSourceLabel(`Persisted v${payload.latestVersionNumber}`);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDashboardDocument(starterDashboard);
        setDashboardSourceLabel('Starter seed');
        setDashboardNotice(
          error instanceof Error
            ? error.message
            : `Unable to load dashboard '${starterDashboard.key}'. Using the starter document instead.`,
        );
      }
    }

    void loadDashboardDocument();

    return () => {
      controller.abort();
    };
  }, []);

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
          {errorMessage ? <p className="inlineNotice">{errorMessage}</p> : null}
        </div>
        <div className="heroCard">
          <span className="heroCardLabel">Live Bootstrap</span>
          <strong>{overview?.product ?? dashboardDocument.title}</strong>
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
            <h2>Bootstrap runtime overview</h2>
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
                : `Loading live bootstrap data from ${API_BASE_URL}`}
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

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">API Reference</span>
            <h2>{apiReference?.title ?? 'Bootstrap API reference'}</h2>
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

        <section className="panel panelWide">
          <div className="panelHeader">
            <span className="chip">Live Panel Runtime</span>
            <h2>Active dashboard page preview</h2>
            <p className="sectionSummary">
              The web shell reads first-party panel definitions from the active dashboard page,
              preserves their placement order, and executes each supported panel through the live
              query execution API.
            </p>
            <div className="runtimeToolbar">
              <p className="runtimeMeta">{dashboardSourceLabel} · {dashboardDocument.key}</p>
              {activeDashboardPage ? (
                <p className="runtimeMeta">
                  Active page: {activeDashboardPage.title} · {activeDashboardPage.placements.length}{' '}
                  placements
                </p>
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
          {dashboardNotice ? <p className="callout">{dashboardNotice}</p> : null}
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
                The active dashboard document does not define any scorecard or table panels with a governed
                query spec yet.
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
