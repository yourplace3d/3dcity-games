import { describe, expect, it } from 'vitest';
import { pickPlace, type PhotonFeature } from '../src/places';

// answers of the place search (Photon, in English) as they came on 28 November, best first
const f = (name: string, tag: string, lon: number, lat: number): PhotonFeature => {
  const [osm_key, osm_value] = tag.split('=');
  return { geometry: { coordinates: [lon, lat] }, properties: { name, osm_key, osm_value } };
};
const at = (p: PhotonFeature | null) => p?.geometry.coordinates;

describe('which answer of the place search is played', () => {
  it('takes a city or town that comes first', () => {
    expect(at(pickPlace([f('Perth', 'place=city', 115.8606, -31.9559), f('Perth', 'place=city', -3.4303, 56.3959)]))).toEqual([115.8606, -31.9559]);
  });

  it('takes the town itself, not the middle of the boundary drawn round it', () => {
    const hallstatt = [f('Hallstatt', 'boundary=administrative', 13.5989, 47.5348), f('Hallstatt Drive', 'highway=residential', -97.6233, 30.3865), f('Hallstatt', 'place=village', 13.6487, 47.5622)];
    expect(at(pickPlace(hallstatt))).toEqual([13.6487, 47.5622]);
    const doha = [f('Doha', 'place=state', 51.5082, 25.3109), f('Doha', 'place=city', 51.5264, 25.2856), f('Doha', 'boundary=administrative', 47.7933, 29.3239)];
    expect(at(pickPlace(doha))).toEqual([51.5264, 25.2856]);
  });

  it('lets a village or block of the same name give way to the city', () => {
    const neapel = [f('Neapel', 'place=city_block', 18.05, 59.33), f('Naples', 'place=city', 14.2488, 40.8359), f('Naples', 'railway=station', 14.27, 40.85)];
    expect(at(pickPlace(neapel))).toEqual([14.2488, 40.8359]);
  });

  it('leaves a sight, a square or a street as it is', () => {
    expect(at(pickPlace([f('Eiffel Tower', 'man_made=tower', 2.2945, 48.8583), f('Eiffel', 'place=city', 1, 1)]))).toEqual([2.2945, 48.8583]);
    expect(at(pickPlace([f('Alexanderplatz', 'place=square', 13.4136, 52.522), f('Alexandria', 'place=city', 29.9, 31.2)]))).toEqual([13.4136, 52.522]);
    expect(pickPlace([])).toBeNull();
  });
});
