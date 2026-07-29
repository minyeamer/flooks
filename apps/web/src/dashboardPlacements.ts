import type {DashboardDocument, Placement} from './types';

type LegacyPlacement = Omit<Placement, 'id'> & {id?: string};

export function legacyPlacementID(placement: LegacyPlacement, index: number): string {
  return placement.id || `legacy-${placement.chartId}-${placement.chartRevision}-${placement.x}-${placement.y}-${index}`;
}

export function normalizeDashboardDocument(document: DashboardDocument): DashboardDocument {
  return {...document, spec: {...document.spec, placements: (document.spec.placements as LegacyPlacement[]).map((placement, index) => ({...placement, id: legacyPlacementID(placement, index)}))}};
}

export function newPlacementID(): string {
  return globalThis.crypto?.randomUUID?.() ?? `placement-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function duplicatePlacement(placement: Placement): Placement {
  return {...placement, id: newPlacementID(), x: 0, y: Infinity};
}

export function pinPlacementRevision(placements: Placement[], id: string, revision: number): Placement[] {
  return placements.map(placement => placement.id === id ? {...placement, chartRevision: revision} : placement);
}
