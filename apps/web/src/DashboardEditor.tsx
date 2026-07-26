import {useEffect, useMemo, useState} from 'react';
import Editor from '@monaco-editor/react';
import {GridLayout, useContainerWidth, type LayoutItem} from 'react-grid-layout';
import {api} from './api';
import {ChartRenderer} from './ChartRenderer';
import type {Asset, ChartDocument, DashboardDocument, QueryResult} from './types';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export function DashboardEditor({dashboard, charts, onSaved}: {dashboard?: Asset<DashboardDocument>; charts: Asset<ChartDocument>[]; onSaved: () => void}) {
  const [document, setDocument] = useState<DashboardDocument>(() => dashboard?.document ?? {
    apiVersion: 'flooks.io/v1alpha1', kind: 'Dashboard', metadata: {name: 'ads-overview', title: '광고 성과 대시보드'},
    spec: {columns: 12, filters: ['date', 'platform_name', 'team_name', 'brand_name'], placements: []},
  });
  const [results, setResults] = useState<Record<string, QueryResult>>({});
  const [resolvedCharts, setResolvedCharts] = useState<Record<string, Asset<ChartDocument>>>({});
  const params = new URLSearchParams(window.location.search);
  const today = new Date(Date.now() - 86400000);
  const earlier = new Date(today.getTime() - 29 * 86400000);
  const [startDate, setStartDate] = useState(params.get('start') ?? earlier.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(params.get('end') ?? today.toISOString().slice(0, 10));
  const [platform, setPlatform] = useState(params.get('platform') ?? '');
  const [team, setTeam] = useState(params.get('team') ?? '');
  const [brand, setBrand] = useState(params.get('brand') ?? '');
  const {width, containerRef, mounted} = useContainerWidth();
  useEffect(() => { if (dashboard?.document) setDocument(dashboard.document); }, [dashboard]);
  const chartMap = useMemo(() => new Map(charts.map(chart => [chart.id, chart])), [charts]);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of [['start', startDate], ['end', endDate], ['platform', platform], ['team', team], ['brand', brand]]) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    window.history.replaceState({}, '', url);
    document.spec.placements.forEach(async placement => {
      try {
        const chart = await api.get<ChartDocument>('charts', placement.chartId, placement.chartRevision);
        setResolvedCharts(current => ({...current, [chart.id]: chart}));
        if (chart.document) {
          const filters = [
            platform && {field: 'platform_name', op: 'eq', value: platform},
            team && {field: 'team_name', op: 'eq', value: team},
            brand && {field: 'brand_name', op: 'eq', value: brand},
          ].filter(Boolean) as {field: string; op: string; value: string}[];
          const result = await api.query({...chart.document.spec.query, timeRange: {start: startDate, end: endDate}, filters: [...(chart.document.spec.query.filters ?? []), ...filters]});
          setResults(current => ({...current, [chart.id]: result}));
        }
      } catch { /* panel renders empty */ }
    });
  }, [document, startDate, endDate, platform, team, brand]);
  const layout: LayoutItem[] = document.spec.placements.map(item => ({i: item.chartId, x: item.x, y: item.y, w: item.w, h: item.h, minW: 2, minH: 2}));
  const add = (chart: Asset<ChartDocument>) => setDocument(current => ({...current, spec: {...current.spec, placements: [...current.spec.placements, {chartId: chart.id, chartRevision: chart.latestRevision, x: 0, y: Infinity, w: 4, h: 4}]}}));
  const save = async () => {
    if (dashboard) await api.update('dashboards', dashboard, document);
    else await api.create('dashboards', document.metadata.name, document.metadata.title, document);
    onSaved();
  };
  return <div className="dashboard-workspace">
    <aside className="panel library"><h2>차트 라이브러리</h2>{charts.filter(c => !c.archived).map(chart => <button className="library-item" key={chart.id} onClick={() => add(chart)}><strong>{chart.title}</strong><span>r{chart.latestRevision}</span></button>)}</aside>
    <main className="panel canvas" ref={containerRef}>
      <div className="canvas-toolbar"><input value={document.metadata.title} onChange={e => setDocument({...document, metadata: {...document.metadata, title: e.target.value}})} /><button className="primary" onClick={save}>대시보드 저장</button></div>
      <div className="filter-bar"><label>시작일<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>종료일<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label><label>플랫폼<input placeholder="전체" value={platform} onChange={e => setPlatform(e.target.value)} /></label><label>팀<input placeholder="전체" value={team} onChange={e => setTeam(e.target.value)} /></label><label>브랜드<input placeholder="전체" value={brand} onChange={e => setBrand(e.target.value)} /></label></div>
      {mounted && <GridLayout width={width} layout={layout} gridConfig={{cols: 12, rowHeight: 70, margin: [16, 16]}} dragConfig={{enabled: true}} resizeConfig={{enabled: true}}
        onLayoutChange={next => setDocument(current => ({...current, spec: {...current.spec, placements: current.spec.placements.map(item => {
          const pos = next.find(value => value.i === item.chartId); return pos ? {...item, x: pos.x, y: pos.y, w: pos.w, h: pos.h} : item;
        })}}))}>
        {document.spec.placements.map(item => {
          const latest = chartMap.get(item.chartId);
          const chart = resolvedCharts[item.chartId];
          return <div className="dashboard-panel" key={item.chartId}><div className="drag-handle">{chart?.title ?? latest?.title ?? '차트 없음'} <small>r{item.chartRevision}</small>
            {latest && latest.latestRevision > item.chartRevision && <button className="update-badge" onClick={() => setDocument(current => ({...current, spec: {...current.spec, placements: current.spec.placements.map(value => value.chartId === item.chartId ? {...value, chartRevision: latest.latestRevision} : value)}}))}>r{latest.latestRevision}로 갱신</button>}</div>
            {chart?.document && <ChartRenderer document={chart.document} result={results[item.chartId]} />}</div>;
        })}
      </GridLayout>}
      {!document.spec.placements.length && <div className="empty large">왼쪽 라이브러리에서 차트를 추가하세요.</div>}
      <details className="dashboard-json"><summary>DashboardDocument JSON 편집</summary><Editor height="360px" language="json" theme="vs-dark" value={JSON.stringify(document, null, 2)} onChange={value => {
        try {
          const next = JSON.parse(value ?? '') as DashboardDocument;
          if (next.apiVersion === 'flooks.io/v1alpha1' && next.kind === 'Dashboard') setDocument(next);
        } catch { /* 유효한 JSON이 될 때까지 현재 document를 유지한다. */ }
      }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} /></details>
    </main>
  </div>;
}
