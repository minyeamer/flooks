import ReactECharts from 'echarts-for-react';
import {flexRender, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ChartDocument, QueryResult} from './types';

export function ChartRenderer({document, result}: {document: ChartDocument; result?: QueryResult}) {
  if (!result) return <div className="empty">질의를 실행하면 미리보기가 표시됩니다.</div>;
  const type = document.spec.visualization.type;
  const dimensions = document.spec.query.dimensions ?? [];
  const metrics = document.spec.query.metrics ?? [];
  if (type === 'kpi') {
    const value = Number(result.rows[0]?.[metrics[0]] ?? 0);
    const format = document.spec.visualization.valueFormat;
    const display = format === 'percent' ? `${(value * 100).toFixed(1)}%` : new Intl.NumberFormat('ko-KR', {style: format === 'currency' ? 'currency' : 'decimal', currency: 'KRW', maximumFractionDigits: 1}).format(value);
    return <div className="kpi"><span>{document.metadata.title}</span><strong>{display}</strong></div>;
  }
  if (type === 'table') return <DataTable result={result} />;
  const x = dimensions[0];
  return <ReactECharts style={{height: '100%', minHeight: 260}} option={{
    tooltip: {trigger: 'axis'}, legend: {}, grid: {left: 55, right: 24, top: 42, bottom: 42},
    dataset: {source: result.rows},
    xAxis: {type: 'category', name: x}, yAxis: {type: 'value'},
    series: metrics.map(metric => ({type, name: metric, encode: {x, y: metric}, stack: document.spec.visualization.stacked ? 'total' : undefined, smooth: type === 'line'})),
  }} />;
}

function DataTable({result}: {result: QueryResult}) {
  const table = useReactTable({
    data: result.rows,
    columns: result.columns.map(column => ({accessorKey: column.name, header: column.name, cell: (info: {getValue: () => unknown}) => formatCell(info.getValue())})),
    getCoreRowModel: getCoreRowModel(),
  });
  return <div className="table-scroll"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
    <tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>;
}
function formatCell(value: unknown) {
  if (typeof value === 'number') return new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 2}).format(value);
  return String(value ?? '-');
}
