import {describe, expect, it} from 'vitest';
import {filterIsComplete, newChart, parseFilterValue} from './ChartEditor';

describe('newChart', () => {
  it('creates the canonical versioned chart document', () => {
    const chart = newChart('플랫폼별 광고비', 'bar');
    expect(chart.apiVersion).toBe('flooks.io/v1alpha1');
    expect(chart.kind).toBe('Chart');
    expect(chart.spec.datasetKey).toBe('ads_daily');
    expect(chart.spec.query.metrics).toEqual(['ad_cost']);
    expect(chart.spec.query.timeRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('converts filter inputs to the QuerySpec value shapes', () => {
    expect(parseFilterValue('in', 'A, B ,')).toEqual(['A', 'B']);
    expect(parseFilterValue('between', '2026-07-01', '2026-07-31')).toEqual(['2026-07-01', '2026-07-31']);
    expect(parseFilterValue('isNull', '', '', true)).toBe(true);
  });

  it('does not run a query with an incomplete filter', () => {
    expect(filterIsComplete({field: 'brand_name', op: 'eq', value: ''})).toBe(false);
    expect(filterIsComplete({field: 'brand_name', op: 'in', value: ['A']})).toBe(true);
    expect(filterIsComplete({field: 'ymd', op: 'between', value: ['2026-07-01', '']})).toBe(false);
    expect(filterIsComplete({field: 'brand_name', op: 'isNull', value: false})).toBe(true);
  });
});
