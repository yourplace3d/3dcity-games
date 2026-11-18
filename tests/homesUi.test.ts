import { afterEach, expect, it, vi } from 'vitest';
import { HomesUi } from '../src/homesUi';
import type { Home, Lot } from '../src/game/homes';

afterEach(() => vi.unstubAllGlobals());

it('does not pay the player to upgrade a flat when the newly loaded square prices the building lower', () => {
  vi.stubGlobal('navigator', { webdriver: true });
  const home: Home = { id: '1', lat: 49, lon: 11, kind: 'flat', paid: 2700, rent: 648, street: '', place: '', at: 0 };
  const lot: Lot = { id: '1', x: 0, y: 0, poly: { outer: [[0, 0], [10, 0], [10, 10]], holes: [] }, kind: 'flats', floors: 3, units: 2, price: 700, whole: 1400, street: '' };
  const game = { cash: 100 };
  const ui: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
    host: { game, save: vi.fn(), toast: vi.fn() },
    homes: { v: 1, homes: [home], paidDay: '2026-11-17' },
    owned: new Map([[lot, home]]),
    world: { proj: { toLngLat: () => ({ lat: 49, lon: 11 }) } },
    payRent: vi.fn(() => 0),
    look: vi.fn(),
  });
  expect(ui.buy(lot, 'building')).toBe(true);
  expect(game.cash).toBe(100);
  expect(home.paid).toBe(2700);
  expect(home.kind).toBe('building');
});
