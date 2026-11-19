import { beforeEach, describe, expect, it } from 'vitest';
import { measureRefused, setMeasureRefused, visitorIdFor, VISITOR_MAX_AGE_MS } from './visitor';

class Mem implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

const g = globalThis as unknown as { localStorage: Storage; sessionStorage: Storage; navigator: unknown };

describe('L26 : identifiant de visiteur', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: new Mem(), configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: new Mem(), configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  });

  it('propre à l’espace et stable', () => {
    const a = visitorIdFor('ws-a', true, 1000);
    expect(visitorIdFor('ws-a', true, 2000)).toBe(a);
    expect(visitorIdFor('ws-b', true, 2000)).not.toBe(a);
  });

  it('renouvelé après 13 mois', () => {
    const a = visitorIdFor('ws-a', true, 0);
    expect(visitorIdFor('ws-a', true, VISITOR_MAX_AGE_MS - 1)).toBe(a);
    expect(visitorIdFor('ws-a', true, VISITOR_MAX_AGE_MS + 1)).not.toBe(a);
  });

  it('mesure désactivée : identifiant de session, rien de gardé', () => {
    const s = visitorIdFor('ws-a', false);
    expect(g.localStorage.length).toBe(0);
    expect(visitorIdFor('ws-a', false)).toBe(s);
  });

  it('refus : identifiants supprimés, drapeau gardé, puis acceptation', () => {
    visitorIdFor('ws-a');
    g.localStorage.setItem('fd.vid', 'ancien');
    setMeasureRefused(true);
    expect(measureRefused()).toBe(true);
    expect(g.localStorage.getItem('fd.vid.ws-a')).toBeNull();
    expect(g.localStorage.getItem('fd.vid')).toBeNull();
    visitorIdFor('ws-a');
    expect(g.localStorage.getItem('fd.vid.ws-a')).toBeNull();
    setMeasureRefused(false);
    expect(measureRefused()).toBe(false);
  });

  it('Global Privacy Control respecté', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { globalPrivacyControl: true },
      configurable: true,
    });
    expect(measureRefused()).toBe(true);
    visitorIdFor('ws-a');
    expect(g.localStorage.length).toBe(0);
  });
});
