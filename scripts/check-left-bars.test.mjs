import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLeftBars } from './check-left-bars.mjs';

const hits = (css) => findLeftBars(css).length;

test('barres à gauche refusées dès 2 px', () => {
  assert.equal(hits('.a { border-left: 3px solid red; }'), 1);
  assert.equal(hits('.a { border-left: 2px dotted red; }'), 1);
  assert.equal(hits('.a { border-inline-start: 4px solid var(--x); }'), 1);
  assert.equal(hits('.a { border-left-width: medium; }'), 1);
  assert.equal(hits('.a{color:red;border-left:4px solid var(--rule)}'), 1);
  assert.equal(hits("<div style={{ borderLeft: '3px solid red' }} />"), 1);
  assert.equal(hits('.a { box-shadow: inset 3px 0 0 var(--fd-color-primary); }'), 1);
  assert.equal(hits('.a { box-shadow: 0 1px 2px #000, inset 4px 0 #f00; }'), 1);
});

test('séparateurs, anneaux et ombres permis', () => {
  assert.equal(hits('.a { border-left: 1px solid var(--fd-color-border); }'), 0);
  assert.equal(hits('.a { border-left: 0; }'), 0);
  assert.equal(hits('.a { border-left-color: red; }'), 0);
  assert.equal(hits('.a { box-shadow: inset 0 0 0 2px var(--fd-color-primary); }'), 0);
  assert.equal(hits('.a { box-shadow: inset 0 -2px 0 currentColor; }'), 0);
  assert.equal(hits('.a { box-shadow: inset 14px 0 10px -12px rgb(8 8 8 / 0.28); }'), 0);
  assert.equal(hits('.a { box-shadow: inset -3px 0 0 red; }'), 0);
});
