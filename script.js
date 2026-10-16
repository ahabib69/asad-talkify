(function () {
  'use strict';

  // =========================================================
  // ELEMENTS
  // =========================================================
  const $ = id => document.getElementById(id);

  const audioInput = $('audioInput');
  const imageInput = $('imageInput');
  const audioLabel = $('audioLabel');
  const imageLabel = $('imageLabel');
  const previewCanvas = $('canvas');
  const audioEl = $('audioEl');
  const previewBtn = $('previewBtn');
  const recordBtn = $('recordBtn');
  const progressBar = $('progressBar');
  const status = $('status');
  const styleSelect = $('styleSelect');
  const titleInput = $('titleInput');
  const downloadArea = $('downloadArea');

  // =========================================================
  // STATE
  // =========================================================
  let img = null;
  let imgVer = 0;
  let audioFile = null;
  let audioReady = false;

  let audioCtx = null;
  let analyser = null;
  let freqLive = null;
  let timeLive = null;
  let rafId = null;
  let bassSmooth = 0;
  let exporting = false;

  const MEDIABUNNY_CDN = 'https://cdn.jsdelivr.net/npm/mediabunny@1.59.0/+esm';
  const canExport = !!(window.VideoEncoder && window.AudioEncoder);

  const RICKSHAW = ['#ec4899', '#fbbf24', '#22c55e', '#f97316', '#3b82f6', '#ef4444', '#a855f7', '#06b6d4'];
  const NEON = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f472b6'];
  const TAU = Math.PI * 2;

  let mediabunnyPromise = null;
  function loadMediabunny() {
    if (!mediabunnyPromise) mediabunnyPromise = import(MEDIABUNNY_CDN);
    return mediabunnyPromise;
  }

  // =========================================================
  // DRAW SURFACE (preview canvas or offscreen export canvas)
  // =========================================================
  let canvas, ctx, W, H, S, cache;

  function useSurface(c, opts) {
    canvas = c;
    ctx = c.getContext('2d', opts || undefined);
    W = c.width;
    H = c.height;
    S = H / 720; // scale for fixed-pixel sizes so 720p and 1080p look the same
    cache = { grads: {}, bg: null, bgVer: -1, title: null };
  }
  useSurface(previewCanvas);

  const scratch = {};

  function grad(key, x0, y0, x1, y1, stops) {
    let g = cache.grads[key];
    if (!g) {
      g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      cache.grads[key] = g;
    }
    return g;
  }

  function vals(freq, count) {
    const a = scratch['v' + count] || (scratch['v' + count] = new Float32Array(count));
    const n = freq.length;
    for (let i = 0; i < count; i++) a[i] = freq[(i / count * n) | 0] / 255;
    return a;
  }

  function rr(x, y, w, h, r) {
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  // =========================================================
  // STATUS / READY
  // =========================================================
  function setStatus(t) { status.textContent = t; }

  function checkReady() {
    const ready = !!img && audioReady;
    previewBtn.disabled = !ready;
    recordBtn.disabled = !ready || !canExport;
    if (ready && canExport) setStatus('Ready. Choose a style, preview it, then create the video.');
  }

  if (!canExport) setStatus('Video export needs Chrome or Edge (WebCodecs not available here).');

  const ZERO_F = new Uint8Array(128);
  const ZERO_T = new Uint8Array(128).fill(128);

  function paintIdle() {
    if (exporting || !img) return;
    if (canvas !== previewCanvas) useSurface(previewCanvas);
    paintCanvas(ZERO_F, ZERO_T, 0, styleSelect.value, titleInput.value.trim());
  }

  // =========================================================
  // IMAGE UPLOAD
  // =========================================================
  imageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = function () {
      img = im;
      imgVer++;
      imageLabel.classList.add('filled');
      const t = imageLabel.querySelector('.upload-text');
      if (t) t.textContent = '🖼️ ' + file.name;
      checkReady();
      paintIdle();
      URL.revokeObjectURL(url);
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('Could not load this image. Please choose another image.');
    };
    im.src = url;
  });

  // =========================================================
  // AUDIO UPLOAD
  // =========================================================
  audioInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    audioFile = file;
    audioReady = false;
    audioEl.src = URL.createObjectURL(file);
    audioEl.load();
    audioEl.oncanplaythrough = function () {
      audioReady = true;
      audioLabel.classList.add('filled');
      const t = audioLabel.querySelector('.upload-text');
      if (t) t.textContent = '🎵 ' + file.name;
      checkReady();
    };
    audioEl.onerror = function () {
      audioReady = false;
      setStatus('Could not load this audio file. Please choose another file.');
      checkReady();
    };
  });

  // =========================================================
  // BACKGROUND (baked once, then just scaled per frame)
  // =========================================================
  function buildBg() {
    const l = document.createElement('canvas');
    l.width = W;
    l.height = H;
    const c = l.getContext('2d');
    c.fillStyle = '#050505';
    c.fillRect(0, 0, W, H);

    if (img) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      const ir = img.width / img.height;
      const cr = W / H;
      let dw, dh;
      if (ir > cr) { dh = H; dw = dh * ir; } else { dw = W; dh = dw / ir; }
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

      c.fillStyle = 'rgba(0,0,0,0.38)';
      c.fillRect(0, 0, W, H);

      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.08)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    cache.bg = l;
    cache.bgVer = imgVer;
  }

  function drawBackground(bass) {
    if (cache.bgVer !== imgVer || !cache.bg) buildBg();
    const s = 1 + (bass || 0) * 0.06;
    if (s < 1.001) {
      ctx.drawImage(cache.bg, 0, 0);
    } else {
      ctx.drawImage(cache.bg, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s);
    }
  }

  // =========================================================
  // TITLE (baked once)
  // =========================================================
  function drawTitle(text) {
    if (!text) return;
    const key = text + '|' + W;
    if (!cache.title || cache.title.key !== key) {
      const fs = Math.round(34 * S);
      const font = 'bold ' + fs + 'px "Hind Siliguri","Noto Sans Bengali",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      const m = document.createElement('canvas').getContext('2d');
      m.font = font;
      const tw = m.measureText(text).width;
      const bw = Math.min(W - 20 * S, tw + 52 * S);
      const bh = 54 * S;
      const pad = 18 * S;
      const l = document.createElement('canvas');
      l.width = Math.ceil(bw + pad * 2);
      l.height = Math.ceil(bh + pad * 2);
      const c = l.getContext('2d');
      c.fillStyle = 'rgba(0,0,0,0.58)';
      c.beginPath();
      if (c.roundRect) c.roundRect(pad, pad, bw, bh, 27 * S); else c.rect(pad, pad, bw, bh);
      c.fill();
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowBlur = 12 * S;
      c.shadowColor = 'rgba(255,255,255,0.25)';
      c.fillStyle = '#fff';
      c.fillText(text, l.width / 2, pad + bh / 2, bw - 20 * S);
      cache.title = { key, layer: l, pad };
    }
    const t = cache.title;
    ctx.drawImage(t.layer, (W - t.layer.width) / 2, H - 88 * S - t.pad);
  }

  // =========================================================
  // SHARED HELPERS (batched strokes, glow without shadowBlur)
  // =========================================================
  function drawRays(v, count, baseR, maxLen, hue0, span, lw) {
    const cx = W / 2, cy = H / 2, B = 8, per = count / B;
    ctx.lineCap = 'round';
    for (let b = 0; b < B; b++) {
      const h = hue0 + (b + 0.5) / B * span;
      ctx.beginPath();
      const from = Math.floor(b * per), to = Math.floor((b + 1) * per);
      for (let i = from; i < to; i++) {
        const a = i / count * TAU;
        const c = Math.cos(a), s = Math.sin(a);
        const r2 = baseR + v[i] * maxLen;
        ctx.moveTo(cx + c * baseR, cy + s * baseR);
        ctx.lineTo(cx + c * r2, cy + s * r2);
      }
      ctx.strokeStyle = 'hsla(' + h + ',90%,65%,0.22)';
      ctx.lineWidth = lw * 3.2;
      ctx.stroke();
      ctx.strokeStyle = 'hsl(' + h + ',90%,68%)';
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  function paintDots(xs, ys, rs, count, hue0, span, B, alpha) {
    const per = count / B;
    for (let pass = 0; pass < 2; pass++) {
      for (let b = 0; b < B; b++) {
        const h = hue0 + (b + 0.5) / B * span;
        ctx.fillStyle = 'hsla(' + h + ',95%,' + (pass ? 66 : 62) + '%,' + (pass ? alpha : 0.22) + ')';
        ctx.beginPath();
        const from = Math.floor(b * per), to = Math.floor((b + 1) * per);
        for (let i = from; i < to; i++) {
          const r = pass ? rs[i] : rs[i] * 2.6;
          ctx.moveTo(xs[i] + r, ys[i]);
          ctx.arc(xs[i], ys[i], r, 0, TAU);
        }
        ctx.fill();
      }
    }
  }

  function barLayout(count, gap) {
    return (W - gap * (count - 1)) / count;
  }

  // =========================================================
  // VISUALIZERS
  // =========================================================
  function drawBars(freq, bass) {
    const count = 64, gap = 5 * S, bw = barLayout(count, gap), v = vals(freq, count);
    ctx.fillStyle = grad('bars', 0, H * 0.3, 0, H, [[0, '#22d3ee'], [0.5, '#818cf8'], [1, '#f472b6']]);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const bh = Math.max(4 * S, v[i] * H * 0.52 * (1 + bass * 0.35));
      ctx.rect(i * (bw + gap), H - bh - 24 * S, bw, bh);
    }
    ctx.fill();
  }

  function drawWave(tb, bass) {
    const n = tb.length, cy = H * 0.53, sl = W / (n - 1), amp = H * 0.28 * (1 + bass * 0.25);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = cy + (tb[i] - 128) / 128 * amp;
      if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * sl, y);
    }
    ctx.strokeStyle = 'rgba(34,211,238,0.25)';
    ctx.lineWidth = 16 * S;
    ctx.stroke();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 5 * S;
    ctx.stroke();
  }

  function drawCircle(freq, bass) {
    const m = Math.min(W, H), baseR = m * 0.17 * (1 + bass * 0.2), v = vals(freq, 128);
    drawRays(v, 128, baseR, m * 0.30, 190, 160, 4 * S);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, baseR, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 9 * S;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2 * S;
    ctx.stroke();
  }

  function drawMirror(freq, bass) {
    const count = 64, gap = 4 * S, bw = barLayout(count, gap), v = vals(freq, count), c = H * 0.57;
    ctx.fillStyle = grad('mirror', 0, c - H * 0.4, 0, c + H * 0.4,
      [[0, '#a78bfa'], [0.5, '#22d3ee'], [1, '#f472b6']]);
    const hs = scratch.mh || (scratch.mh = new Float32Array(count));
    for (let i = 0; i < count; i++) hs[i] = Math.max(3 * S, v[i] * H * 0.32 * (1 + bass * 0.25));
    ctx.beginPath();
    for (let i = 0; i < count; i++) ctx.rect(i * (bw + gap), c - hs[i], bw, hs[i]);
    ctx.fill();
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    for (let i = 0; i < count; i++) ctx.rect(i * (bw + gap), c, bw, hs[i]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawNeon(freq, bass) {
    const count = 72, gap = 3 * S, bw = barLayout(count, gap), v = vals(freq, count);
    const hs = scratch.nh || (scratch.nh = new Float32Array(count));
    for (let i = 0; i < count; i++) hs[i] = 8 * S + v[i] * H * 0.52 * (1 + bass * 0.4);
    for (let pass = 0; pass < 2; pass++) {
      const pad = pass ? 0 : 5 * S;
      ctx.globalAlpha = pass ? 1 : 0.22;
      for (let c = 0; c < NEON.length; c++) {
        ctx.fillStyle = NEON[c];
        ctx.beginPath();
        for (let i = c; i < count; i += NEON.length) {
          const w2 = bw + pad * 2;
          rr(i * (bw + gap) - pad, H - hs[i] - 20 * S - pad, w2, hs[i] + pad * 2, w2 / 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRadial(freq, bass) {
    const m = Math.min(W, H), v = vals(freq, 96);
    drawRays(v, 96, m * 0.12, m * 0.38 * (1 + bass * 0.25), 190, 288, 3 * S);
  }

  function drawDots(freq, bass) {
    const count = 100, v = vals(freq, count);
    const xs = scratch.dx || (scratch.dx = new Float32Array(count));
    const ys = scratch.dy || (scratch.dy = new Float32Array(count));
    const rs = scratch.dr || (scratch.dr = new Float32Array(count));
    for (let i = 0; i < count; i++) {
      xs[i] = i / count * W;
      ys[i] = H * 0.72 - v[i] * H * 0.48;
      rs[i] = (3 + v[i] * 10 + bass * 3) * S;
    }
    paintDots(xs, ys, rs, count, 190, 150, 10, 1);
  }

  function drawOrbit(freq, bass) {
    const m = Math.min(W, H), cx = W / 2, cy = H / 2, base = m * 0.16, count = 72, v = vals(freq, count);
    ctx.lineWidth = 2 * S;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, base + r * 55 * S + bass * 20 * S, 0, TAU);
      ctx.strokeStyle = 'rgba(103,232,249,' + (0.18 + r * 0.05) + ')';
      ctx.stroke();
    }
    const xs = scratch.ox || (scratch.ox = new Float32Array(count));
    const ys = scratch.oy || (scratch.oy = new Float32Array(count));
    const rs = scratch.or || (scratch.or = new Float32Array(count));
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, rad = base + v[i] * m * 0.30;
      xs[i] = cx + Math.cos(a) * rad;
      ys[i] = cy + Math.sin(a) * rad;
      rs[i] = (2 + v[i] * 8) * S;
    }
    paintDots(xs, ys, rs, count, 180, 180, 9, 1);
  }

  // deterministic particle positions (same every frame, same in export)
  const PCOUNT = 150;
  const PX = new Float32Array(PCOUNT), PY = new Float32Array(PCOUNT);
  (function () {
    for (let i = 0; i < PCOUNT; i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.6789;
      PX[i] = a - Math.floor(a);
      PY[i] = b - Math.floor(b);
    }
  })();

  function drawParticles(freq, bass) {
    const v = vals(freq, PCOUNT);
    const xs = scratch.px || (scratch.px = new Float32Array(PCOUNT));
    const ys = scratch.py || (scratch.py = new Float32Array(PCOUNT));
    const rs = scratch.pr || (scratch.pr = new Float32Array(PCOUNT));
    for (let i = 0; i < PCOUNT; i++) {
      xs[i] = PX[i] * W;
      ys[i] = PY[i] * H - v[i] * H * 0.20;
      rs[i] = (1.5 + v[i] * 5 + bass * 2) * S;
    }
    paintDots(xs, ys, rs, PCOUNT, 185, 150, 10, 0.85);
  }

  function drawAurora(freq, bass) {
    const step = 12 * S, cols = Math.ceil(W / step) + 1, v = vals(freq, cols);
    ctx.globalCompositeOperation = 'screen';
    for (let layer = 0; layer < 5; layer++) {
      const amp = H * (0.07 + bass * 0.08) * (1 + layer * 0.1);
      ctx.beginPath();
      for (let k = 0; k < cols; k++) {
        const x = Math.min(W, k * step);
        const y = H * 0.58 + Math.sin(x / S * 0.008 + layer * 0.9) * amp - v[k] * H * 0.18 - layer * 25 * S;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = grad('au' + layer, 0, 0, W, 0, [
        [0, 'hsla(' + (180 + layer * 25) + ',90%,60%,0.12)'],
        [0.5, 'hsla(' + (230 + layer * 20) + ',90%,65%,0.20)'],
        [1, 'hsla(' + (310 + layer * 10) + ',90%,65%,0.12)']
      ]);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFlame(freq, bass) {
    const count = 70, gap = 3 * S, bw = barLayout(count, gap), v = vals(freq, count);
    const hs = scratch.fh || (scratch.fh = new Float32Array(count));
    for (let i = 0; i < count; i++) hs[i] = 8 * S + v[i] * H * 0.60 * (1 + bass * 0.35);
    const p = 5 * S;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    for (let i = 0; i < count; i++) ctx.rect(i * (bw + gap) - p, H - hs[i] - 18 * S - p, bw + p * 2, hs[i] + p * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad('flame', 0, H * 0.3, 0, H, [
      [0, '#fff7ed'], [0.18, '#facc15'], [0.48, '#fb923c'], [0.75, '#ef4444'], [1, '#7f1d1d']
    ]);
    ctx.beginPath();
    for (let i = 0; i < count; i++) ctx.rect(i * (bw + gap), H - hs[i] - 18 * S, bw, hs[i]);
    ctx.fill();
  }

  function drawGlass(freq, bass) {
    const count = 56, gap = 7 * S, bw = barLayout(count, gap), v = vals(freq, count);
    ctx.fillStyle = grad('glass', 0, H * 0.3, 0, H, [
      [0, 'rgba(255,255,255,0.85)'], [0.45, 'rgba(125,211,252,0.52)'], [1, 'rgba(244,114,182,0.20)']
    ]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const bh = 12 * S + v[i] * H * 0.48 * (1 + bass * 0.25);
      rr(i * (bw + gap), H - bh - 25 * S, bw, bh, 8 * S);
    }
    ctx.fill();
    ctx.stroke();
  }

  function drawRickshaw(freq, bass) {
    const count = 64, gap = 4 * S, bw = barLayout(count, gap), v = vals(freq, count);
    const hs = scratch.rh || (scratch.rh = new Float32Array(count));
    for (let i = 0; i < count; i++) hs[i] = Math.max(2 * S, v[i] * H * 0.58 * (1 + bass * 0.3));
    const n = RICKSHAW.length;
    for (let pass = 0; pass < 2; pass++) {
      const pad = pass ? 0 : 4 * S;
      ctx.globalAlpha = pass ? 1 : 0.25;
      for (let c = 0; c < n; c++) {
        ctx.fillStyle = RICKSHAW[c];
        ctx.beginPath();
        for (let i = c; i < count; i += n) {
          ctx.rect(i * (bw + gap) - pad, H - hs[i] - 20 * S - pad, bw + pad * 2, hs[i] + pad * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // border of semicircles
    const r = 12 * S, step = r * 2, total = Math.ceil(W / step);
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = RICKSHAW[c];
      ctx.beginPath();
      for (let i = c; i < total; i += n) {
        const x = i * step;
        ctx.moveTo(x, H - r);
        ctx.arc(x + r, H - r, r, Math.PI, 0);
      }
      ctx.fill();
    }
  }

  const STYLES = {
    bars: drawBars, wave: drawWave, circle: drawCircle, mirror: drawMirror, neon: drawNeon,
    radial: drawRadial, dots: drawDots, orbit: drawOrbit, particles: drawParticles,
    aurora: drawAurora, flame: drawFlame, glass: drawGlass, rickshaw: drawRickshaw
  };

  // =========================================================
  // MAIN PAINTER
  // =========================================================
  function paintCanvas(freq, timeB, bass, style, title) {
    if (canvas.width !== W || canvas.height !== H) useSurface(canvas);
    drawBackground(bass);
    const fn = STYLES[style] || drawBars;
    fn(style === 'wave' ? timeB : freq, bass, timeB);
    drawTitle(title);
  }

  // =========================================================
  // LIVE PREVIEW
  // =========================================================
  function setupAudioGraph() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setStatus('Web Audio API is not supported in this browser.'); return; }
    audioCtx = new AC();
    const src = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    freqLive = new Uint8Array(analyser.frequencyBinCount);
    timeLive = new Uint8Array(analyser.fftSize);
  }

  function liveLoop() {
    if (!analyser || exporting) { rafId = null; return; }
    if (canvas !== previewCanvas) useSurface(previewCanvas);

    analyser.getByteFrequencyData(freqLive);
    analyser.getByteTimeDomainData(timeLive);

    let sum = 0;
    const nb = Math.min(12, freqLive.length);
    for (let i = 0; i < nb; i++) sum += freqLive[i];
    bassSmooth = bassSmooth * 0.6 + (sum / nb / 255) * 0.4;

    paintCanvas(freqLive, timeLive, bassSmooth, styleSelect.value, titleInput.value.trim());

    if (audioEl.duration) progressBar.style.width = (audioEl.currentTime / audioEl.duration * 100) + '%';

    if (!audioEl.paused && !audioEl.ended) rafId = requestAnimationFrame(liveLoop);
    else rafId = null;
  }

  previewBtn.addEventListener('click', async function () {
    setupAudioGraph();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (audioEl.paused) {
      if (audioEl.ended) audioEl.currentTime = 0;
      try { await audioEl.play(); }
      catch (err) { setStatus('Could not start audio preview.'); return; }
      previewBtn.textContent = '⏸ Pause';
      setStatus('Previewing ' + styleSelect.options[styleSelect.selectedIndex].text + '…');
      if (!rafId) liveLoop();
    } else {
      audioEl.pause();
      previewBtn.textContent = '▶ Preview';
      setStatus('Preview paused.');
    }
  });

  styleSelect.addEventListener('change', function () {
    if (audioEl.paused) paintIdle();
    else setStatus('Previewing ' + styleSelect.options[styleSelect.selectedIndex].text + '…');
  });

  titleInput.addEventListener('input', function () {
    if (audioEl.paused) paintIdle();
  });

  audioEl.addEventListener('ended', function () {
    setStatus('Preview finished.');
    progressBar.style.width = '0%';
    previewBtn.textContent = '▶ Preview';
  });

  // =========================================================
  // OFFLINE FFT (precomputed tables = fast)
  // =========================================================
  const FFT_N = 256;

  const HANN = new Float32Array(FFT_N);
  for (let i = 0; i < FFT_N; i++) HANN[i] = 0.5 * (1 - Math.cos(TAU * i / (FFT_N - 1)));

  const REV = new Uint16Array(FFT_N);
  (function () {
    const bits = Math.log2(FFT_N);
    for (let i = 0; i < FFT_N; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      REV[i] = r;
    }
  })();

  const TW_COS = new Float32Array(FFT_N / 2), TW_SIN = new Float32Array(FFT_N / 2);
  for (let k = 0; k < FFT_N / 2; k++) {
    TW_COS[k] = Math.cos(TAU * k / FFT_N);
    TW_SIN[k] = -Math.sin(TAU * k / FFT_N);
  }

  function fft(re, im) {
    for (let i = 0; i < FFT_N; i++) {
      const j = REV[i];
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= FFT_N; size <<= 1) {
      const half = size >> 1, step = FFT_N / size;
      for (let i = 0; i < FFT_N; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = TW_COS[k], wi = TW_SIN[k];
          const a = i + j, b = a + half;
          const vr = re[b] * wr - im[b] * wi;
          const vi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
        }
      }
    }
  }

  const F_RE = new Float32Array(FFT_N), F_IM = new Float32Array(FFT_N);
  const F_FREQ = new Uint8Array(128), F_TIME = new Uint8Array(128);
  const FRAME = { freq: F_FREQ, time: F_TIME, bass: 0 };

  function computeFrameData(mono, sampleRate, time, smoothed) {
    const center = Math.round(time * sampleRate), half = FFT_N / 2, len = mono.length;

    for (let i = 0; i < FFT_N; i++) {
      const idx = center - half + i;
      F_RE[i] = (idx >= 0 && idx < len ? mono[idx] : 0) * HANN[i];
      F_IM[i] = 0;
    }
    fft(F_RE, F_IM);

    for (let k = 0; k < 128; k++) {
      const mag = Math.sqrt(F_RE[k] * F_RE[k] + F_IM[k] * F_IM[k]) / FFT_N;
      const db = mag > 0 ? 20 * Math.log10(mag) : -100;
      let v = (db + 100) / 70 * 255;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      smoothed[k] = smoothed[k] * 0.55 + v * 0.45;
      F_FREQ[k] = smoothed[k];
    }

    for (let k = 0; k < 128; k++) {
      const idx = center - half + k * 2;
      const s = idx >= 0 && idx < len ? mono[idx] : 0;
      const b = Math.round((s * 0.5 + 0.5) * 255);
      F_TIME[k] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    let sum = 0;
    for (let i = 0; i < 8; i++) sum += F_FREQ[i];
    FRAME.bass = sum / 8 / 255;
    return FRAME;
  }

  // =========================================================
  // EXPORT HELPERS
  // =========================================================
  const mc = new MessageChannel();
  function yieldMain() {
    return new Promise(function (resolve) {
      mc.port1.onmessage = function () { resolve(); };
      mc.port2.postMessage(0);
    });
  }

  async function pickFormat(mb, w, h, vb) {
    // MP4 (H.264 + AAC) first: hardware accelerated = very fast.
    try {
      const mp4 = new mb.Mp4OutputFormat({ fastStart: 'in-memory' });
      const vc = await mb.getFirstEncodableVideoCodec(mp4.getSupportedVideoCodecs(), { width: w, height: h, bitrate: vb });
      const ac = await mb.getFirstEncodableAudioCodec(mp4.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 });
      if (vc && ac) return { format: mp4, ext: 'mp4', mime: 'video/mp4', vc: vc, ac: ac };
    } catch (e) { console.warn('MP4 not available, using WebM', e); }

    const webm = new mb.WebMOutputFormat();
    let vc = 'vp9';
    try {
      vc = (await mb.getFirstEncodableVideoCodec(webm.getSupportedVideoCodecs(), { width: w, height: h, bitrate: vb })) || 'vp9';
    } catch (e) { /* keep vp9 */ }
    return { format: webm, ext: 'webm', mime: 'video/webm', vc: vc, ac: 'opus' };
  }

  function finishUI() {
    exporting = false;
    recordBtn.disabled = !canExport || !img || !audioReady;
    previewBtn.disabled = !img || !audioReady;
    recordBtn.textContent = '⏺ Create Video';
  }

  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // =========================================================
  // CREATE VIDEO
  // =========================================================
  recordBtn.addEventListener('click', async function () {
    if (!canExport) { setStatus('Video export needs Chrome or Edge.'); return; }
    if (!audioFile || !img) { setStatus('Please choose both an audio file and an image.'); return; }

    downloadArea.innerHTML = '';
    recordBtn.disabled = true;
    previewBtn.disabled = true;
    recordBtn.textContent = '⏳ Working…';
    exporting = true;

    if (!audioEl.paused) { audioEl.pause(); previewBtn.textContent = '▶ Preview'; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    let writable = null;
    let output = null;

    try {
      // ---- engine + settings (before the save dialog, to keep the click permission fresh)
      setStatus('Loading video engine…');
      const mb = await loadMediabunny();

      const qSel = $('qualitySelect');
      const targetH = qSel ? (parseInt(qSel.value, 10) || 1080) : 1080;
      const ratio = previewCanvas.width / previewCanvas.height;
      const outH = Math.round(targetH / 2) * 2;
      const outW = Math.round(targetH * ratio / 2) * 2;
      const vBitrate = outH >= 1080 ? 8e6 : outH >= 720 ? 5e6 : 3e6;
      const fps = 30;

      const pf = await pickFormat(mb, outW, outH, vBitrate);

      // ---- save location
      let useFS = false;
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: 'songify-video.' + pf.ext,
            types: [{ description: pf.ext.toUpperCase() + ' Video', accept: { [pf.mime]: ['.' + pf.ext] } }]
          });
          writable = await handle.createWritable();
          useFS = true;
        } catch (err) {
          if (err && err.name === 'AbortError') {
            setStatus('Export cancelled.');
            finishUI();
            return;
          }
          console.warn('Save picker unavailable. Using browser download.', err);
        }
      }

      // ---- decode audio
      setStatus('Decoding audio…');
      const AC = window.AudioContext || window.webkitAudioContext;
      const dctx = new AC();
      const audioBuffer = await dctx.decodeAudioData((await audioFile.arrayBuffer()).slice(0));
      if (dctx.close) dctx.close();

      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const nCh = audioBuffer.numberOfChannels;
      const mono = new Float32Array(audioBuffer.length);
      for (let c = 0; c < nCh; c++) {
        const d = audioBuffer.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += d[i] / nCh;
      }

      // ---- output
      const target = useFS ? new mb.StreamTarget(writable, { chunked: true }) : new mb.BufferTarget();
      output = new mb.Output({ format: pf.format, target: target });

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      useSurface(exportCanvas, { alpha: false });

      const videoSource = new mb.CanvasSource(exportCanvas, { codec: pf.vc, bitrate: vBitrate });
      const audioSource = new mb.AudioBufferSource({ codec: pf.ac, bitrate: 192000 });
      output.addVideoTrack(videoSource, { frameRate: fps });
      output.addAudioTrack(audioSource);
      await output.start();

      setStatus('Encoding audio…');
      await audioSource.add(audioBuffer);
      audioSource.close();

      // ---- frames
      const totalFrames = Math.max(1, Math.ceil(duration * fps));
      const smoothed = new Float32Array(128);
      const title = titleInput.value.trim();
      const style = styleSelect.value;
      bassSmooth = 0;
      const t0 = performance.now();

      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame / fps;
        const f = computeFrameData(mono, sampleRate, time, smoothed);
        bassSmooth = bassSmooth * 0.6 + f.bass * 0.4;
        paintCanvas(f.freq, f.time, bassSmooth, style, title);

        await videoSource.add(time, 1 / fps);

        if (frame % 8 === 0 || frame === totalFrames - 1) {
          const pct = Math.round((frame + 1) / totalFrames * 100);
          const elapsed = (performance.now() - t0) / 1000;
          const speed = (time + 1 / fps) / Math.max(0.001, elapsed);
          const eta = (duration - (time + 1 / fps)) / Math.max(0.01, speed);
          progressBar.style.width = pct + '%';
          setStatus('Rendering ' + pct + '%  ·  ' + speed.toFixed(1) + '× speed  ·  ' + fmtTime(eta) + ' left');
          await yieldMain();
        }
      }

      videoSource.close();
      setStatus('Finishing up…');
      await output.finalize();

      // ---- deliver
      if (useFS) {
        setStatus('Saved! ✅');
      } else {
        const blob = new Blob([output.target.buffer], { type: pf.mime });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'songify-video.' + pf.ext;
        document.body.appendChild(a);
        a.click();
        a.remove();

        const link = document.createElement('a');
        link.href = url;
        link.download = 'songify-video.' + pf.ext;
        link.className = 'dl-btn';
        link.textContent = '⬇ Download Video (' + (blob.size / 1048576).toFixed(1) + ' MB)';
        downloadArea.appendChild(link);

        setStatus('Video ready! If it did not auto-download, use the button below.');
      }
      progressBar.style.width = '0%';

    } catch (error) {
      console.error('Export failed:', error);
      setStatus('Export failed: ' + (error && error.message ? error.message : error) + '. Try Chrome or Edge.');
      progressBar.style.width = '0%';
      try { if (output && output.cancel) await output.cancel(); } catch (e) { /* ignore */ }
      try { if (writable && writable.abort) await writable.abort(); } catch (e) { /* ignore */ }
    } finally {
      useSurface(previewCanvas);
      finishUI();
      paintIdle();
    }
  });

})();