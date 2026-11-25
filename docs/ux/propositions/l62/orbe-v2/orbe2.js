/**
 * L62 — Orbe qui parle, v2 (proposition UX). Trois directions, aux couleurs de la charte TutoClick.
 * Canvas 2D seul (dégradés en couches, flou, mode « lighter ») : pas de WebGL, donc pas de repli à prévoir.
 * Mouvements lents et continus : chaque direction avance une PHASE (temps déformé) dont la vitesse suit
 * le volume LISSÉ ; rien ne saute, même quand la voix démarre ou s'arrête.
 *
 * TutoOrb2.create(canvas, { variant: 'aurora'|'ruban'|'particules', palette: 'charte'|'theme', theme?: {a,b}, dark })
 *   .frame(dt, rawLevel)   dt en secondes, rawLevel 0..1 (AnalyserNode)
 *   .setPaused(bool)       en pause : figé, désaturé
 *   .reduced = true        prefers-reduced-motion : anneau pulsé, sans mouvement interne
 */
(function (g) {
  const CH = { // charte TutoClick (tokens prune, framboise, orange)
    deep: '#480f2a', p800: '#67123b', p600: '#a3195b', p500: '#b23d75', p300: '#cf86a9', p200: '#e3a9c4',
    f500: '#dc326d', f400: '#e35889', f300: '#e97fa4', o400: '#f5a730', o300: '#f8bb61', light: '#fbf0f5',
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const TAU = Math.PI * 2;

  /** Lissage fort du volume : attaque 220 ms, relâche 650 ms (exponentiel, indépendant de la cadence). */
  function smoother() {
    let v = 0;
    return (raw, dt) => { const tau = raw > v ? 0.22 : 0.65; v += (raw - v) * (1 - Math.exp(-dt / tau)); return v; };
  }

  function create(cv, opts) {
    const ctx = cv.getContext('2d');
    const st = { t: 0, ph: 0, lv: 0, paused: false, reduced: false, ...opts };
    const smooth = smoother();
    const pts = []; // particules : sphère de Fibonacci
    for (let i = 0, n = 320; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; pts.push([Math.cos(th) * r, y, Math.sin(th) * r, (i * 0.618) % 1]); }

    function frame(dt, raw) {
      const S = cv.width; const c = S / 2;
      if (!st.paused) {
        st.lv = smooth(raw || 0, dt);
        st.t += dt;
        st.ph += dt * (0.55 + st.lv * 0.9); // phase : lente au repos, un peu plus vive en parlant
      }
      const L = st.paused ? 0 : st.lv;
      const breathe = st.paused || st.reduced ? 0 : 0.5 + 0.5 * Math.sin((st.t / 4.5) * TAU); // 4,5 s
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      if (st.paused) ctx.filter = 'grayscale(0.85) opacity(0.75)';
      const R = S * 0.3 * (1 + 0.025 * breathe + 0.07 * L);
      halo(c, R, L, breathe);
      if (st.reduced) reduced(c, R, L);
      else if (st.variant === 'ruban') ruban(c, R, L);
      else if (st.variant === 'particules') particules(c, R, L);
      else aurora(c, R, L);
      ctx.restore();
    }

    function halo(c, R, L, b) {
      const a = (st.dark ? 0.32 : 0.22) + 0.1 * b + 0.35 * L;
      const g1 = ctx.createRadialGradient(c, c, R * 0.6, c, c, R * (1.55 + 0.25 * L));
      g1.addColorStop(0, rgba(CH.f500, a)); g1.addColorStop(0.55, rgba(CH.p500, a * 0.45)); g1.addColorStop(1, rgba(CH.p500, 0));
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(c, c, R * 1.8, 0, TAU); ctx.fill();
    }

    function glass(c, R) {
      // verre : profondeur douce au bord, lueur de bord (rim light), reflet diffus en haut ; ni liseré dur ni tache blanche
      const sh = ctx.createRadialGradient(c, c, R * 0.6, c, c, R);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, st.dark ? 'rgba(20,4,12,0.35)' : 'rgba(72,15,42,0.2)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
      const rim = ctx.createRadialGradient(c, c, R * 0.86, c, c, R);
      rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,230,240,0.28)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
      const hl = ctx.createRadialGradient(c - R * 0.25, c - R * 0.55, 0, c - R * 0.25, c - R * 0.55, R * 0.6);
      hl.addColorStop(0, 'rgba(255,255,255,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
    }

    // A. Verre aurora : nappes de couleur floues qui se mélangent lentement dans une sphère de verre
    function aurora(c, R, L) {
      ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
      const base = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
      base.addColorStop(0, CH.p800); base.addColorStop(1, CH.deep);
      ctx.fillStyle = base; ctx.fillRect(c - R, c - R, R * 2, R * 2);
      ctx.filter = `blur(${Math.max(1.5, R * 0.2)}px)`; ctx.globalCompositeOperation = 'lighter';
      const blobs = [[CH.f500, 6.0, 0.0], [CH.o400, 8.5, 1.7], [CH.p300, 10.0, 3.4], [CH.p600, 7.2, 4.9], [CH.f300, 9.3, 2.6]];
      for (const [col, per, off] of blobs) {
        const a = (st.ph / per) * TAU + off;
        const x = c + Math.cos(a) * R * (0.55 + 0.1 * L), y = c + Math.sin(a * 0.8 + off) * R * (0.5 + 0.1 * L);
        const rr = R * (0.5 + 0.16 * L);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, rgba(col, 0.7 + 0.25 * L)); gr.addColorStop(0.6, rgba(col, 0.25)); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      }
      const core = ctx.createRadialGradient(c, c, 0, c, c, R * (0.35 + 0.2 * L));
      core.addColorStop(0, rgba(CH.light, 0.35 + 0.35 * L)); core.addColorStop(1, rgba(CH.f300, 0));
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
      glass(c, R); ctx.restore();
    }

    // B. Ruban de lumière : un anneau lumineux incliné tourne lentement dans le verre ; il ondule avec la voix
    function ruban(c, R, L) {
      ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
      const base = ctx.createRadialGradient(c - R * 0.3, c - R * 0.3, 0, c, c, R);
      base.addColorStop(0, st.dark ? CH.p800 : CH.p600); base.addColorStop(1, CH.deep);
      ctx.fillStyle = base; ctx.fillRect(c - R, c - R, R * 2, R * 2);
      const rot = (st.ph / 8) * TAU, tilt = 1.05 + 0.15 * Math.sin((st.ph / 9) * TAU);
      const path = (k, amp) => { ctx.beginPath(); for (let i = 0; i <= 120; i++) { const u = (i / 120) * TAU; const w = 1 + amp * Math.sin(u * 3 + st.ph * 2.2) ; let x = Math.cos(u) * 0.86 * w, y = Math.sin(u) * 0.86 * w, z = 0;
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt); const x2 = x * Math.cos(rot) - y2 * Math.sin(rot); const y3 = x * Math.sin(rot) + y2 * Math.cos(rot);
        const px = c + x2 * R * k, py = c + y3 * R * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } };
      const grad = ctx.createLinearGradient(c - R, c, c + R, c);
      grad.addColorStop(0, CH.f400); grad.addColorStop(0.5, CH.o300); grad.addColorStop(1, CH.p200);
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = grad; ctx.lineCap = 'round';
      ctx.filter = `blur(${Math.max(2, R * 0.12)}px)`; ctx.lineWidth = R * (0.14 + 0.1 * L); path(1, 0.08 * L); ctx.stroke();
      ctx.filter = 'none'; ctx.lineWidth = Math.max(1, R * (0.03 + 0.025 * L)); path(1, 0.08 * L); ctx.stroke();
      ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.8, R * 0.02); const t0 = tilt; path(0.7, 0.12 * L); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over'; glass(c, R); ctx.restore();
    }

    // C. Particules : une sphère de points lumineux qui tourne lentement ; la voix la fait onduler
    function particules(c, R, L) {
      const rot = (st.ph / 10) * TAU, tilt = 0.35;
      const g0 = ctx.createRadialGradient(c, c, 0, c, c, R);
      g0.addColorStop(0, rgba(CH.p600, st.dark ? 0.35 : 0.18)); g0.addColorStop(1, rgba(CH.p600, 0));
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = st.dark ? 'lighter' : 'source-over';
      for (const [x0, y0, z0, h] of pts) {
        const wave = 1 + L * 0.16 * Math.sin(y0 * 6 + st.ph * 3.2 + h * 2) ;
        let x = x0 * Math.cos(rot) - z0 * Math.sin(rot), z = x0 * Math.sin(rot) + z0 * Math.cos(rot), y = y0;
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        const d = (z2 + 1) / 2; // 0 derrière, 1 devant
        const px = c + x * R * wave, py = c + y2 * R * wave;
        const col = y0 < -0.35 ? CH.o300 : y0 < 0.3 ? CH.f400 : CH.p300;
        ctx.fillStyle = rgba(col, 0.15 + 0.85 * d);
        ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, R * (0.012 + 0.022 * d)), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Mouvement réduit : sphère au dégradé de la charte, anneau qui pulse avec le volume, rien ne tourne
    function reduced(c, R, L) {
      const base = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
      base.addColorStop(0, CH.f400); base.addColorStop(1, CH.p800);
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill(); glass(c, R);
      ctx.lineWidth = Math.max(1.5, R * 0.06); ctx.strokeStyle = rgba(CH.f500, 0.25 + 0.6 * L);
      ctx.beginPath(); ctx.arc(c, c, R * (1.12 + 0.12 * L), 0, TAU); ctx.stroke();
    }

    return { frame, setPaused: (p) => (st.paused = p), set reduced(v) { st.reduced = v; }, state: st };
  }
  g.TutoOrb2 = { create, smoother, CH };
})(typeof window !== 'undefined' ? window : globalThis);
