export const systemRoles = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as const;

export type SystemRole = (typeof systemRoles)[number];

export const dataSourceKinds = [
  'POSTGRES',
  'BIGQUERY',
  'CLICKHOUSE',
  'JDBC',
  'CSV',
] as const;

export type DataSourceKind = (typeof dataSourceKinds)[number];

export const metricAggregates = ['sum', 'count', 'avg', 'min', 'max'] as const;

export type MetricAggregate = (typeof metricAggregates)[number];

export const sortDirections = ['asc', 'desc'] as const;

export type SortDirection = (typeof sortDirections)[number];

export type PanelKind =
  | 'table'
  | 'scorecard'
  | 'line'
  | 'bar'
  | 'pie'
  | 'notice';

export type PanelMetricSpec = {
  key: string;
  aggregate: MetricAggregate;
};

export type PanelSortSpec = {
  field: string;
  direction: SortDirection;
};

export type PanelQuerySpec = {
  datasetKey: string;
  dimensions: string[];
  metrics: PanelMetricSpec[];
  sort?: PanelSortSpec[];
  limit?: number;
};

export type ScorecardPanelConfig = {
  description: string;
  valueField: string;
  valuePrefix?: string;
  valueSuffix?: string;
};

export type TablePanelConfig = {
  description: string;
  columns: string[];
};

export type PanelRef = {
  id: string;
  key: string;
  kind: PanelKind;
  title: string;
  datasetKey: string;
  byReference: boolean;
  query?: PanelQuerySpec;
  scorecard?: ScorecardPanelConfig;
  table?: TablePanelConfig;
};

export type PanelPlacement = {
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type DashboardPage = {
  id: string;
  title: string;
  width: number;
  height: number;
  snapGrid: {
    columnWidth: number;
    rowHeight: number;
  };
  placements: PanelPlacement[];
};

export type DashboardDocument = {
  id: string;
  key: string;
  title: string;
  version: number;
  ownerRoleBoundary: SystemRole;
  supportedDataSources: DataSourceKind[];
  pages: DashboardPage[];
  panelLibrary: PanelRef[];
};

export const starterDashboard: DashboardDocument = {
  id: 'db-home',
  key: 'commerce-home',
  title: 'Commerce Executive Overview',
  version: 1,
  ownerRoleBoundary: 'ADMIN',
  supportedDataSources: ['POSTGRES'],
  pages: [
    {
      id: 'page-overview',
      title: 'Overview',
      width: 1600,
      height: 900,
      snapGrid: {
        columnWidth: 20,
        rowHeight: 20,
      },
      placements: [
        { panelId: 'panel-gmv', x: 40, y: 40, width: 300, height: 180, zIndex: 1 },
        { panelId: 'panel-revenue', x: 360, y: 40, width: 300, height: 180, zIndex: 1 },
        { panelId: 'panel-channel-table', x: 40, y: 240, width: 920, height: 320, zIndex: 1 },
      ],
    },
  ],
  panelLibrary: [
    {
      id: 'panel-gmv',
      key: 'gmv-scorecard',
      kind: 'scorecard',
      title: 'GMV',
      datasetKey: 'mart_commerce_daily',
      byReference: true,
      query: {
        datasetKey: 'mart_commerce_daily',
        dimensions: [],
        metrics: [{ key: 'gmv', aggregate: 'sum' }],
        limit: 1,
      },
      scorecard: {
        description: 'Total GMV returned by the governed query execution path.',
        valueField: 'gmv',
        valuePrefix: '$',
      },
    },
    {
      id: 'panel-revenue',
      key: 'revenue-scorecard',
      kind: 'scorecard',
      title: 'Revenue',
      datasetKey: 'mart_commerce_daily',
      byReference: true,
      query: {
        datasetKey: 'mart_commerce_daily',
        dimensions: [],
        metrics: [{ key: 'revenue', aggregate: 'sum' }],
        limit: 1,
      },
      scorecard: {
        description: 'Net revenue total executed from the starter dashboard document.',
        valueField: 'revenue',
        valuePrefix: '$',
      },
    },
    {
      id: 'panel-channel-table',
      key: 'channel-revenue-table',
      kind: 'table',
      title: 'Revenue by Channel',
      datasetKey: 'mart_commerce_daily',
      byReference: true,
      query: {
        datasetKey: 'mart_commerce_daily',
        dimensions: ['channel_name'],
        metrics: [{ key: 'revenue', aggregate: 'sum' }],
        sort: [{ field: 'revenue', direction: 'desc' }],
        limit: 5,
      },
      table: {
        description: 'Top channels ranked by revenue from the live governed query response.',
        columns: ['channel_name', 'revenue'],
      },
    },
  ],
};
