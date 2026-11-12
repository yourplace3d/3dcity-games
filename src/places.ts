/**
 * Finding a place by name. Big cities are known by heart, so they work with no search server at
 * all; anything else asks Photon, and Nominatim if Photon doesn't answer. Both are free public
 * services that can be slow or busy, so neither gets to keep the player waiting for long.
 */

import type { LngLat } from './geo/projection';

/** Centres of well-known cities: lat, lon, then the names they go by. */
const CITIES: Array<[number, number, ...string[]]> = [
  [52.52, 13.405, 'Berlin'], [53.5511, 9.9937, 'Hamburg'], [48.1374, 11.5755, 'Munich', 'München', 'Muenchen'], [50.9375, 6.9603, 'Cologne', 'Köln', 'Koeln'],
  [50.1109, 8.6821, 'Frankfurt', 'Frankfurt am Main'], [48.7758, 9.1829, 'Stuttgart'], [49.4521, 11.0767, 'Nuremberg', 'Nürnberg', 'Nuernberg'], [47.999, 7.8421, 'Freiburg', 'Freiburg im Breisgau'],
  [48.2082, 16.3738, 'Vienna', 'Wien'], [47.3769, 8.5417, 'Zurich', 'Zürich'], [48.8566, 2.3522, 'Paris'], [51.5074, -0.1278, 'London'], [52.3676, 4.9041, 'Amsterdam'],
  [50.8503, 4.3517, 'Brussels', 'Bruxelles', 'Brussel'], [40.4168, -3.7038, 'Madrid'], [41.3874, 2.1686, 'Barcelona'], [38.7223, -9.1393, 'Lisbon', 'Lisboa'], [41.9028, 12.4964, 'Rome', 'Roma'],
  [45.4642, 9.19, 'Milan', 'Milano'], [50.0755, 14.4378, 'Prague', 'Praha', 'Prag'], [52.2297, 21.0122, 'Warsaw', 'Warszawa', 'Warschau'], [55.6761, 12.5683, 'Copenhagen', 'København', 'Kopenhagen'],
  [59.3293, 18.0686, 'Stockholm'], [59.9139, 10.7522, 'Oslo'], [60.1699, 24.9384, 'Helsinki'], [53.3498, -6.2603, 'Dublin'], [41.0082, 28.9784, 'Istanbul'], [37.9838, 23.7275, 'Athens', 'Athen'],
  [40.758, -73.9855, 'New York', 'New York City', 'NYC', 'Manhattan'], [34.0522, -118.2437, 'Los Angeles', 'LA'], [41.8781, -87.6298, 'Chicago'], [37.7749, -122.4194, 'San Francisco', 'SF'],
  [47.6062, -122.3321, 'Seattle'], [42.3601, -71.0589, 'Boston'], [38.9072, -77.0369, 'Washington', 'Washington DC'], [25.7617, -80.1918, 'Miami'],
  [43.6532, -79.3832, 'Toronto'], [45.4215, -75.6972, 'Ottawa'], [45.5017, -73.5673, 'Montreal', 'Montréal'], [49.2827, -123.1207, 'Vancouver'],
  [19.4326, -99.1332, 'Mexico City', 'Ciudad de México', 'CDMX'], [-22.9068, -43.1729, 'Rio de Janeiro', 'Rio'], [-23.5505, -46.6333, 'São Paulo', 'Sao Paulo'], [-34.6037, -58.3816, 'Buenos Aires'],
  [35.6812, 139.7671, 'Tokyo'], [34.6937, 135.5023, 'Osaka'], [37.5665, 126.978, 'Seoul'], [39.9042, 116.4074, 'Beijing', 'Peking'], [31.2304, 121.4737, 'Shanghai'],
  [22.2819, 114.1582, 'Hong Kong', 'Hongkong'], [1.2903, 103.8519, 'Singapore', 'Singapur'], [13.7563, 100.5018, 'Bangkok'], [18.9388, 72.8354, 'Mumbai', 'Bombay'], [28.6315, 77.2167, 'Delhi', 'New Delhi'],
  [25.2048, 55.2708, 'Dubai'], [30.0444, 31.2357, 'Cairo', 'Kairo'], [-33.9249, 18.4241, 'Cape Town', 'Kapstadt'], [-1.2864, 36.8172, 'Nairobi'], [-33.8688, 151.2093, 'Sydney'], [-37.8136, 144.9631, 'Melbourne'],
];

/** Lower case, no accents, letters and digits only: "São Paulo" and "sao-paulo" are the same place. */
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const KNOWN = new Map<string, { at: LngLat; name: string }>();
for (const [lat, lon, ...names] of CITIES) for (const n of names) KNOWN.set(plain(n), { at: { lat, lon }, name: names[0] });

export interface Found {
  at: LngLat;
  name?: string;
}

/** A city we know without asking anyone. */
export function knownCity(q: string): Found | null {
  return KNOWN.get(plain(q)) ?? null;
}

async function ask<T>(url: string, ms: number): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * A place by name: 'none' when the search servers answered and know no such place, 'silent' when
 * none of them answered at all.
 */
export async function findPlace(q: string): Promise<Found | 'none' | 'silent'> {
  const known = knownCity(q);
  if (known) return known;
  let answered = false;
  try {
    const json = await ask<{ features?: Array<{ geometry: { coordinates: [number, number] }; properties: { name?: string } }> }>(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`, 6000);
    answered = true;
    const f = json.features?.[0];
    if (f) return { at: { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }, name: f.properties.name };
  } catch {
    /* slow, busy or down: ask the other one */
  }
  try {
    const list = await ask<Array<{ lat: string; lon: string; name?: string; display_name?: string }>>(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, 8000);
    answered = true;
    const f = list[0];
    if (f && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon))) return { at: { lat: Number(f.lat), lon: Number(f.lon) }, name: f.name || f.display_name?.split(',')[0] };
  } catch {
    /* fall through */
  }
  return answered ? 'none' : 'silent';
}
