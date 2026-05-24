import { useEffect, useState } from 'react';

import {
  dataSourceKinds,
  starterDashboard,
  systemRoles,
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
  method: 'GET' | 'POST';
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

type RequestState = 'loading' | 'ready' | 'error';

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
  return method === 'POST' ? 'methodBadge methodBadgePost' : 'methodBadge methodBadgeGet';
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

function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [system, setSystem] = useState<SystemResponse | null>(null);
  const [apiReference, setApiReference] = useState<ApiReferenceResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const liveRoles = system?.roles ?? systemRoles;
  const liveDataSources = system?.dataSources ?? dataSourceKinds;
  const liveModules = system?.modules ?? [];
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
          <strong>{overview?.product ?? starterDashboard.title}</strong>
          <span>
            {overview
              ? `${overview.metrics.length} live metrics · ${overview.execution_plan.length} planned slices`
              : 'Connecting the web shell to the API surface'}
          </span>
          <span>
            {system
              ? `${liveModules.length} modules · ${liveRoles.length} roles · ${liveDataSources.length} sources`
              : starterDashboard.supportedDataSources.join(', ')}
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
            <span className="chip">Dashboard Document</span>
            <h2>Page and library seed data</h2>
          </div>
          <div className="documentPreview">
            <div>
              <h3>Pages</h3>
              <p>
                {starterDashboard.pages[0]?.title} · {starterDashboard.pages[0]?.width}×
                {starterDashboard.pages[0]?.height}px
              </p>
            </div>
            <div>
              <h3>Panel Library</h3>
              <p>{starterDashboard.panelLibrary.map((panel) => panel.title).join(' / ')}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
