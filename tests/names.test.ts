import { describe, expect, it } from 'vitest';
import { namesFor, regionAt, REGION_LISTS } from '../src/game/names';
import { CITY_LIST } from '../src/places';

/** The cities the game knows by heart, each with the names it should get. */
const CITIES: Record<string, string> = {
  Berlin: 'german', Hamburg: 'german', Munich: 'german', Cologne: 'german', Frankfurt: 'german', Stuttgart: 'german',
  Nuremberg: 'german', Freiburg: 'german', Vienna: 'german', Zurich: 'german', Paris: 'french', London: 'british',
  Amsterdam: 'dutch', Brussels: 'belgian', Madrid: 'spanish', Barcelona: 'spanish', Lisbon: 'portuguese', Rome: 'italian',
  Milan: 'italian', Prague: 'czech-slovak', Warsaw: 'polish', Copenhagen: 'scandinavian', Stockholm: 'scandinavian',
  Oslo: 'scandinavian', Helsinki: 'finnish', Dublin: 'british', Istanbul: 'turkish', Athens: 'greek',
  'New York': 'north-american', 'Los Angeles': 'north-american', Chicago: 'north-american', 'San Francisco': 'north-american',
  Seattle: 'north-american', Boston: 'north-american', Washington: 'north-american', Miami: 'north-american',
  Toronto: 'north-american', Ottawa: 'north-american', Montreal: 'french', Vancouver: 'north-american',
  'Mexico City': 'latin-american', 'Rio de Janeiro': 'brazilian', 'São Paulo': 'brazilian', 'Buenos Aires': 'latin-american',
  Tokyo: 'japanese', Osaka: 'japanese', Seoul: 'korean', Beijing: 'chinese', Shanghai: 'chinese', 'Hong Kong': 'chinese',
  Singapore: 'singapore', Bangkok: 'thai', Mumbai: 'indian', Delhi: 'indian', Dubai: 'arabic', Cairo: 'arabic',
  'Cape Town': 'south-african', Nairobi: 'kenyan', Sydney: 'australian', Melbourne: 'australian',
};

/** Places near a border, where a rough box would name them wrongly. */
const BORDERS: Array<[string, number, number, string]> = [
  ['Dresden', 51.05, 13.74, 'german'],
  ['Passau', 48.57, 13.43, 'german'],
  ['Kiel', 54.32, 10.14, 'german'],
  ['Flensburg', 54.78, 9.43, 'german'],
  ['Aachen', 50.78, 6.08, 'german'],
  ['Basel', 47.56, 7.59, 'german'],
  ['Bern', 46.95, 7.45, 'german'],
  ['Bolzano', 46.5, 11.35, 'german'],
  ['Strasbourg', 48.57, 7.75, 'french'],
  ['Geneva', 46.2, 6.14, 'french'],
  ['Besançon', 47.24, 6.02, 'french'],
  ['Sion', 46.23, 7.36, 'french'],
  ['Nice', 43.7, 7.26, 'french'],
  ['Toulouse', 43.6, 1.44, 'french'],
  ['Ajaccio', 41.93, 8.74, 'french'],
  ['Lugano', 46.0, 8.95, 'italian'],
  ['Como', 45.81, 9.08, 'italian'],
  ['Bari', 41.12, 16.87, 'italian'],
  ['Palermo', 38.12, 13.36, 'italian'],
  ['Cagliari', 39.22, 9.12, 'italian'],
  ['Antwerp', 51.22, 4.4, 'belgian'],
  ['Eindhoven', 51.44, 5.47, 'dutch'],
  ['Groningen', 53.22, 6.57, 'dutch'],
  ['Las Palmas', 28.12, -15.43, 'spanish'],
  ['Palma', 39.57, 2.65, 'spanish'],
  ['Algiers', 36.75, 3.06, 'arabic'],
  ['Tunis', 36.8, 10.18, 'arabic'],
  ['Saint Petersburg', 59.94, 30.31, 'east-slavic'],
  ['Lviv', 49.84, 24.03, 'east-slavic'],
  ['Tallinn', 59.44, 24.75, 'shared'],
  ['Kraków', 50.06, 19.94, 'polish'],
  ['Opole', 50.67, 17.93, 'polish'],
  ['Bratislava', 48.15, 17.11, 'czech-slovak'],
  ['Brno', 49.2, 16.61, 'czech-slovak'],
  ['Izmir', 38.42, 27.14, 'turkish'],
  ['Thessaloniki', 40.64, 22.94, 'greek'],
  ['Yerevan', 40.18, 44.51, 'shared'],
  ['Baghdad', 33.31, 44.37, 'arabic'],
  ['Tehran', 35.69, 51.39, 'persian'],
  ['Doha', 25.29, 51.53, 'arabic'],
  ['Lahore', 31.55, 74.34, 'pakistani'],
  ['Amritsar', 31.63, 74.87, 'indian'],
  ['Kolkata', 22.57, 88.36, 'indian'],
  ['Dhaka', 23.81, 90.41, 'bangladeshi'],
  ['Hanoi', 21.03, 105.85, 'vietnamese'],
  ['Ho Chi Minh City', 10.78, 106.7, 'vietnamese'],
  ['Phnom Penh', 11.56, 104.92, 'shared'],
  ['Manila', 14.6, 120.98, 'filipino'],
  ['Jakarta', -6.2, 106.85, 'malay'],
  ['Fukuoka', 33.59, 130.4, 'japanese'],
  ['Busan', 35.18, 129.08, 'korean'],
  ['Vladivostok', 43.12, 131.89, 'east-slavic'],
  ['Tijuana', 32.53, -117.02, 'latin-american'],
  ['Monterrey', 25.67, -100.31, 'latin-american'],
  ['El Paso', 31.76, -106.49, 'north-american'],
  ['Houston', 29.76, -95.37, 'north-american'],
  ['Quebec City', 46.81, -71.21, 'french'],
  ['Asunción', -25.26, -57.58, 'latin-american'],
  ['Rosario', -32.95, -60.65, 'latin-american'],
  ['Montevideo', -34.9, -56.16, 'latin-american'],
  ['Porto Alegre', -30.03, -51.23, 'brazilian'],
  ['Auckland', -36.85, 174.76, 'australian'],
  ['Mid-Atlantic', 30, -40, 'shared'],
];

describe('names by region', () => {
  it('gives each city the game knows by heart the names of its region', () => {
    const wrong = CITY_LIST.filter((c) => regionAt(c.at.lat, c.at.lon).key !== CITIES[c.name]).map((c) => `${c.name}: ${regionAt(c.at.lat, c.at.lon).key}`);
    expect(wrong).toEqual([]);
    expect(CITY_LIST.every((c) => c.name in CITIES)).toBe(true);
  });

  it('names places near a border by the right side', () => {
    const wrong = BORDERS.filter(([, lat, lon, key]) => regionAt(lat, lon).key !== key).map(([n, lat, lon]) => `${n}: ${regionAt(lat, lon).key}`);
    expect(wrong).toEqual([]);
  });

  it('has ten women’s and ten men’s first names in every list, none twice', () => {
    for (const r of REGION_LISTS) {
      expect(r.women, r.key).toHaveLength(10);
      expect(r.men, r.key).toHaveLength(10);
      expect(new Set([...r.women, ...r.men]).size, r.key).toBe(20);
    }
  });

  it('draws the same people for the same home, each with a different name', () => {
    const a = namesFor(49.4521, 11.0767);
    expect(namesFor(49.4521, 11.0767)).toEqual(a);
    expect(a.region).toBe('german');
    const all = [a.pump, a.flame, a.shield, a.neighbour, ...a.friends];
    expect(new Set(all).size).toBe(all.length);
    // another home, other people (most likely)
    const b = namesFor(35.6812, 139.7671);
    expect(b.region).toBe('japanese');
    expect(b.pump).not.toBe(a.pump);
  });
});
