import {describe, expect, it} from 'vitest';
import {duplicatePlacement, legacyPlacementID, normalizeDashboardDocument, pinPlacementRevision} from './dashboardPlacements';

describe('dashboard placements', () => {
  it('normalizes legacy placements with a deterministic ID', () => {
    const legacy = {chartId: 'chart-1', chartRevision: 2, x: 0, y: 1, w: 4, h: 3};
    expect(legacyPlacementID(legacy, 0)).toBe('legacy-chart-1-2-0-1-0');
    const document = normalizeDashboardDocument({apiVersion: 'flooks.io/v1alpha1', kind: 'Dashboard', metadata: {name: 'dashboard', title: '대시보드'}, spec: {columns: 12, filters: [], placements: [legacy] as never}});
    expect(document.spec.placements[0].id).toBe('legacy-chart-1-2-0-1-0');
  });

  it('duplicates and pins one placement without changing the others', () => {
    const placement = {id: 'panel-a', chartId: 'chart-1', chartRevision: 1, x: 2, y: 3, w: 4, h: 3};
    expect(duplicatePlacement(placement)).toMatchObject({chartId: 'chart-1', chartRevision: 1, x: 0, y: Infinity});
    expect(pinPlacementRevision([placement, {...placement, id: 'panel-b'}], 'panel-b', 2)).toEqual([{...placement}, {...placement, id: 'panel-b', chartRevision: 2}]);
  });
});
