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

export type PanelKind =
  | 'table'
  | 'scorecard'
  | 'line'
  | 'bar'
  | 'pie'
  | 'notice';

export type PanelRef = {
  id: string;
  key: string;
  kind: PanelKind;
  title: string;
  datasetKey: string;
  byReference: boolean;
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
        { panelId: 'panel-trend', x: 40, y: 240, width: 920, height: 320, zIndex: 1 },
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
    },
    {
      id: 'panel-revenue',
      key: 'revenue-scorecard',
      kind: 'scorecard',
      title: 'Revenue',
      datasetKey: 'mart_commerce_daily',
      byReference: true,
    },
    {
      id: 'panel-trend',
      key: 'revenue-trend',
      kind: 'line',
      title: 'Revenue Trend',
      datasetKey: 'mart_commerce_daily',
      byReference: true,
    },
  ],
};
