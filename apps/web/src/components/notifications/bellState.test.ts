import { afterEach, describe, expect, it } from 'vitest';
import { bellStore } from './bellState';

/** Bouton de cloche tel que le rend l'app (bouton d'attente ou cloche chargée). */
function bell() {
  const b = document.createElement('button');
  b.className = 'nb-bell';
  b.appendChild(document.createElement('svg'));
  document.body.appendChild(b);
  return b;
}
const press = (el: Element) => el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
const release = (el: Element) => el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));

describe('cloche : clic pendant le chargement', () => {
  afterEach(() => {
    bellStore.set(false);
    document.body.replaceChildren();
  });

  it('le store prévient ses abonnés, une fois par changement', () => {
    let calls = 0;
    const stop = bellStore.subscribe(() => calls++);
    bellStore.set(true);
    bellStore.set(true);
    expect([bellStore.get(), calls]).toEqual([true, 1]);
    stop();
    bellStore.set(false);
    expect(calls).toBe(1);
  });

  it('bouton remplacé entre l’appui et le relâchement : le panneau s’ouvre quand même', () => {
    const waiting = bell();
    press(waiting.firstElementChild!);
    // Le code de la cloche arrive : le bouton d'attente est remplacé, le navigateur n'émettra pas de clic
    waiting.remove();
    const loaded = bell();
    release(loaded);
    expect(bellStore.get()).toBe(true);
  });

  it('même bouton à l’appui et au relâchement : rien de plus que le clic du navigateur', () => {
    const b = bell();
    press(b);
    release(b);
    expect(bellStore.get()).toBe(false);
  });

  it('relâchement ailleurs, ou appui ailleurs : aucun effet', () => {
    const b = bell();
    const other = document.createElement('button');
    document.body.appendChild(other);
    press(b);
    release(other);
    press(other);
    release(b);
    expect(bellStore.get()).toBe(false);
  });
});
