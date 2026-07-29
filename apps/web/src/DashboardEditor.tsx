import Editor from '@monaco-editor/react';
import {useEffect, useMemo, useState} from 'react';
import {GridLayout, useContainerWidth, type LayoutItem} from 'react-grid-layout';
import {api} from './api';
import {ChartSettingsPanel} from './ChartSettingsPanel';
import {chartDocumentReady} from './chartEditing';
import {ChartRenderer} from './ChartRenderer';
import {duplicatePlacement, newPlacementID, normalizeDashboardDocument, pinPlacementRevision} from './dashboardPlacements';
import type {Asset, ChartDocument, DashboardDocument, Placement, QueryResult} from './types';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type PanelState = {result?: QueryResult; loading?: boolean; error?: string; updatedAt?: Date};
type CommonFilters = {startDate: string; endDate: string; platform: string; team: string; brand: string};

const defaultDashboard = (): DashboardDocument => ({apiVersion: 'flooks.io/v1alpha1', kind: 'Dashboard', metadata: {name: 'ads-overview', title: '광고 성과 대시보드'}, spec: {columns: 12, filters: ['date', 'platform_name', 'team_name', 'brand_name'], placements: []}});
const queryFilters = (filters: CommonFilters) => [filters.platform && {field: 'platform_name', op: 'eq', value: filters.platform}, filters.team && {field: 'team_name', op: 'eq', value: filters.team}, filters.brand && {field: 'brand_name', op: 'eq', value: filters.brand}].filter(Boolean) as {field: string; op: string; value: string}[];

export function DashboardEditor({dashboard, charts, onSaved}: {dashboard?: Asset<DashboardDocument>; charts: Asset<ChartDocument>[]; onSaved: () => void}) {
  const [document, setDocument] = useState<DashboardDocument>(() => normalizeDashboardDocument(dashboard?.document ?? defaultDashboard()));
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>({});
  const [resolvedCharts, setResolvedCharts] = useState<Record<string, Asset<ChartDocument>>>({});
  const [selectedPlacementID, setSelectedPlacementID] = useState<string>();
  const [showPicker, setShowPicker] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const today = new Date(Date.now() - 86400000); const earlier = new Date(today.getTime() - 29 * 86400000);
  const [filters, setFilters] = useState<CommonFilters>({startDate: params.get('start') ?? earlier.toISOString().slice(0, 10), endDate: params.get('end') ?? today.toISOString().slice(0, 10), platform: params.get('platform') ?? '', team: params.get('team') ?? '', brand: params.get('brand') ?? ''});
  const {width, containerRef, mounted} = useContainerWidth();
  const chartMap = useMemo(() => new Map(charts.map(chart => [chart.id, chart])), [charts]);
  const selectedPlacement = document.spec.placements.find(placement => placement.id === selectedPlacementID);

  const updateDocument = (next: DashboardDocument) => { setDocument(next); setDirty(true); };
  const executePanel = async (placement: Placement, chartDocument: ChartDocument, refresh = false, cancelled?: () => boolean) => {
    setPanelStates(current => ({...current, [placement.id]: {...current[placement.id], loading: true, error: undefined}}));
    try {
      const result = await api.query({...chartDocument.spec.query, timeRange: {start: filters.startDate, end: filters.endDate}, filters: [...(chartDocument.spec.query.filters ?? []), ...queryFilters(filters)]}, refresh);
      if (!cancelled?.()) setPanelStates(current => ({...current, [placement.id]: {result, loading: false, updatedAt: new Date()}}));
      return result;
    } catch (reason) {
      if (!cancelled?.()) setPanelStates(current => ({...current, [placement.id]: {...current[placement.id], loading: false, error: String(reason)}}));
      return undefined;
    }
  };

  useEffect(() => { if (dashboard?.document) { setDocument(normalizeDashboardDocument(dashboard.document)); setDirty(false); setSelectedPlacementID(undefined); } }, [dashboard]);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of [['start', filters.startDate], ['end', filters.endDate], ['platform', filters.platform], ['team', filters.team], ['brand', filters.brand]]) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    window.history.replaceState({}, '', url);
    let cancelled = false;
    document.spec.placements.forEach(async placement => {
      try {
        const chart = await api.get<ChartDocument>('charts', placement.chartId, placement.chartRevision);
        if (cancelled || !chart.document) return;
        setResolvedCharts(current => ({...current, [placement.id]: chart}));
        await executePanel(placement, chart.document, false, () => cancelled);
      } catch (reason) { if (!cancelled) setPanelStates(current => ({...current, [placement.id]: {...current[placement.id], error: String(reason)}})); }
    });
    return () => { cancelled = true; };
  }, [document, filters.startDate, filters.endDate, filters.platform, filters.team, filters.brand]);

  const layout: LayoutItem[] = document.spec.placements.map(item => ({i: item.id, x: item.x, y: item.y, w: item.w, h: item.h, minW: 2, minH: 2}));
  const add = (chart: Asset<ChartDocument>) => { updateDocument({...document, spec: {...document.spec, placements: [...document.spec.placements, {id: newPlacementID(), chartId: chart.id, chartRevision: chart.latestRevision, x: 0, y: Infinity, w: 4, h: 4}]}}); setShowPicker(false); };
  const removeSelected = () => { if (!selectedPlacement) return; updateDocument({...document, spec: {...document.spec, placements: document.spec.placements.filter(item => item.id !== selectedPlacement.id)}}); setSelectedPlacementID(undefined); };
  const cloneSelected = () => { if (!selectedPlacement) return; updateDocument({...document, spec: {...document.spec, placements: [...document.spec.placements, duplicatePlacement(selectedPlacement)]}}); };
  const saveDashboard = async () => { try { setSaveError(''); if (dashboard) await api.update('dashboards', dashboard, document); else await api.create('dashboards', document.metadata.name, document.metadata.title, document); setDirty(false); onSaved(); } catch (reason) { setSaveError(String(reason)); } };
  const pinSavedChart = (asset: Asset<ChartDocument>, chartDocument: ChartDocument) => {
    if (!selectedPlacement) return;
    updateDocument({...document, spec: {...document.spec, placements: pinPlacementRevision(document.spec.placements, selectedPlacement.id, asset.latestRevision)}});
    setResolvedCharts(current => ({...current, [selectedPlacement.id]: {...asset, document: chartDocument}}));
  };
  const refreshSelected = () => { if (selectedPlacement) { const chart = resolvedCharts[selectedPlacement.id]; if (chart?.document) void executePanel(selectedPlacement, chart.document, true); } };

  return <div className={`dashboard-shell ${selectedPlacement ? 'drawer-open' : ''}`}>
    <main className="panel canvas dashboard-canvas" ref={containerRef}>
      <div className="canvas-toolbar"><input value={document.metadata.title} onChange={event => updateDocument({...document, metadata: {...document.metadata, title: event.target.value}})} /><span className={dirty ? 'dashboard-dirty' : 'dashboard-saved'}>{dirty ? '저장되지 않은 변경' : '저장됨'}</span><button onClick={() => setShowPicker(value => !value)}>+ 차트 추가</button><button className="secondary" onClick={() => document.spec.placements.forEach(placement => { const chart = resolvedCharts[placement.id]; if (chart?.document) void executePanel(placement, chart.document, true); })}>전체 새로고침</button><button className="primary" onClick={saveDashboard}>대시보드 저장</button></div>
      {showPicker && <div className="chart-picker panel"><h2>차트 추가</h2>{charts.filter(chart => !chart.archived).map(chart => <button className="library-item" key={chart.id} onClick={() => add(chart)}><strong>{chart.title}</strong><span>r{chart.latestRevision}</span></button>)}</div>}
      <div className="filter-bar"><label>시작일<input type="date" value={filters.startDate} onChange={event => setFilters({...filters, startDate: event.target.value})} /></label><label>종료일<input type="date" value={filters.endDate} onChange={event => setFilters({...filters, endDate: event.target.value})} /></label><label>플랫폼<input placeholder="전체" value={filters.platform} onChange={event => setFilters({...filters, platform: event.target.value})} /></label><label>팀<input placeholder="전체" value={filters.team} onChange={event => setFilters({...filters, team: event.target.value})} /></label><label>브랜드<input placeholder="전체" value={filters.brand} onChange={event => setFilters({...filters, brand: event.target.value})} /></label></div>
      {saveError && <p className="error dashboard-error">{saveError}</p>}
      {mounted && <GridLayout width={width} layout={layout} gridConfig={{cols: 12, rowHeight: 70, margin: [16, 16]}} dragConfig={{enabled: true}} resizeConfig={{enabled: true}} onLayoutChange={next => updateDocument({...document, spec: {...document.spec, placements: document.spec.placements.map(item => { const pos = next.find(value => value.i === item.id); return pos ? {...item, x: pos.x, y: pos.y, w: pos.w, h: pos.h} : item; })}})}>{document.spec.placements.map(item => {
        const latest = chartMap.get(item.chartId); const chart = resolvedCharts[item.id]; const state = panelStates[item.id]; const selected = item.id === selectedPlacementID;
        return <div className={`dashboard-panel ${selected ? 'selected' : ''}`} key={item.id}><div className="drag-handle">{chart?.title ?? latest?.title ?? '차트 없음'} <small>r{item.chartRevision}</small>{latest && latest.latestRevision > item.chartRevision && <button className="update-badge" onClick={() => updateDocument({...document, spec: {...document.spec, placements: pinPlacementRevision(document.spec.placements, item.id, latest.latestRevision)}})}>r{latest.latestRevision}로 갱신</button>}</div><div className="dashboard-panel-body" role="button" tabIndex={0} aria-label={`${chart?.title ?? '차트'} 편집`} onClick={() => setSelectedPlacementID(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedPlacementID(item.id); } }}>{state?.loading && <div className="panel-status">조회 중…</div>}{state?.error ? <div className="panel-status error">{state.error}<button onClick={event => { event.stopPropagation(); if (chart?.document) void executePanel(item, chart.document, true); }}>재시도</button></div> : chart?.document && <ChartRenderer document={chart.document} result={state?.result} />}{state?.updatedAt && <small className="panel-updated">{state.updatedAt.toLocaleTimeString('ko-KR')} · {state.result?.cached ? '캐시' : '원본'}</small>}</div></div>;
      })}</GridLayout>}
      {!document.spec.placements.length && <div className="empty large">차트 추가 버튼으로 패널을 배치하세요.</div>}
      <details className="dashboard-json"><summary>DashboardDocument JSON 편집</summary><Editor height="360px" language="json" theme="vs-dark" value={JSON.stringify(document, null, 2)} onChange={value => { try { const next = JSON.parse(value ?? '') as DashboardDocument; if (next.apiVersion === 'flooks.io/v1alpha1' && next.kind === 'Dashboard') updateDocument(normalizeDashboardDocument(next)); } catch { /* 유효한 JSON이 될 때까지 현재 document를 유지한다. */ } }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} /></details>
    </main>
    {selectedPlacement && <DashboardChartDrawer placement={selectedPlacement} asset={chartMap.get(selectedPlacement.chartId)} pinned={resolvedCharts[selectedPlacement.id]} result={panelStates[selectedPlacement.id]?.result} onPreview={(draft, refresh) => executePanel(selectedPlacement, draft, refresh)} onSaved={pinSavedChart} onClose={() => setSelectedPlacementID(undefined)} onDelete={removeSelected} onDuplicate={cloneSelected} onRefresh={refreshSelected} />}
  </div>;
}

function DashboardChartDrawer({placement, asset, pinned, result, onPreview, onSaved, onClose, onDelete, onDuplicate, onRefresh}: {placement: Placement; asset?: Asset<ChartDocument>; pinned?: Asset<ChartDocument>; result?: QueryResult; onPreview: (draft: ChartDocument, refresh: boolean) => Promise<QueryResult | undefined>; onSaved: (asset: Asset<ChartDocument>, draft: ChartDocument) => void; onClose: () => void; onDelete: () => void; onDuplicate: () => void; onRefresh: () => void}) {
  const [draft, setDraft] = useState<ChartDocument>(); const [headAsset, setHeadAsset] = useState<Asset<ChartDocument>>(); const [baseline, setBaseline] = useState(''); const [jsonText, setJsonText] = useState(''); const [jsonInvalid, setJsonInvalid] = useState(false); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { const next = pinned?.document; if (next) { const serialized = JSON.stringify(next); setDraft(next); setBaseline(serialized); setJsonText(JSON.stringify(next, null, 2)); setJsonInvalid(false); setError(''); } }, [placement.id, pinned]);
  useEffect(() => { setHeadAsset(asset); }, [placement.id, asset]);
  const dirty = draft ? JSON.stringify(draft) !== baseline : false;
  const close = () => { if (!dirty || window.confirm('저장하지 않은 차트 변경사항을 버릴까요?')) onClose(); };
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const preview = async (refresh = false) => { if (!draft || jsonInvalid || !chartDocumentReady(draft)) { setError(jsonInvalid ? 'JSON 문법을 확인하세요.' : '필터 값과 지표를 확인하세요.'); return; } setError(''); await onPreview(draft, refresh); };
  const save = async () => { if (!headAsset || !draft || jsonInvalid || !chartDocumentReady(draft)) { setError(!headAsset ? '차트 정보를 불러오는 중입니다.' : jsonInvalid ? 'JSON 문법을 확인하세요.' : '필터 값과 지표를 확인하세요.'); return; } try { setSaving(true); setError(''); const updated = await api.update('charts', headAsset, draft, '대시보드에서 편집'); setHeadAsset(updated); onSaved(updated, draft); setBaseline(JSON.stringify(draft)); } catch (reason) { const status = (reason as Error & {status?: number}).status; setError(status === 412 ? '다른 변경이 먼저 저장되었습니다. 최신 revision을 불러온 뒤 다시 시도하세요.' : String(reason)); } finally { setSaving(false); } };
  const exportJSON = () => { if (!draft) return; const link = window.document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], {type: 'application/json'})); link.download = `${draft.metadata.name}.json`; link.click(); URL.revokeObjectURL(link.href); };
  return <aside className="panel dashboard-drawer" aria-label="선택한 차트 편집기"><div className="drawer-toolbar"><div><small>패널 · pinned r{placement.chartRevision}</small><h2>{draft?.metadata.title ?? '차트 불러오는 중'}</h2></div><button aria-label="편집기 닫기" onClick={close}>×</button></div><div className="drawer-actions"><button onClick={() => preview(false)}>미리보기</button><button className="secondary" onClick={() => preview(true)}>강제 새로고침</button><button className="primary" disabled={saving} onClick={save}>{saving ? '저장 중…' : '차트 저장'}</button></div><div className="drawer-panel-actions"><button onClick={onRefresh}>패널 새로고침</button><button onClick={onDuplicate}>패널 복제</button><button className="danger" onClick={onDelete}>패널 삭제</button></div>{error && <p className="error drawer-error">{error}</p>}{draft ? <><ChartSettingsPanel document={draft} onChange={next => { setDraft(next); setJsonText(JSON.stringify(next, null, 2)); setJsonInvalid(false); }} /><details className="advanced-json drawer-json"><summary>JSON 고급 편집 및 가져오기·내보내기</summary><div className="advanced-json-actions"><button onClick={exportJSON}>JSON 내보내기</button><label className="file-button">JSON 가져오기<input type="file" accept="application/json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const next = JSON.parse(await file.text()) as ChartDocument; setDraft(next); setJsonText(JSON.stringify(next, null, 2)); setJsonInvalid(false); } catch { setError('올바른 Chart JSON 파일이 아닙니다.'); } }} /></label></div><Editor height="360px" language="json" theme="vs-dark" value={jsonText} onChange={value => { setJsonText(value ?? ''); try { setDraft(JSON.parse(value ?? '') as ChartDocument); setJsonInvalid(false); setError(''); } catch { setJsonInvalid(true); } }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} /></details></> : <div className="empty">차트 정보를 불러오는 중입니다.</div>}</aside>;
}
