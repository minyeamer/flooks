import type {ChartDocument, DatasetManifest, QuerySpec} from './types';

export type Filter = NonNullable<QuerySpec['filters']>[number];
export type Sort = NonNullable<QuerySpec['sort']>[number];
export type ChartType = ChartDocument['spec']['visualization']['type'];

export const operatorLabel: Record<string, string> = {eq: '같음', in: '목록 중 하나', contains: '포함', between: '범위', isNull: '비어 있음 여부'};

export function filterIsComplete(filter: Filter): boolean {
  if (filter.op === 'isNull') return typeof filter.value === 'boolean';
  if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.length > 0;
  if (filter.op === 'between') return Array.isArray(filter.value) && filter.value.length === 2 && filter.value.every(Boolean);
  return typeof filter.value === 'string' && filter.value.trim().length > 0;
}

export function parseFilterValue(op: string, first: string, second = '', isNull = false): unknown {
  if (op === 'isNull') return isNull;
  if (op === 'in') return first.split(',').map(value => value.trim()).filter(Boolean);
  if (op === 'between') return [first, second];
  return first;
}

export function valueAt(filter: Filter, index = 0): string {
  if (Array.isArray(filter.value)) return String(filter.value[index] ?? '');
  return typeof filter.value === 'string' ? filter.value : '';
}

export function defaultQuery(manifest: DatasetManifest, current: QuerySpec, type: ChartType): QuerySpec {
  const firstDimension = manifest.dimensions[0]?.key;
  return {datasetKey: manifest.key, timeRange: current.timeRange, dimensions: type === 'kpi' || !firstDimension ? [] : [firstDimension], metrics: manifest.metrics[0] ? [manifest.metrics[0].key] : [], filters: [], sort: [], limit: type === 'kpi' ? 1 : manifest.limits.defaultRows};
}

export function chartDocumentReady(document: ChartDocument): boolean {
  return (document.spec.query.metrics ?? []).length > 0 && !(document.spec.query.filters ?? []).some(filter => !filterIsComplete(filter));
}
