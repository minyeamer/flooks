import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {api} from './api';
import {ChartEditor, newChart} from './ChartEditor';
import {DashboardEditor} from './DashboardEditor';
import type {Asset, ChartDocument, DashboardDocument} from './types';

const queryClient = new QueryClient();
export default function App() { return <QueryClientProvider client={queryClient}><Shell /></QueryClientProvider>; }

function Shell() {
  const [section, setSection] = useState<'charts' | 'dashboard'>('dashboard');
  const [selected, setSelected] = useState<Asset<ChartDocument>>();
  const charts = useQuery({queryKey: ['charts'], queryFn: async () => {
    const list = await api.list<ChartDocument>('charts');
    return Promise.all(list.map(item => api.get<ChartDocument>('charts', item.id)));
  }});
  const dashboards = useQuery({queryKey: ['dashboards'], queryFn: async () => {
    const list = await api.list<DashboardDocument>('dashboards');
    return Promise.all(list.map(item => api.get<DashboardDocument>('dashboards', item.id)));
  }});
  const status = useQuery({queryKey: ['status'], queryFn: api.status, refetchInterval: 30000});
  const invalidate = () => {queryClient.invalidateQueries({queryKey: ['charts']}); queryClient.invalidateQueries({queryKey: ['dashboards']});};
  useEffect(() => {
    const events = new EventSource('/api/v1/events');
    events.addEventListener('asset', invalidate);
    return () => events.close();
  }, []);
  const seed = async () => {
    const definitions: ChartDocument[] = [
      {...newChart('총 광고비', 'kpi'), metadata: {name: 'total-ad-cost', title: '총 광고비'}},
      {...newChart('총 전환액', 'kpi'), metadata: {name: 'total-conversion', title: '총 전환액'}, spec: {...newChart('', 'kpi').spec, visualization: {type: 'kpi', valueFormat: 'currency'}, query: {...newChart('', 'kpi').spec.query, metrics: ['conv_amount']}}},
      {...newChart('ROAS', 'kpi'), metadata: {name: 'roas', title: 'ROAS'}, spec: {...newChart('', 'kpi').spec, visualization: {type: 'kpi', valueFormat: 'percent'}, query: {...newChart('', 'kpi').spec.query, metrics: ['roas']}}},
      {...newChart('일별 광고 성과', 'line'), metadata: {name: 'daily-trend', title: '일별 광고비와 전환액'}, spec: {...newChart('', 'line').spec, query: {...newChart('', 'line').spec.query, dimensions: ['ymd'], metrics: ['ad_cost', 'conv_amount'], sort: [{field: 'ymd', direction: 'asc'}]}}},
      {...newChart('플랫폼별 광고비', 'bar'), metadata: {name: 'platform-cost', title: '플랫폼별 광고비'}},
      {...newChart('브랜드별 ROAS', 'bar'), metadata: {name: 'brand-roas', title: '브랜드별 ROAS'}, spec: {...newChart('', 'bar').spec, query: {...newChart('', 'bar').spec.query, dimensions: ['brand_name'], metrics: ['roas'], sort: [{field: 'roas', direction: 'desc'}]}}},
      {...newChart('광고 상세', 'table'), metadata: {name: 'ads-table', title: '광고 상세'}, spec: {...newChart('', 'table').spec, query: {...newChart('', 'table').spec.query, dimensions: ['ymd', 'platform_name', 'team_name', 'brand_name', 'campaign_name', 'ad_name', 'product_name'], metrics: ['ad_cost', 'conv_amount'], sort: [{field: 'ymd', direction: 'desc'}]}}},
    ];
    for (const document of definitions) await api.create('charts', document.metadata.name, document.metadata.title, document);
    invalidate();
  };
  return <div className="app-shell">
    <header><div><span className="logo">F</span><strong>Flooks</strong><small>광고 분석 워크스페이스</small></div><nav><button className={section === 'dashboard' ? 'active' : ''} onClick={() => setSection('dashboard')}>대시보드</button><button className={section === 'charts' ? 'active' : ''} onClick={() => setSection('charts')}>차트 애셋</button></nav>
      <span className={`status ${status.data?.dependencies.analyticsDatasource === 'ok' ? 'ok' : ''}`}>{status.data?.dependencies.analyticsDatasource === 'ok' ? '데이터 연결됨' : '데이터 확인 중'}</span></header>
    {section === 'charts' ? <div className="content"><div className="asset-strip"><button onClick={() => setSelected(undefined)}>+ 새 차트</button>{charts.data?.filter(chart => !chart.archived).map(chart => <button key={chart.id} onClick={() => setSelected(chart)}>{chart.title}<small>r{chart.latestRevision}</small></button>)}{charts.data?.filter(chart => !chart.archived).length === 0 && <button className="primary" onClick={seed}>스타터 차트 7개 생성</button>}</div><ChartEditor asset={selected} onSaved={invalidate} /></div>
      : <div className="content"><DashboardEditor dashboard={dashboards.data?.[0]} charts={charts.data ?? []} onSaved={invalidate} />{charts.data?.length === 0 && <div className="seed-callout">먼저 차트 애셋에서 스타터 차트를 생성하세요.</div>}</div>}
  </div>;
}
