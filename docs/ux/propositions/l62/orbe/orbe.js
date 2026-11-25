/**
 * L62 — Orbe qui parle (proposition UX, implémentation de référence, sans dépendance).
 * Canvas 2D léger : une sphère aux couleurs du thème, des volutes qui tournent à l'intérieur,
 * un halo qui suit le volume réel de la voix (AnalyserNode). Pas de WebGL.
 *
 * drawOrb(ctx, { size, t, level, a, b, state, reduced })
 *  - size  : taille CSS en px (56 à 72) ; le canvas est dessiné à devicePixelRatio
 *  - t     : temps en secondes (figé en pause)
 *  - level : volume lissé 0..1 (0 au repos)
 *  - a, b  : couleur principale et secondaire du thème ("#rrggbb")
 *  - state : 'speaking' | 'idle' | 'paused'
 *  - reduced : prefers-reduced-motion → anneau pulsé, sans volutes
 */
(function (g) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (c1, c2, k) => c1.map((v, i) => Math.round(v + (c2[i] - v) * k));
  const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
  const GREY = [150, 156, 166];

  function drawOrb(ctx, o) {
    const { size, t, state, reduced } = o;
    const level = state === 'paused' ? 0 : Math.max(0, Math.min(1, o.level || 0));
    let A = hex(o.a), B = hex(o.b);
    if (state === 'paused') { A = mix(A, GREY, 0.85); B = mix(B, GREY, 0.85); }
    const c = size / 2;
    const breathe = state === 'idle' && !reduced ? Math.sin(t * 1.6) * 0.025 : 0;
    const R = size * 0.33 * (1 + breathe + level * 0.06);
    ctx.clearRect(0, 0, size, size);

    // Halo : suit le volume (anneau seul en mouvement réduit)
    if (reduced) {
      const pr = R + 3 + level * size * 0.1;
      ctx.beginPath(); ctx.arc(c, c, pr, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(A, state === 'paused' ? 0.25 : 0.25 + level * 0.5); ctx.lineWidth = 2; ctx.stroke();
    } else {
      const gr = ctx.createRadialGradient(c, c, R * 0.8, c, c, R * (1.2 + level * 0.25));
      gr.addColorStop(0, rgba(A, state === 'paused' ? 0.12 : 0.22 + level * 0.35));
      gr.addColorStop(1, rgba(A, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c, c, R * 1.45, 0, Math.PI * 2); ctx.fill();
    }

    // Sphère : dégradé de base
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
    const base = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
    base.addColorStop(0, rgba(mix(A, [255, 255, 255], 0.35), 1));
    base.addColorStop(1, rgba(mix(B, [0, 0, 0], 0.15), 1));
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);

    // Volutes : trois nappes qui tournent, plus vite et plus grandes quand la voix porte
    if (!reduced) {
      ctx.globalCompositeOperation = 'screen';
      const sp = state === 'paused' ? 0 : 0.6 + level * 1.6;
      for (let i = 0; i < 3; i++) {
        const ang = t * sp * (i % 2 ? -1 : 1) + i * 2.1;
        const x = c + Math.cos(ang) * R * 0.42, y = c + Math.sin(ang * 1.3) * R * 0.38;
        const rr = R * (0.55 + level * 0.3 + 0.08 * Math.sin(t * 2 + i));
        const col = i === 1 ? mix(B, [255, 255, 255], 0.3) : mix(A, [255, 255, 255], 0.45);
        const v = ctx.createRadialGradient(x, y, 0, x, y, rr);
        v.addColorStop(0, rgba(col, 0.75)); v.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = v; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
      }
      // Filet de volute : un arc clair qui s'enroule
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + level * 0.3) + ')'; ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.beginPath(); ctx.arc(c, c, R * 0.62, t * sp * 0.8, t * sp * 0.8 + Math.PI * (0.7 + level * 0.6)); ctx.stroke();
    }
    // Reflet de verre
    const hl = ctx.createRadialGradient(c - R * 0.35, c - R * 0.45, 0, c - R * 0.35, c - R * 0.45, R * 0.7);
    hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(0, 0, size, size);
    ctx.restore();
    // Liseré
    ctx.beginPath(); ctx.arc(c, c, R - 0.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  }

  /** Volume lissé depuis un AnalyserNode (RMS, attaque rapide, relâche lente). */
  function levelFrom(analyser, buf, prev) {
    analyser.getByteTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
    const rms = Math.min(1, Math.sqrt(s / buf.length) * 4);
    return rms > prev ? prev + (rms - prev) * 0.5 : prev + (rms - prev) * 0.12;
  }
  g.TutoOrb = { drawOrb, levelFrom };
})(typeof window !== 'undefined' ? window : globalThis);
