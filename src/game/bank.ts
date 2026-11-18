/**
 * Savings, kept at the banks of the player's home plate: the town of their first home.
 *
 * Cash carried is what fines take a share of. Cash paid in at a bank is safe from them. Savings can
 * only be paid in at a bank of the home plate, by stopping there; they pay for homes bought in the
 * home plate (and later for whatever else comes). There is no interest: homes pay rent, and rent
 * comes in as cash, not into the savings.
 *
 * Kept in the browser under `3da-bank`, so saving online carries it along.
 */

import type { Homes } from './homes';

const STORE = '3da-bank';
/** how far from the first home the home plate reaches (km): a town, or a big city's middle */
export const PLATE_KM = 25;

export interface Plate {
  lat: number;
  lon: number;
  /** the place's name, as it was when the first home was bought */
  place: string;
}

/** The home plate: where the first home stands. None before a home is bought. */
export function homePlate(h: Homes): Plate | null {
  const first = h.homes.reduce<Homes['homes'][number] | null>((a, b) => (!a || b.at < a.at ? b : a), null);
  return first ? { lat: first.lat, lon: first.lon, place: first.place } : null;
}

/** Distance between two points of the earth (km). */
export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function inPlate(plate: Plate | null, lat: number, lon: number): boolean {
  return !!plate && kmBetween(plate.lat, plate.lon, lat, lon) <= PLATE_KM;
}

export function readSaved(raw: string | null): number {
  try {
    const v = (JSON.parse(raw ?? '') as { saved?: unknown }).saved;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  } catch {
    return 0;
  }
}

export function loadSaved(): number {
  try {
    return readSaved(localStorage.getItem(STORE));
  } catch {
    return 0;
  }
}

export function storeSaved(saved: number): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, saved: Math.round(saved) }));
  } catch {
    /* private window: saved for this visit only */
  }
}

/** How a price is paid: from the cash carried first, the rest from savings (in the home plate only). */
export function payFrom(price: number, cash: number, saved: number, atPlate: boolean): { cash: number; saved: number } | null {
  const fromCash = Math.min(cash, price);
  const fromSaved = price - fromCash;
  if (fromSaved > 0 && (!atPlate || fromSaved > saved)) return null;
  return { cash: fromCash, saved: fromSaved };
}
