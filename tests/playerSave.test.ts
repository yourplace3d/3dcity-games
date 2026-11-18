import { describe, expect, it } from 'vitest';
import { readPlayerSave } from '../src/playerSave';
import { placeFromHash } from '../src/places';

describe('player storage', () => {
  it('keeps valid balances and the last place', () => {
    const saved = { cash: 1240, delivered: 12, at: { lat: 52.5, lon: 13.4 } };
    expect(readPlayerSave(JSON.stringify(saved))).toEqual(saved);
  });
  it('does not let malformed counters corrupt delivery rewards', () => {
    for (const delivered of ['12', -2, null, {}, 'oops']) {
      expect(readPlayerSave(JSON.stringify({ cash: 120, delivered }))).toEqual({ cash: 120, delivered: 0 });
    }
    expect(readPlayerSave('{"delivered":1e999}').delivered).toBe(0);
    expect(readPlayerSave('{"delivered":2.5}').delivered).toBe(2);
  });
  it('ignores malformed JSON, balances and coordinates', () => {
    for (const value of [null, 'null', '[1]', '{', '{"cash":"oops"}', '{"at":{"lat":90,"lon":0}}', '{"at":{"lat":"52","lon":13}}']) {
      expect(readPlayerSave(value)).toEqual({ cash: 0, delivered: 0 });
    }
  });
});

describe('place links', () => {
  it('decodes city names, coordinates and malformed percent escapes without throwing', () => {
    expect(placeFromHash('#S%C3%A3o_Paulo')).toBe('São Paulo');
    expect(placeFromHash('#52.5%2C13.4')).toBe('52.5,13.4');
    expect(placeFromHash('#Bad%_link')).toBe('Bad% link');
  });
});
