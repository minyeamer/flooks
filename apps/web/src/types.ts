export type QuerySpec = {
  datasetKey: string;
  timeRange: {start: string; end: string};
  dimensions?: string[];
  metrics?: string[];
  filters?: {field: string; op: string; value?: unknown}[];
  sort?: {field: string; direction: 'asc' | 'desc'}[];
  limit?: number;
  offset?: number;
};

export type DatasetDimension = {
  key: string;
  label: string;
  type: 'string' | 'date';
  filterOperators: ('eq' | 'in' | 'contains' | 'between' | 'isNull')[];
};

export type DatasetMetric = {
  key: string;
  label: string;
  type: string;
  format?: 'number' | 'currency' | 'percent';
};

export type DatasetManifest = {
  version: number;
  key: string;
  label: string;
  connector: string;
  dimensions: DatasetDimension[];
  metrics: DatasetMetric[];
  limits: {defaultRows: number; maxRows: number; timeoutSeconds: number};
  cache: {ttlSeconds: number};
};

export type ChartDocument = {
  apiVersion: 'flooks.io/v1alpha1';
  kind: 'Chart';
  metadata: {name: string; title: string};
  spec: {
    datasetKey: string;
    visualization: {
      type: 'kpi' | 'line' | 'bar' | 'table';
      stacked?: boolean;
      valueFormat?: 'number' | 'currency' | 'percent';
      table?: {layout: 'fit' | 'fixed'; frozenColumns?: number; columnWidths?: Record<string, number>};
    };
    query: QuerySpec;
  };
};

export type Placement = {chartId: string; chartRevision: number; x: number; y: number; w: number; h: number};
export type DashboardDocument = {
  apiVersion: 'flooks.io/v1alpha1';
  kind: 'Dashboard';
  metadata: {name: string; title: string};
  spec: {columns: 12; filters: string[]; placements: Placement[]};
};
export type Asset<T = ChartDocument | DashboardDocument> = {
  id: string; kind: string; slug: string; title: string; latestRevision: number; archived: boolean; document?: T;
};
export type QueryResult = {columns: {name: string; type: string}[]; rows: Record<string, unknown>[]; rowCount: number; durationMs: number; cached: boolean};
