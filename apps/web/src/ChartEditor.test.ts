import {describe, expect, it} from 'vitest';
import {newChart} from './ChartEditor';

describe('newChart', () => {
  it('creates the canonical versioned chart document', () => {
    const chart = newChart('플랫폼별 광고비', 'bar');
    expect(chart.apiVersion).toBe('flooks.io/v1alpha1');
    expect(chart.kind).toBe('Chart');
    expect(chart.spec.datasetKey).toBe('ads_daily');
    expect(chart.spec.query.metrics).toEqual(['ad_cost']);
    expect(chart.spec.query.timeRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
