import Editor from '@monaco-editor/react';
import {useEffect, useMemo, useState} from 'react';
import {api} from './api';
import {ChartRenderer} from './ChartRenderer';
import type {Asset, ChartDocument, QueryResult} from './types';

const yesterday = new Date(Date.now() - 86400000);
const monthAgo = new Date(yesterday.getTime() - 29 * 86400000);
const date = (value: Date) => value.toISOString().slice(0, 10);

export function newChart(title = '새 광고 차트', type: ChartDocument['spec']['visualization']['type'] = 'bar'): ChartDocument {
  return {apiVersion: 'flooks.io/v1alpha1', kind: 'Chart', metadata: {name: `chart-${Date.now()}`, title}, spec: {
    datasetKey: 'ads_daily', visualization: {type, valueFormat: type === 'kpi' ? 'currency' : 'number'},
    query: {datasetKey: 'ads_daily', timeRange: {start: date(monthAgo), end: date(yesterday)}, dimensions: type === 'kpi' ? [] : ['platform_name'], metrics: ['ad_cost'], limit: type === 'kpi' ? 1 : 100},
  }};
}

export function ChartEditor({asset, onSaved}: {asset?: Asset<ChartDocument>; onSaved: () => void}) {
  const [document, setDocument] = useState<ChartDocument>(() => asset?.document ?? newChart());
  const [jsonText, setJsonText] = useState(() => JSON.stringify(document, null, 2));
  const [result, setResult] = useState<QueryResult>();
  const [revisions, setRevisions] = useState<{revision: number; summary: string; createdAt: string}[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (asset?.document) {
      setDocument(asset.document);
      setJsonText(JSON.stringify(asset.document, null, 2));
      api.revisions('charts', asset.id).then(setRevisions).catch(() => setRevisions([]));
    } else setRevisions([]);
  }, [asset]);
  const dimensions = useMemo(() => (document.spec.query.dimensions ?? []).join(', '), [document]);
  const metrics = useMemo(() => (document.spec.query.metrics ?? []).join(', '), [document]);
  const patch = (next: ChartDocument) => {setDocument(next); setJsonText(JSON.stringify(next, null, 2));};
  const run = async (refresh = false) => {
    try { setError(''); setResult(await api.query(document.spec.query, refresh)); } catch (reason) { setError(String(reason)); }
  };
  const save = async () => {
    try {
      setError('');
      if (asset) await api.update('charts', asset, document);
      else await api.create('charts', document.metadata.name, document.metadata.title, document);
      onSaved();
    } catch (reason) { setError(String(reason)); }
  };
  const exportJSON = () => {
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], {type: 'application/json'}));
    link.download = `${document.metadata.name}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <div className="editor-layout">
    <section className="panel controls">
      <h2>{asset ? '차트 편집' : '새 차트'}</h2>
      <label>제목<input value={document.metadata.title} onChange={e => patch({...document, metadata: {...document.metadata, title: e.target.value}})} /></label>
      <label>형식<select value={document.spec.visualization.type} onChange={e => patch({...document, spec: {...document.spec, visualization: {...document.spec.visualization, type: e.target.value as ChartDocument['spec']['visualization']['type']}}})}>
        <option value="kpi">KPI</option><option value="line">라인</option><option value="bar">막대</option><option value="table">표</option>
      </select></label>
      <label>차원<input value={dimensions} onChange={e => patch({...document, spec: {...document.spec, query: {...document.spec.query, dimensions: e.target.value.split(',').map(v => v.trim()).filter(Boolean)}}})} /></label>
      <label>지표<input value={metrics} onChange={e => patch({...document, spec: {...document.spec, query: {...document.spec.query, metrics: e.target.value.split(',').map(v => v.trim()).filter(Boolean)}}})} /></label>
      <div className="actions"><button onClick={() => run(false)}>미리보기</button><button className="secondary" onClick={() => run(true)}>강제 새로고침</button><button className="primary" onClick={save}>저장</button><button onClick={exportJSON}>JSON 내보내기</button>
        <label className="file-button">JSON 가져오기<input type="file" accept="application/json" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          try { const next = JSON.parse(await file.text()) as ChartDocument; patch(next); setError(''); } catch { setError('올바른 Chart JSON 파일이 아닙니다.'); }
        }} /></label></div>
      {error && <p className="error">{error}</p>}
      {result && <small>{result.rowCount}행 · {result.durationMs}ms · {result.cached ? '캐시' : '원본'}</small>}
      {revisions.length > 0 && <div className="revision-list"><h3>Revision</h3>{revisions.map(item => <button key={item.revision} disabled={item.revision === asset?.latestRevision} onClick={async () => {
        if (!asset) return; await api.restore('charts', asset, item.revision); onSaved();
      }}>r{item.revision} · {item.summary || '변경'}<small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small></button>)}</div>}
    </section>
    <section className="panel preview"><ChartRenderer document={document} result={result} /></section>
    <section className="panel json-editor"><div className="panel-title">동일 문서 JSON</div><Editor height="430px" language="json" theme="vs-dark" value={jsonText} onChange={value => {
      setJsonText(value ?? '');
      try { const next = JSON.parse(value ?? '') as ChartDocument; setDocument(next); setError(''); } catch { setError('JSON 문법을 확인하세요.'); }
    }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} /></section>
  </div>;
}
