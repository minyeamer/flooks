import Editor from '@monaco-editor/react';
import {useEffect, useState} from 'react';
import {api} from './api';
import {ChartSettingsPanel} from './ChartSettingsPanel';
import {chartDocumentReady, filterIsComplete, parseFilterValue} from './chartEditing';
import {ChartRenderer} from './ChartRenderer';
import type {Asset, ChartDocument, QueryResult} from './types';

export {filterIsComplete, parseFilterValue} from './chartEditing';

const yesterday = new Date(Date.now() - 86400000);
const monthAgo = new Date(yesterday.getTime() - 29 * 86400000);
const date = (value: Date) => value.toISOString().slice(0, 10);

export function newChart(title = '새 광고 차트', type: ChartDocument['spec']['visualization']['type'] = 'bar'): ChartDocument {
  return {apiVersion: 'flooks.io/v1alpha1', kind: 'Chart', metadata: {name: `chart-${Date.now()}`, title}, spec: {datasetKey: 'ads_daily', visualization: {type, valueFormat: type === 'kpi' ? 'currency' : 'number'}, query: {datasetKey: 'ads_daily', timeRange: {start: date(monthAgo), end: date(yesterday)}, dimensions: type === 'kpi' ? [] : ['platform_name'], metrics: ['ad_cost'], limit: type === 'kpi' ? 1 : 100}}};
}

export function ChartEditor({asset, onSaved}: {asset?: Asset<ChartDocument>; onSaved: () => void}) {
  const [document, setDocument] = useState<ChartDocument>(() => asset?.document ?? newChart());
  const [jsonText, setJsonText] = useState(() => JSON.stringify(document, null, 2));
  const [jsonInvalid, setJsonInvalid] = useState(false);
  const [result, setResult] = useState<QueryResult>();
  const [revisions, setRevisions] = useState<{revision: number; summary: string; createdAt: string}[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { if (asset?.document) { setDocument(asset.document); setJsonText(JSON.stringify(asset.document, null, 2)); setJsonInvalid(false); api.revisions('charts', asset.id).then(setRevisions).catch(() => setRevisions([])); } else setRevisions([]); }, [asset]);
  const patch = (next: ChartDocument) => { setDocument(next); setJsonText(JSON.stringify(next, null, 2)); setJsonInvalid(false); };
  const run = async (refresh = false) => { if (jsonInvalid || !chartDocumentReady(document)) { setError(jsonInvalid ? 'JSON 문법을 확인하세요.' : '필터 값과 지표를 확인하세요.'); return; } try { setError(''); setResult(await api.query(document.spec.query, refresh)); } catch (reason) { setError(String(reason)); } };
  const save = async () => { if (jsonInvalid || !chartDocumentReady(document)) { setError(jsonInvalid ? 'JSON 문법을 확인하세요.' : '필터 값과 지표를 확인하세요.'); return; } try { setError(''); if (asset) await api.update('charts', asset, document); else await api.create('charts', document.metadata.name, document.metadata.title, document); onSaved(); } catch (reason) { setError(String(reason)); } };
  const exportJSON = () => { const link = window.document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], {type: 'application/json'})); link.download = `${document.metadata.name}.json`; link.click(); URL.revokeObjectURL(link.href); };
  return <div className="chart-editor-layout"><main className="chart-workspace"><div className="chart-editor-toolbar"><div><small>{asset ? `차트 · r${asset.latestRevision}` : '새 ChartAsset'}</small><h2>{document.metadata.title || '제목 없는 차트'}</h2></div><div className="actions"><button onClick={() => run(false)}>미리보기</button><button className="secondary" onClick={() => run(true)}>강제 새로고침</button><button className="primary" onClick={save}>저장</button></div></div><section className="panel preview chart-preview"><ChartRenderer document={document} result={result} /></section>{result && <p className="query-meta">{result.rowCount}행 · {result.durationMs}ms · {result.cached ? '캐시 결과' : '원본 결과'}</p>}{error && <p className="error">{error}</p>}<details className="panel advanced-json"><summary>JSON 고급 편집 및 가져오기·내보내기</summary><div className="advanced-json-actions"><button onClick={exportJSON}>JSON 내보내기</button><label className="file-button">JSON 가져오기<input type="file" accept="application/json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { patch(JSON.parse(await file.text()) as ChartDocument); setError(''); } catch { setError('올바른 Chart JSON 파일이 아닙니다.'); } }} /></label></div><Editor height="400px" language="json" theme="vs-dark" value={jsonText} onChange={value => { setJsonText(value ?? ''); try { setDocument(JSON.parse(value ?? '') as ChartDocument); setJsonInvalid(false); setError(''); } catch { setJsonInvalid(true); } }} options={{minimap: {enabled: false}, automaticLayout: true, formatOnPaste: true}} /></details></main><aside className="panel chart-settings"><ChartSettingsPanel document={document} onChange={patch} />{revisions.length > 0 && <section className="settings-section revision-list"><h3>Revision</h3>{revisions.map(item => <button key={item.revision} disabled={item.revision === asset?.latestRevision} onClick={async () => { if (!asset) return; await api.restore('charts', asset, item.revision); onSaved(); }}>r{item.revision} · {item.summary || '변경'}<small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small></button>)}</section>}</aside></div>;
}
