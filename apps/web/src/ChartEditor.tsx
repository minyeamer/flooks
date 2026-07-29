import Editor from '@monaco-editor/react';
import {useEffect, useMemo, useState} from 'react';
import {api} from './api';
import {ChartRenderer} from './ChartRenderer';
import type {Asset, ChartDocument, DatasetDimension, DatasetManifest, QueryResult, QuerySpec} from './types';

const yesterday = new Date(Date.now() - 86400000);
const monthAgo = new Date(yesterday.getTime() - 29 * 86400000);
const date = (value: Date) => value.toISOString().slice(0, 10);
type Filter = NonNullable<QuerySpec['filters']>[number];
type Sort = NonNullable<QuerySpec['sort']>[number];
type ChartType = ChartDocument['spec']['visualization']['type'];

const operatorLabel: Record<string, string> = {eq: '같음', in: '목록 중 하나', contains: '포함', between: '범위', isNull: '비어 있음 여부'};

export function newChart(title = '새 광고 차트', type: ChartType = 'bar'): ChartDocument {
  return {apiVersion: 'flooks.io/v1alpha1', kind: 'Chart', metadata: {name: `chart-${Date.now()}`, title}, spec: {
    datasetKey: 'ads_daily', visualization: {type, valueFormat: type === 'kpi' ? 'currency' : 'number'},
    query: {datasetKey: 'ads_daily', timeRange: {start: date(monthAgo), end: date(yesterday)}, dimensions: type === 'kpi' ? [] : ['platform_name'], metrics: ['ad_cost'], limit: type === 'kpi' ? 1 : 100},
  }};
}

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

function valueAt(filter: Filter, index = 0): string {
  if (Array.isArray(filter.value)) return String(filter.value[index] ?? '');
  return typeof filter.value === 'string' ? filter.value : '';
}

function defaultQuery(manifest: DatasetManifest, current: QuerySpec, type: ChartType): QuerySpec {
  const firstDimension = manifest.dimensions[0]?.key;
  return {
    datasetKey: manifest.key,
    timeRange: current.timeRange,
    dimensions: type === 'kpi' || !firstDimension ? [] : [firstDimension],
    metrics: manifest.metrics[0] ? [manifest.metrics[0].key] : [],
    filters: [], sort: [], limit: type === 'kpi' ? 1 : manifest.limits.defaultRows,
  };
}

export function ChartEditor({asset, onSaved}: {asset?: Asset<ChartDocument>; onSaved: () => void}) {
  const [document, setDocument] = useState<ChartDocument>(() => asset?.document ?? newChart());
  const [jsonText, setJsonText] = useState(() => JSON.stringify(document, null, 2));
  const [jsonInvalid, setJsonInvalid] = useState(false);
  const [datasets, setDatasets] = useState<DatasetManifest[]>([]);
  const [result, setResult] = useState<QueryResult>();
  const [revisions, setRevisions] = useState<{revision: number; summary: string; createdAt: string}[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { api.datasets().then(setDatasets).catch(reason => setError(String(reason))); }, []);
  useEffect(() => {
    if (asset?.document) {
      setDocument(asset.document); setJsonText(JSON.stringify(asset.document, null, 2)); setJsonInvalid(false);
      api.revisions('charts', asset.id).then(setRevisions).catch(() => setRevisions([]));
    } else setRevisions([]);
  }, [asset]);

  const manifest = useMemo(() => datasets.find(item => item.key === document.spec.datasetKey), [datasets, document.spec.datasetKey]);
  const dimensions = document.spec.query.dimensions ?? [];
  const metrics = document.spec.query.metrics ?? [];
  const filters = document.spec.query.filters ?? [];
  const sorts = document.spec.query.sort ?? [];
  const invalidFilters = filters.some(filter => !filterIsComplete(filter));
  const canRun = !jsonInvalid && !invalidFilters && metrics.length > 0;
  const patch = (next: ChartDocument) => { setDocument(next); setJsonText(JSON.stringify(next, null, 2)); setJsonInvalid(false); };
  const patchQuery = (query: QuerySpec) => patch({...document, spec: {...document.spec, query}});
  const patchVisualization = (visualization: ChartDocument['spec']['visualization']) => patch({...document, spec: {...document.spec, visualization}});

  const changeType = (type: ChartType) => {
    const query = {...document.spec.query, dimensions: type === 'kpi' ? [] : dimensions.length ? dimensions : manifest?.dimensions[0] ? [manifest.dimensions[0].key] : [], limit: type === 'kpi' ? 1 : document.spec.query.limit || manifest?.limits.defaultRows || 100};
    patch({...document, spec: {...document.spec, visualization: {...document.spec.visualization, type}, query}});
  };
  const changeDataset = (key: string) => {
    const next = datasets.find(item => item.key === key);
    if (!next) return;
    patch({...document, spec: {...document.spec, datasetKey: key, query: defaultQuery(next, document.spec.query, document.spec.visualization.type)}});
  };
  const updateFilters = (next: Filter[]) => patchQuery({...document.spec.query, filters: next});
  const updateSorts = (next: Sort[]) => patchQuery({...document.spec.query, sort: next});
  const run = async (refresh = false) => {
    if (!canRun) { setError(jsonInvalid ? 'JSON 문법을 확인하세요.' : invalidFilters ? '모든 필터 값을 입력하세요.' : '최소 한 개의 지표를 선택하세요.'); return; }
    try { setError(''); setResult(await api.query(document.spec.query, refresh)); } catch (reason) { setError(String(reason)); }
  };
  const save = async () => {
    if (!canRun) { setError(jsonInvalid ? 'JSON 문법을 확인하세요.' : invalidFilters ? '모든 필터 값을 입력하세요.' : '최소 한 개의 지표를 선택하세요.'); return; }
    try { setError(''); if (asset) await api.update('charts', asset, document); else await api.create('charts', document.metadata.name, document.metadata.title, document); onSaved(); } catch (reason) { setError(String(reason)); }
  };
  const exportJSON = () => {
    const link = window.document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], {type: 'application/json'})); link.download = `${document.metadata.name}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const addFilter = () => {
    const dimension = manifest?.dimensions[0]; if (!dimension) return;
    updateFilters([...filters, {field: dimension.key, op: dimension.filterOperators[0] ?? 'eq', value: ''}]);
  };
  const addSort = () => { const field = dimensions[0] ?? metrics[0] ?? manifest?.dimensions[0]?.key; if (field) updateSorts([...sorts, {field, direction: 'asc'}]); };

  return <div className="chart-editor-layout">
    <main className="chart-workspace">
      <div className="chart-editor-toolbar">
        <div><small>{asset ? `차트 · r${asset.latestRevision}` : '새 ChartAsset'}</small><h2>{document.metadata.title || '제목 없는 차트'}</h2></div>
        <div className="actions"><button onClick={() => run(false)}>미리보기</button><button className="secondary" onClick={() => run(true)}>강제 새로고침</button><button className="primary" onClick={save}>저장</button></div>
      </div>
      <section className="panel preview chart-preview"><ChartRenderer document={document} result={result} /></section>
      {result && <p className="query-meta">{result.rowCount}행 · {result.durationMs}ms · {result.cached ? '캐시 결과' : '원본 결과'}</p>}
      {error && <p className="error">{error}</p>}
      <details className="panel advanced-json"><summary>JSON 고급 편집 및 가져오기·내보내기</summary>
        <div className="advanced-json-actions"><button onClick={exportJSON}>JSON 내보내기</button><label className="file-button">JSON 가져오기<input type="file" accept="application/json" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          try { patch(JSON.parse(await file.text()) as ChartDocument); setError(''); } catch { setError('올바른 Chart JSON 파일이 아닙니다.'); }
        }} /></label></div>
        <Editor height="400px" language="json" theme="vs-dark" value={jsonText} onChange={value => {
          setJsonText(value ?? ''); try { setDocument(JSON.parse(value ?? '') as ChartDocument); setJsonInvalid(false); setError(''); } catch { setJsonInvalid(true); }
        }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} />
      </details>
    </main>
    <aside className="panel chart-settings">
      <div className="settings-heading"><h2>차트 설정</h2><p>필드를 추가하거나 제거해 조회와 표시를 바꿉니다.</p></div>
      <section className="settings-section"><h3>기본</h3>
        <label>제목<input value={document.metadata.title} onChange={event => patch({...document, metadata: {...document.metadata, title: event.target.value}})} /></label>
        <label>차트 유형<select value={document.spec.visualization.type} onChange={event => changeType(event.target.value as ChartType)}><option value="kpi">KPI</option><option value="line">라인</option><option value="bar">막대</option><option value="table">표</option></select></label>
        <label>데이터셋<select value={document.spec.datasetKey} onChange={event => changeDataset(event.target.value)}>{datasets.length === 0 && <option>{document.spec.datasetKey}</option>}{datasets.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      </section>
      <section className="settings-section"><h3>기간</h3><div className="date-range"><label>시작<input type="date" value={document.spec.query.timeRange.start} onChange={event => patchQuery({...document.spec.query, timeRange: {...document.spec.query.timeRange, start: event.target.value}})} /></label><label>끝<input type="date" value={document.spec.query.timeRange.end} onChange={event => patchQuery({...document.spec.query, timeRange: {...document.spec.query.timeRange, end: event.target.value}})} /></label></div></section>
      {document.spec.visualization.type !== 'kpi' && <FieldSection title="차원" fields={manifest?.dimensions ?? []} selected={dimensions} onChange={next => patchQuery({...document.spec.query, dimensions: next})} emptyText="차원을 추가하세요." />}
      <FieldSection title="지표" fields={manifest?.metrics ?? []} selected={metrics} onChange={next => patchQuery({...document.spec.query, metrics: next})} max={document.spec.visualization.type === 'kpi' ? 1 : 3} emptyText="지표를 추가하세요." />
      <section className="settings-section"><h3>표시</h3><label>값 형식<select value={document.spec.visualization.valueFormat ?? 'number'} onChange={event => patchVisualization({...document.spec.visualization, valueFormat: event.target.value as 'number' | 'currency' | 'percent'})}><option value="number">숫자</option><option value="currency">통화</option><option value="percent">백분율</option></select></label>{document.spec.visualization.type === 'bar' && <label className="check-label"><input type="checkbox" checked={Boolean(document.spec.visualization.stacked)} onChange={event => patchVisualization({...document.spec.visualization, stacked: event.target.checked})} /> 누적 막대</label>}{document.spec.visualization.type === 'table' && <label>페이지 크기<input type="number" min="1" max={manifest?.limits.maxRows ?? 500} value={document.spec.query.limit ?? 100} onChange={event => patchQuery({...document.spec.query, limit: Number(event.target.value)})} /></label>}</section>
      {document.spec.visualization.type === 'table' && <TableSettings columns={[...dimensions, ...metrics]} manifest={manifest} visualization={document.spec.visualization} onChange={patchVisualization} />}
      <section className="settings-section"><div className="section-title"><h3>필터</h3><button onClick={addFilter} disabled={!manifest?.dimensions.length}>필터 추가</button></div>{filters.length === 0 ? <p className="muted">이 차트에 적용할 필터가 없습니다.</p> : filters.map((filter, index) => <FilterRow key={`${filter.field}-${index}`} filter={filter} dimensions={manifest?.dimensions ?? []} onChange={next => updateFilters(filters.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => updateFilters(filters.filter((_, itemIndex) => itemIndex !== index))} />)}</section>
      <section className="settings-section"><div className="section-title"><h3>정렬</h3><button onClick={addSort}>정렬 추가</button></div>{sorts.length === 0 ? <p className="muted">기본 데이터셋 순서를 사용합니다.</p> : sorts.map((sort, index) => <div className="rule-row" key={`${sort.field}-${index}`}><select value={sort.field} onChange={event => updateSorts(sorts.map((item, itemIndex) => itemIndex === index ? {...item, field: event.target.value} : item))}>{[...(manifest?.dimensions ?? []), ...(manifest?.metrics ?? [])].map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</select><select value={sort.direction} onChange={event => updateSorts(sorts.map((item, itemIndex) => itemIndex === index ? {...item, direction: event.target.value as Sort['direction']} : item))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select><button aria-label="정렬 삭제" onClick={() => updateSorts(sorts.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</section>
      {revisions.length > 0 && <section className="settings-section revision-list"><h3>Revision</h3>{revisions.map(item => <button key={item.revision} disabled={item.revision === asset?.latestRevision} onClick={async () => { if (!asset) return; await api.restore('charts', asset, item.revision); onSaved(); }}>r{item.revision} · {item.summary || '변경'}<small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small></button>)}</section>}
    </aside>
  </div>;
}

function FieldSection({title, fields, selected, onChange, max, emptyText}: {title: string; fields: {key: string; label: string}[]; selected: string[]; onChange: (next: string[]) => void; max?: number; emptyText: string}) {
  const available = fields.filter(field => !selected.includes(field.key));
  return <section className="settings-section"><div className="section-title"><h3>{title}</h3><select aria-label={`${title} 추가`} value="" disabled={!available.length || (max !== undefined && selected.length >= max)} onChange={event => { if (event.target.value) onChange([...selected, event.target.value]); }}><option value="">+ 추가</option>{available.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</select></div>{selected.length === 0 ? <p className="muted">{emptyText}</p> : <div className="field-chips">{selected.map(key => <span className="field-chip" key={key}>{fieldLabelFromFields(fields, key)}<button aria-label={`${key} 삭제`} onClick={() => onChange(selected.filter(item => item !== key))}>×</button></span>)}</div>}</section>;
}

function fieldLabelFromFields(fields: {key: string; label: string}[], key: string) { return fields.find(field => field.key === key)?.label ?? key; }

function TableSettings({columns, manifest, visualization, onChange}: {columns: string[]; manifest?: DatasetManifest; visualization: ChartDocument['spec']['visualization']; onChange: (next: ChartDocument['spec']['visualization']) => void}) {
  const table = visualization.table ?? {layout: 'fit' as const, frozenColumns: 0, columnWidths: {}};
  const layout = table.layout ?? 'fit';
  const widths = table.columnWidths ?? {};
  const update = (next: Partial<NonNullable<ChartDocument['spec']['visualization']['table']>>) => onChange({...visualization, table: {...table, ...next}});
  const field = (key: string) => [...(manifest?.dimensions ?? []), ...(manifest?.metrics ?? [])].find(item => item.key === key);
  return <section className="settings-section table-settings"><h3>표 열</h3>
    <label>너비 방식<select value={layout} onChange={event => update({layout: event.target.value as 'fit' | 'fixed', frozenColumns: event.target.value === 'fixed' ? table.frozenColumns ?? 0 : 0})}><option value="fit">표 크기에 맞춤</option><option value="fixed">고정 너비와 가로 스크롤</option></select></label>
    <p className="muted">{layout === 'fit' ? '각 숫자는 상대 비율입니다. 표는 항상 컨테이너 너비를 채우며 크기가 바뀌면 함께 조정됩니다.' : '각 숫자는 픽셀(px)입니다. 고정 열 뒤의 열은 가로로 스크롤해 볼 수 있습니다.'}</p>
    {layout === 'fixed' && <label>왼쪽 고정 열 수<select value={Math.min(table.frozenColumns ?? 0, columns.length)} onChange={event => update({frozenColumns: Number(event.target.value)})}>{Array.from({length: columns.length + 1}, (_, value) => <option key={value} value={value}>{value}개</option>)}</select></label>}
    <div className="column-width-list">{columns.map(key => <label key={key}><span>{field(key)?.label ?? key}</span><input type="number" min="1" step="1" value={widths[key] ?? (layout === 'fit' ? 1 : 180)} onChange={event => update({columnWidths: {...widths, [key]: Math.max(1, Number(event.target.value) || 1)}})} /><small>{layout === 'fit' ? '비율' : 'px'}</small></label>)}</div>
  </section>;
}

function FilterRow({filter, dimensions, onChange, onRemove}: {filter: Filter; dimensions: DatasetDimension[]; onChange: (next: Filter) => void; onRemove: () => void}) {
  const dimension = dimensions.find(item => item.key === filter.field) ?? dimensions[0];
  const operators = dimension?.filterOperators ?? [];
  const dateInput = dimension?.type === 'date' ? 'date' : 'text';
  const changeValue = (first: string, second = '', isNull = false) => onChange({...filter, value: parseFilterValue(filter.op, first, second, isNull)});
  return <div className="filter-rule"><div className="rule-row"><select value={filter.field} onChange={event => { const next = dimensions.find(item => item.key === event.target.value); onChange({field: event.target.value, op: next?.filterOperators[0] ?? 'eq', value: ''}); }}>{dimensions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><select value={filter.op} onChange={event => onChange({...filter, op: event.target.value, value: event.target.value === 'isNull' ? false : ''})}>{operators.map(op => <option key={op} value={op}>{operatorLabel[op]}</option>)}</select><button aria-label="필터 삭제" onClick={onRemove}>×</button></div>{filter.op === 'isNull' ? <label className="check-label"><input type="checkbox" checked={Boolean(filter.value)} onChange={event => changeValue('', '', event.target.checked)} /> 값이 비어 있는 행만</label> : filter.op === 'between' ? <div className="rule-values"><input type={dateInput} value={valueAt(filter, 0)} onChange={event => changeValue(event.target.value, valueAt(filter, 1))} /><input type={dateInput} value={valueAt(filter, 1)} onChange={event => changeValue(valueAt(filter, 0), event.target.value)} /></div> : <input type={dateInput} placeholder={filter.op === 'in' ? '쉼표로 구분: A, B' : '값 입력'} value={valueAt(filter)} onChange={event => changeValue(event.target.value)} />}</div>;
}
