import type {Asset, ChartDocument, DashboardDocument, DatasetManifest, QueryResult, QuerySpec} from './types';

const base = '/api/v1';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(base + path, {headers: {'Content-Type': 'application/json', ...init?.headers}, ...init});
  if (!response.ok) {
    const problem = await response.json().catch(() => ({title: response.statusText}));
    const error = new Error(problem.detail || problem.title) as Error & {status?: number};
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const api = {
  list: <T>(kind: 'charts' | 'dashboards') => request<Asset<T>[]>(`/assets/${kind}/`),
  get: <T>(kind: 'charts' | 'dashboards', id: string, revision?: number) => request<Asset<T>>(`/assets/${kind}/${id}/${revision ? `revisions/${revision}` : ''}`),
  create: <T>(kind: 'charts' | 'dashboards', slug: string, title: string, document: T) =>
    request<Asset<T>>(`/assets/${kind}/`, {method: 'POST', body: JSON.stringify({slug, title, summary: '생성', document})}),
  update: <T>(kind: 'charts' | 'dashboards', asset: Asset<T>, document: T, summary = '편집') =>
    request<Asset<T>>(`/assets/${kind}/${asset.id}/`, {method: 'PUT', headers: {'If-Match': `"${asset.latestRevision}"`}, body: JSON.stringify({slug: asset.slug, title: (document as {metadata: {title: string}}).metadata.title, summary, document})}),
  revisions: (kind: 'charts' | 'dashboards', id: string) => request<{revision: number; summary: string; actor: string; createdAt: string}[]>(`/assets/${kind}/${id}/revisions`),
  restore: <T>(kind: 'charts' | 'dashboards', asset: Asset<T>, revision: number) =>
    request<Asset<T>>(`/assets/${kind}/${asset.id}/revisions/${revision}/restore`, {method: 'POST', headers: {'If-Match': `"${asset.latestRevision}"`}}),
  query: (spec: QuerySpec, refresh = false) => request<QueryResult>(`/query/execute?refresh=${refresh}`, {method: 'POST', body: JSON.stringify(spec)}),
  datasets: () => request<DatasetManifest[]>('/datasets'),
  status: () => request<{dependencies: {metadata: 'ok' | 'down'; redis: 'ok' | 'down'; analyticsDatasource: 'ok' | 'degraded'}}>('/system/status'),
};

export type PortableDocument = ChartDocument | DashboardDocument;
