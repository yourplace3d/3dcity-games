import type { LngLat } from './geo/projection';

export interface PlayerSave { cash: number; delivered: number; at?: LngLat }

/** Old or damaged storage must not turn the balance and job rewards into NaN. */
export function readPlayerSave(raw: string | null): PlayerSave {
  try {
    const value = JSON.parse(raw ?? '{}');
    const nonnegative = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
    const cash = nonnegative(value?.cash);
    const delivered = Math.floor(nonnegative(value?.delivered));
    const at = value?.at;
    return {
      cash, delivered,
      ...(at && typeof at.lat === 'number' && typeof at.lon === 'number' && Math.abs(at.lat) <= 85 && Math.abs(at.lon) <= 180
        ? { at: { lat: at.lat, lon: at.lon } } : {}),
    };
  } catch {
    return { cash: 0, delivered: 0 };
  }
}
