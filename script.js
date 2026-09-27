(function () {
  'use strict';

  // =========================================================
  // ELEMENTS
  // =========================================================

  const audioInput = document.getElementById('audioInput');
  const imageInput = document.getElementById('imageInput');

  const audioLabel = document.getElementById('audioLabel');
  const imageLabel = document.getElementById('imageLabel');

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const audioEl = document.getElementById('audioEl');

  const previewBtn = document.getElementById('previewBtn');
  const recordBtn = document.getElementById('recordBtn');

  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');

  const styleSelect = document.getElementById('styleSelect');
  const titleInput = document.getElementById('titleInput');

  const downloadArea = document.getElementById('downloadArea');


  // =========================================================
  // STATE
  // =========================================================

  let img = null;
  let audioFile = null;
  let audioReady = false;

  let audioCtx = null;
  let analyser = null;
  let srcNode = null;

  let freqLive = null;
  let timeLive = null;

  let rafId = null;


  // =========================================================
  // CONSTANTS
  // =========================================================

  const MEDIABUNNY_CDN =
    'https://cdn.jsdelivr.net/npm/mediabunny@1.59.0/+esm';

  const canExport =
    !!(window.VideoEncoder && window.AudioEncoder);


  const RICKSHAW = [
    '#ec4899',
    '#fbbf24',
    '#22c55e',
    '#f97316',
    '#3b82f6',
    '#ef4444',
    '#a855f7',
    '#06b6d4'
  ];


  const NEON_COLORS = [
    '#22d3ee',
    '#38bdf8',
    '#818cf8',
    '#a78bfa',
    '#e879f9',
    '#f472b6'
  ];


  let mediabunnyPromise = null;


  function loadMediabunny() {
    if (!mediabunnyPromise) {
      mediabunnyPromise = import(MEDIABUNNY_CDN);
    }

    return mediabunnyPromise;
  }


  // =========================================================
  // STATUS / READY
  // =========================================================

  function setStatus(text) {
    status.textContent = text;
  }


  function checkReady() {

    const ready =
      !!img &&
      audioReady;

    previewBtn.disabled = !ready;

    recordBtn.disabled =
      !ready ||
      !canExport;

    if (ready && canExport) {
      setStatus(
        'Ready. Choose a style, preview it, then create the video.'
      );
    }

  }


  if (!canExport) {

    setStatus(
      'Video export needs Chrome or Edge (WebCodecs not available here).'
    );

  }


  // =========================================================
  // IMAGE UPLOAD
  // =========================================================

  imageInput.addEventListener('change', function (e) {

    const file = e.target.files[0];

    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);

    const newImage = new Image();

    newImage.onload = function () {

      img = newImage;

      imageLabel.classList.add('filled');

      const uploadText =
        imageLabel.querySelector('.upload-text');

      if (uploadText) {
        uploadText.textContent =
          '🖼️ ' + file.name;
      }

      checkReady();

      paintCanvas(
        new Uint8Array(128),
        new Uint8Array(128),
        0,
        styleSelect.value,
        titleInput.value.trim()
      );

      URL.revokeObjectURL(url);

    };

    newImage.onerror = function () {

      URL.revokeObjectURL(url);

      setStatus(
        'Could not load this image. Please choose another image.'
      );

    };

    newImage.src = url;

  });


  // =========================================================
  // AUDIO UPLOAD
  // =========================================================

  audioInput.addEventListener('change', function (e) {

    const file = e.target.files[0];

    if (!file) {
      return;
    }

    audioFile = file;

    audioReady = false;

    const url = URL.createObjectURL(file);

    audioEl.src = url;

    audioEl.load();

    audioEl.oncanplaythrough = function () {

      audioReady = true;

      audioLabel.classList.add('filled');

      const uploadText =
        audioLabel.querySelector('.upload-text');

      if (uploadText) {
        uploadText.textContent =
          '🎵 ' + file.name;
      }

      checkReady();

    };

    audioEl.onerror = function () {

      audioReady = false;

      setStatus(
        'Could not load this audio file. Please choose another file.'
      );

      checkReady();

    };

  });


  // =========================================================
  // BACKGROUND
  // =========================================================

  function drawBackground(bass) {

    const w = canvas.width;
    const h = canvas.height;

    if (img) {

      const scale =
        1 + (bass || 0) * 0.06;

      const imageRatio =
        img.width / img.height;

      const canvasRatio =
        w / h;

      let dw;
      let dh;

      if (imageRatio > canvasRatio) {

        dh = h * scale;
        dw = dh * imageRatio;

      } else {

        dw = w * scale;
        dh = dw / imageRatio;

      }

      const dx =
        (w - dw) / 2;

      const dy =
        (h - dh) / 2;

      ctx.drawImage(
        img,
        dx,
        dy,
        dw,
        dh
      );

      // Dark cinematic overlay
      ctx.fillStyle =
        'rgba(0,0,0,0.38)';

      ctx.fillRect(
        0,
        0,
        w,
        h
      );

      // Soft bottom gradient
      const gradient =
        ctx.createLinearGradient(
          0,
          0,
          0,
          h
        );

      gradient.addColorStop(
        0,
        'rgba(0,0,0,0.08)'
      );

      gradient.addColorStop(
        0.55,
        'rgba(0,0,0,0.05)'
      );

      gradient.addColorStop(
        1,
        'rgba(0,0,0,0.55)'
      );

      ctx.fillStyle = gradient;

      ctx.fillRect(
        0,
        0,
        w,
        h
      );

    } else {

      ctx.fillStyle = '#050505';

      ctx.fillRect(
        0,
        0,
        w,
        h
      );

    }

  }


  // =========================================================
  // TITLE
  // =========================================================

  function drawTitle(text) {

    if (!text) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    ctx.font =
      'bold 34px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth =
      ctx.measureText(text).width;

    const boxWidth =
      textWidth + 52;

    const boxHeight =
      54;

    const boxX =
      w / 2 - boxWidth / 2;

    const boxY =
      h - 88;

    ctx.fillStyle =
      'rgba(0,0,0,0.58)';

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        27
      );

    } else {

      ctx.rect(
        boxX,
        boxY,
        boxWidth,
        boxHeight
      );

    }

    ctx.fill();

    ctx.shadowBlur = 12;

    ctx.shadowColor =
      'rgba(255,255,255,0.25)';

    ctx.fillStyle =
      '#ffffff';

    ctx.fillText(
      text,
      w / 2,
      boxY + boxHeight / 2
    );

    ctx.restore();

  }


  // =========================================================
  // RICKSHAW BORDER
  // =========================================================

  function drawRickshawBorder() {

    const w = canvas.width;
    const h = canvas.height;

    const r = 12;
    const step = r * 2;

    for (
      let x = 0, i = 0;
      x < w;
      x += step, i++
    ) {

      ctx.fillStyle =
        RICKSHAW[i % RICKSHAW.length];

      ctx.beginPath();

      ctx.arc(
        x + r,
        h - r,
        r,
        Math.PI,
        0
      );

      ctx.fill();

    }

  }


  // =========================================================
  // GLOW LINE HELPER
  // =========================================================

  function drawGlowLine(
    x1,
    y1,
    x2,
    y2,
    color,
    width,
    glow
  ) {

    ctx.save();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    ctx.shadowBlur = glow;
    ctx.shadowColor = color;

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.restore();

  }


  // =========================================================
  // BARS
  // =========================================================

  function drawBars(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 64;

    const gap = 5;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (let i = 0; i < count; i++) {

      const index =
        Math.floor(
          i / count * freqBytes.length
        );

      const value =
        freqBytes[index] / 255;

      const barHeight =
        Math.max(
          4,
          value * h * 0.52 *
          (1 + bass * 0.35)
        );

      const x =
        i * (barWidth + gap);

      const y =
        h - barHeight - 24;

      const gradient =
        ctx.createLinearGradient(
          0,
          y,
          0,
          h
        );

      gradient.addColorStop(
        0,
        '#22d3ee'
      );

      gradient.addColorStop(
        0.5,
        '#818cf8'
      );

      gradient.addColorStop(
        1,
        '#f472b6'
      );

      ctx.fillStyle = gradient;

      ctx.fillRect(
        x,
        y,
        barWidth,
        barHeight
      );

    }

  }


  // =========================================================
  // WAVE
  // =========================================================

  function drawWave(timeBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const centerY =
      h * 0.53;

    ctx.save();

    ctx.lineWidth = 5;

    ctx.strokeStyle =
      '#67e8f9';

    ctx.shadowBlur = 20;

    ctx.shadowColor =
      '#22d3ee';

    ctx.beginPath();

    const slice =
      w / (timeBytes.length - 1);

    for (
      let i = 0;
      i < timeBytes.length;
      i++
    ) {

      const normalized =
        (timeBytes[i] - 128) / 128;

      const y =
        centerY +
        normalized *
        h *
        0.28 *
        (1 + bass * 0.25);

      const x =
        i * slice;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

    }

    ctx.stroke();

    ctx.restore();

  }


  // =========================================================
  // CIRCLE
  // =========================================================

  function drawCircle(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const cx = w / 2;
    const cy = h / 2;

    const baseR =
      Math.min(w, h) *
      0.17 *
      (1 + bass * 0.2);

    const count =
      freqBytes.length;

    ctx.save();

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[i] / 255;

      const angle =
        (i / count) *
        Math.PI * 2;

      const inner =
        baseR;

      const outer =
        inner +
        value *
        Math.min(w, h) *
        0.30;

      const x1 =
        cx + Math.cos(angle) * inner;

      const y1 =
        cy + Math.sin(angle) * inner;

      const x2 =
        cx + Math.cos(angle) * outer;

      const y2 =
        cy + Math.sin(angle) * outer;

      const hue =
        190 + (i / count) * 160;

      const color =
        `hsl(${hue},90%,65%)`;

      drawGlowLine(
        x1,
        y1,
        x2,
        y2,
        color,
        4,
        14
      );

    }

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      baseR,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.8)';

    ctx.lineWidth = 2;

    ctx.shadowBlur = 15;

    ctx.shadowColor =
      '#ffffff';

    ctx.stroke();

    ctx.restore();

  }


  // =========================================================
  // MIRROR SPECTRUM
  // =========================================================

  function drawMirror(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const center =
      h * 0.57;

    const count = 64;

    const gap = 4;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const index =
        Math.floor(
          i / count * freqBytes.length
        );

      const value =
        freqBytes[index] / 255;

      const barHeight =
        Math.max(
          3,
          value *
          h *
          0.32 *
          (1 + bass * 0.25)
        );

      const x =
        i * (barWidth + gap);

      const gradient =
        ctx.createLinearGradient(
          0,
          center - barHeight,
          0,
          center + barHeight
        );

      gradient.addColorStop(
        0,
        '#a78bfa'
      );

      gradient.addColorStop(
        0.5,
        '#22d3ee'
      );

      gradient.addColorStop(
        1,
        '#f472b6'
      );

      ctx.fillStyle = gradient;

      ctx.fillRect(
        x,
        center - barHeight,
        barWidth,
        barHeight
      );

      ctx.globalAlpha = 0.72;

      ctx.fillRect(
        x,
        center,
        barWidth,
        barHeight
      );

      ctx.globalAlpha = 1;

    }

  }


  // =========================================================
  // NEON
  // =========================================================

  function drawNeon(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 72;

    const gap = 3;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const index =
        Math.floor(
          i / count *
          freqBytes.length
        );

      const value =
        freqBytes[index] / 255;

      const barHeight =
        8 +
        value *
        h *
        0.52 *
        (1 + bass * 0.4);

      const x =
        i * (barWidth + gap);

      const y =
        h - barHeight - 20;

      const color =
        NEON_COLORS[
          i % NEON_COLORS.length
        ];

      ctx.save();

      ctx.fillStyle =
        color;

      ctx.shadowBlur = 22;

      ctx.shadowColor =
        color;

      ctx.beginPath();

      if (ctx.roundRect) {

        ctx.roundRect(
          x,
          y,
          barWidth,
          barHeight,
          barWidth / 2
        );

      } else {

        ctx.fillRect(
          x,
          y,
          barWidth,
          barHeight
        );

      }

      ctx.fill();

      ctx.restore();

    }

  }


  // =========================================================
  // RADIAL GLOW
  // =========================================================

  function drawRadial(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const cx = w / 2;
    const cy = h / 2;

    const baseR =
      Math.min(w, h) *
      0.12;

    const count = 96;

    ctx.save();

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[
          Math.floor(
            i / count *
            freqBytes.length
          )
        ] / 255;

      const angle =
        i / count *
        Math.PI * 2;

      const r1 =
        baseR;

      const r2 =
        baseR +
        value *
        Math.min(w, h) *
        0.38 *
        (1 + bass * 0.25);

      const x1 =
        cx +
        Math.cos(angle) *
        r1;

      const y1 =
        cy +
        Math.sin(angle) *
        r1;

      const x2 =
        cx +
        Math.cos(angle) *
        r2;

      const y2 =
        cy +
        Math.sin(angle) *
        r2;

      const hue =
        (i * 3 + 190) % 360;

      const color =
        `hsl(${hue},100%,65%)`;

      drawGlowLine(
        x1,
        y1,
        x2,
        y2,
        color,
        3,
        18
      );

    }

    ctx.restore();

  }


  // =========================================================
  // DOTS
  // =========================================================

  function drawDots(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 100;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const index =
        Math.floor(
          i / count *
          freqBytes.length
        );

      const value =
        freqBytes[index] / 255;

      const x =
        (i / count) *
        w;

      const yBase =
        h * 0.72;

      const y =
        yBase -
        value *
        h *
        0.48;

      const radius =
        3 +
        value *
        10 +
        bass *
        3;

      const hue =
        190 +
        (i / count) *
        150;

      const color =
        `hsl(${hue},95%,65%)`;

      ctx.save();

      ctx.fillStyle =
        color;

      ctx.shadowBlur =
        18;

      ctx.shadowColor =
        color;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

    }

  }


  // =========================================================
  // ORBIT
  // =========================================================

  function drawOrbit(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const cx = w / 2;
    const cy = h / 2;

    const base =
      Math.min(w, h) * 0.16;

    const rings = 4;

    ctx.save();

    for (
      let ring = 0;
      ring < rings;
      ring++
    ) {

      const radius =
        base +
        ring * 55 +
        bass * 20;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        `rgba(103,232,249,${0.18 + ring * 0.05})`;

      ctx.lineWidth = 2;

      ctx.stroke();

    }


    const count = 72;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[
          Math.floor(
            i / count *
            freqBytes.length
          )
        ] / 255;

      const angle =
        i / count *
        Math.PI * 2;

      const radius =
        base +
        value *
        Math.min(w, h) *
        0.30;

      const x =
        cx +
        Math.cos(angle) *
        radius;

      const y =
        cy +
        Math.sin(angle) *
        radius;

      const size =
        2 +
        value * 8;

      const hue =
        180 +
        i * 2.5;

      const color =
        `hsl(${hue % 360},95%,65%)`;

      ctx.fillStyle =
        color;

      ctx.shadowBlur = 18;

      ctx.shadowColor =
        color;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        size,
        0,
        Math.PI * 2
      );

      ctx.fill();

    }

    ctx.restore();

  }


  // =========================================================
  // PARTICLES
  // =========================================================

  function drawParticles(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 150;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const waveIndex =
        i % freqBytes.length;

      const value =
        freqBytes[waveIndex] / 255;

      // Deterministic positions.
      // Important for offline video export.
      const px =
        (
          Math.sin(i * 12.9898) *
          43758.5453
        ) % 1;

      const py =
        (
          Math.sin(i * 78.233) *
          12345.6789
        ) % 1;

      const normalizedX =
        Math.abs(px);

      const normalizedY =
        Math.abs(py);

      const x =
        normalizedX * w;

      const baseY =
        normalizedY * h;

      const y =
        baseY -
        value *
        h *
        0.20;

      const radius =
        1.5 +
        value * 5 +
        bass * 2;

      const hue =
        185 +
        (i * 2.3) % 150;

      const color =
        `hsla(${hue},100%,70%,${0.35 + value * 0.65})`;

      ctx.save();

      ctx.fillStyle =
        color;

      ctx.shadowBlur = 14;

      ctx.shadowColor =
        color;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

    }

  }


  // =========================================================
  // AURORA
  // =========================================================

  function drawAurora(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    ctx.globalCompositeOperation =
      'screen';

    for (
      let layer = 0;
      layer < 5;
      layer++
    ) {

      ctx.beginPath();

      const amplitude =
        h *
        (0.07 + bass * 0.08) *
        (1 + layer * 0.1);

      for (
        let x = 0;
        x <= w;
        x += 12
      ) {

        const index =
          Math.floor(
            x / w *
            freqBytes.length
          );

        const value =
          freqBytes[index] / 255;

        const wave =
          Math.sin(
            x * 0.008 +
            layer * 0.9
          ) *
          amplitude;

        const audioWave =
          value *
          h *
          0.18;

        const y =
          h * 0.58 +
          wave -
          audioWave -
          layer * 25;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

      }

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const gradient =
        ctx.createLinearGradient(
          0,
          0,
          w,
          0
        );

      gradient.addColorStop(
        0,
        `hsla(${180 + layer * 25},90%,60%,0.12)`
      );

      gradient.addColorStop(
        0.5,
        `hsla(${230 + layer * 20},90%,65%,0.20)`
      );

      gradient.addColorStop(
        1,
        `hsla(${310 + layer * 10},90%,65%,0.12)`
      );

      ctx.fillStyle =
        gradient;

      ctx.fill();

    }

    ctx.restore();

  }


  // =========================================================
  // FLAME
  // =========================================================

  function drawFlame(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 70;

    const gap = 3;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[
          Math.floor(
            i / count *
            freqBytes.length
          )
        ] / 255;

      const height =
        8 +
        value *
        h *
        0.60 *
        (1 + bass * 0.35);

      const x =
        i *
        (barWidth + gap);

      const y =
        h -
        height -
        18;

      const gradient =
        ctx.createLinearGradient(
          0,
          y,
          0,
          h
        );

      gradient.addColorStop(
        0,
        '#fff7ed'
      );

      gradient.addColorStop(
        0.18,
        '#facc15'
      );

      gradient.addColorStop(
        0.48,
        '#fb923c'
      );

      gradient.addColorStop(
        0.75,
        '#ef4444'
      );

      gradient.addColorStop(
        1,
        '#7f1d1d'
      );

      ctx.save();

      ctx.fillStyle =
        gradient;

      ctx.shadowBlur = 15;

      ctx.shadowColor =
        '#f97316';

      ctx.fillRect(
        x,
        y,
        barWidth,
        height
      );

      ctx.restore();

    }

  }


  // =========================================================
  // GLASS SPECTRUM
  // =========================================================

  function drawGlass(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 56;

    const gap = 7;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[
          Math.floor(
            i / count *
            freqBytes.length
          )
        ] / 255;

      const barHeight =
        12 +
        value *
        h *
        0.48 *
        (1 + bass * 0.25);

      const x =
        i *
        (barWidth + gap);

      const y =
        h -
        barHeight -
        25;

      const gradient =
        ctx.createLinearGradient(
          0,
          y,
          0,
          h
        );

      gradient.addColorStop(
        0,
        'rgba(255,255,255,0.85)'
      );

      gradient.addColorStop(
        0.45,
        'rgba(125,211,252,0.52)'
      );

      gradient.addColorStop(
        1,
        'rgba(244,114,182,0.20)'
      );

      ctx.save();

      ctx.fillStyle =
        gradient;

      ctx.strokeStyle =
        'rgba(255,255,255,0.45)';

      ctx.lineWidth = 1.5;

      if (ctx.roundRect) {

        ctx.beginPath();

        ctx.roundRect(
          x,
          y,
          barWidth,
          barHeight,
          8
        );

        ctx.fill();
        ctx.stroke();

      } else {

        ctx.fillRect(
          x,
          y,
          barWidth,
          barHeight
        );

      }

      ctx.restore();

    }

  }


  // =========================================================
  // RICKSHAW
  // =========================================================

  function drawRickshaw(freqBytes, bass) {

    const w = canvas.width;
    const h = canvas.height;

    const count = 64;

    const gap = 4;

    const barWidth =
      (w - gap * (count - 1)) / count;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const value =
        freqBytes[
          Math.floor(
            i / count *
            freqBytes.length
          )
        ] / 255;

      const height =
        value *
        h *
        0.58 *
        (1 + bass * 0.3);

      const x =
        i *
        (barWidth + gap);

      const y =
        h -
        height -
        20;

      ctx.fillStyle =
        RICKSHAW[
          i % RICKSHAW.length
        ];

      ctx.shadowBlur = 8;

      ctx.shadowColor =
        ctx.fillStyle;

      ctx.fillRect(
        x,
        y,
        barWidth,
        height
      );

    }

    ctx.shadowBlur = 0;

    drawRickshawBorder();

  }


  // =========================================================
  // MAIN CANVAS PAINTER
  // =========================================================

  function paintCanvas(
    freqBytes,
    timeBytes,
    bass,
    style,
    title
  ) {

    const w = canvas.width;
    const h = canvas.height;

    // Clear frame first.
    ctx.clearRect(
      0,
      0,
      w,
      h
    );

    // Background.
    drawBackground(bass);


    // Visualizer.
    switch (style) {

      case 'wave':
        drawWave(
          timeBytes,
          bass
        );
        break;


      case 'circle':
        drawCircle(
          freqBytes,
          bass
        );
        break;


      case 'mirror':
        drawMirror(
          freqBytes,
          bass
        );
        break;


      case 'neon':
        drawNeon(
          freqBytes,
          bass
        );
        break;


      case 'radial':
        drawRadial(
          freqBytes,
          bass
        );
        break;


      case 'dots':
        drawDots(
          freqBytes,
          bass
        );
        break;


      case 'orbit':
        drawOrbit(
          freqBytes,
          bass
        );
        break;


      case 'particles':
        drawParticles(
          freqBytes,
          bass
        );
        break;


      case 'aurora':
        drawAurora(
          freqBytes,
          bass
        );
        break;


      case 'flame':
        drawFlame(
          freqBytes,
          bass
        );
        break;


      case 'glass':
        drawGlass(
          freqBytes,
          bass
        );
        break;


      case 'rickshaw':
        drawRickshaw(
          freqBytes,
          bass
        );
        break;


      case 'bars':
      default:
        drawBars(
          freqBytes,
          bass
        );
        break;

    }


    // Title on top.
    drawTitle(title);

  }


  // =========================================================
  // AUDIO GRAPH FOR LIVE PREVIEW
  // =========================================================

  function setupAudioGraph() {

    if (audioCtx) {
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {

      setStatus(
        'Web Audio API is not supported in this browser.'
      );

      return;

    }

    audioCtx =
      new AudioContextClass();

    srcNode =
      audioCtx.createMediaElementSource(
        audioEl
      );

    analyser =
      audioCtx.createAnalyser();

    analyser.fftSize = 256;

    analyser.smoothingTimeConstant =
      0.78;

    srcNode.connect(
      analyser
    );

    analyser.connect(
      audioCtx.destination
    );

    freqLive =
      new Uint8Array(
        analyser.frequencyBinCount
      );

    timeLive =
      new Uint8Array(
        analyser.fftSize
      );

  }


  // =========================================================
  // LIVE LOOP
  // =========================================================

  function liveLoop() {

    if (!analyser) {
      return;
    }

    analyser.getByteFrequencyData(
      freqLive
    );

    analyser.getByteTimeDomainData(
      timeLive
    );


    let bassSum = 0;

    const bassBins =
      Math.min(
        12,
        freqLive.length
      );

    for (
      let i = 0;
      i < bassBins;
      i++
    ) {

      bassSum +=
        freqLive[i];

    }


    const bass =
      (bassSum / bassBins) / 255;


    paintCanvas(
      freqLive,
      timeLive,
      bass,
      styleSelect.value,
      titleInput.value.trim()
    );


    if (audioEl.duration) {

      const percentage =
        (
          audioEl.currentTime /
          audioEl.duration
        ) * 100;

      progressBar.style.width =
        percentage + '%';

    }


    if (
      !audioEl.paused &&
      !audioEl.ended
    ) {

      rafId =
        requestAnimationFrame(
          liveLoop
        );

    } else {

      rafId = null;

    }

  }


  // =========================================================
  // PREVIEW BUTTON
  // =========================================================

  previewBtn.addEventListener(
    'click',
    async function () {

      setupAudioGraph();

      if (!audioCtx) {
        return;
      }

      if (
        audioCtx.state ===
        'suspended'
      ) {

        await audioCtx.resume();

      }


      if (audioEl.paused) {

        if (audioEl.ended) {
          audioEl.currentTime = 0;
        }

        try {

          await audioEl.play();

        } catch (error) {

          setStatus(
            'Could not start audio preview.'
          );

          return;

        }

        previewBtn.textContent =
          '⏸ Pause';

        setStatus(
          'Previewing ' +
          styleSelect.options[
            styleSelect.selectedIndex
          ].text +
          '…'
        );

        if (!rafId) {
          liveLoop();
        }

      } else {

        audioEl.pause();

        previewBtn.textContent =
          '▶ Preview';

        setStatus(
          'Preview paused.'
        );

      }

    }
  );


  // =========================================================
  // CHANGE STYLE WHILE PREVIEWING
  // =========================================================

  styleSelect.addEventListener(
    'change',
    function () {

      if (
        audioEl.paused &&
        img
      ) {

        paintCanvas(
          new Uint8Array(128),
          new Uint8Array(128),
          0,
          styleSelect.value,
          titleInput.value.trim()
        );

      }

      if (!audioEl.paused) {

        setStatus(
          'Previewing ' +
          styleSelect.options[
            styleSelect.selectedIndex
          ].text +
          '…'
        );

      }

    }
  );


  // =========================================================
  // LIVE TITLE UPDATE
  // =========================================================

  titleInput.addEventListener(
    'input',
    function () {

      if (
        audioEl.paused &&
        img
      ) {

        paintCanvas(
          new Uint8Array(128),
          new Uint8Array(128),
          0,
          styleSelect.value,
          titleInput.value.trim()
        );

      }

    }
  );


  // =========================================================
  // AUDIO ENDED
  // =========================================================

  audioEl.addEventListener(
    'ended',
    function () {

      setStatus(
        'Preview finished.'
      );

      progressBar.style.width =
        '0%';

      previewBtn.textContent =
        '▶ Preview';

    }
  );


  // =========================================================
  // OFFLINE AUDIO FFT
  // =========================================================

  const FFT_SIZE = 256;


  const HANN = (() => {

    const windowData =
      new Float32Array(
        FFT_SIZE
      );

    for (
      let i = 0;
      i < FFT_SIZE;
      i++
    ) {

      windowData[i] =
        0.5 *
        (
          1 -
          Math.cos(
            2 *
            Math.PI *
            i /
            (FFT_SIZE - 1)
          )
        );

    }

    return windowData;

  })();


  // =========================================================
  // FFT
  // =========================================================

  function fft(re, im) {

    const n =
      re.length;


    // Bit reversal.
    for (
      let i = 1, j = 0;
      i < n;
      i++
    ) {

      let bit =
        n >> 1;

      for (
        ;
        j & bit;
        bit >>= 1
      ) {

        j ^= bit;

      }

      j ^= bit;


      if (i < j) {

        let temp =
          re[i];

        re[i] =
          re[j];

        re[j] =
          temp;


        temp =
          im[i];

        im[i] =
          im[j];

        im[j] =
          temp;

      }

    }


    // FFT stages.
    for (
      let len = 2;
      len <= n;
      len <<= 1
    ) {

      const angle =
        -2 *
        Math.PI /
        len;

      const wr =
        Math.cos(angle);

      const wi =
        Math.sin(angle);


      for (
        let i = 0;
        i < n;
        i += len
      ) {

        let currentWr = 1;
        let currentWi = 0;


        for (
          let j = 0;
          j < len / 2;
          j++
        ) {

          const ur =
            re[i + j];

          const ui =
            im[i + j];


          const vr =
            re[
              i +
              j +
              len / 2
            ] *
            currentWr -
            im[
              i +
              j +
              len / 2
            ] *
            currentWi;


          const vi =
            re[
              i +
              j +
              len / 2
            ] *
            currentWi +
            im[
              i +
              j +
              len / 2
            ] *
            currentWr;


          re[i + j] =
            ur + vr;

          im[i + j] =
            ui + vi;


          re[
            i +
            j +
            len / 2
          ] =
            ur - vr;

          im[
            i +
            j +
            len / 2
          ] =
            ui - vi;


          const nextWr =
            currentWr * wr -
            currentWi * wi;

          const nextWi =
            currentWr * wi +
            currentWi * wr;


          currentWr =
            nextWr;

          currentWi =
            nextWi;

        }

      }

    }

  }


  // =========================================================
  // COMPUTE AUDIO FRAME
  // =========================================================

  function computeFrameData(
    mono,
    sampleRate,
    time,
    smoothed
  ) {

    const N =
      FFT_SIZE;

    const half =
      N / 2;


    const center =
      Math.round(
        time *
        sampleRate
      );


    const re =
      new Float32Array(N);

    const im =
      new Float32Array(N);


    // Prepare FFT window.
    for (
      let i = 0;
      i < N;
      i++
    ) {

      const index =
        center -
        half +
        i;

      const sample =
        (
          index >= 0 &&
          index < mono.length
        )
          ? mono[index]
          : 0;

      re[i] =
        sample *
        HANN[i];

    }


    fft(
      re,
      im
    );


    // Frequency data.
    const freqBytes =
      new Uint8Array(128);


    const minDb =
      -100;

    const maxDb =
      -30;


    for (
      let k = 0;
      k < 128;
      k++
    ) {

      const magnitude =
        Math.sqrt(
          re[k] * re[k] +
          im[k] * im[k]
        ) / N;


      const db =
        magnitude > 0
          ? 20 *
            Math.log10(magnitude)
          : minDb;


      let value =
        (
          (db - minDb) /
          (maxDb - minDb)
        ) * 255;


      value =
        Math.max(
          0,
          Math.min(
            255,
            value
          )
        );


      // Smoothing makes exported animation less jittery.
      smoothed[k] =
        smoothed[k] * 0.55 +
        value * 0.45;


      freqBytes[k] =
        smoothed[k];

    }


    // Time domain data.
    const timeBytes =
      new Uint8Array(128);


    for (
      let k = 0;
      k < 128;
      k++
    ) {

      const index =
        center -
        half +
        k * 2;


      const sample =
        (
          index >= 0 &&
          index < mono.length
        )
          ? mono[index]
          : 0;


      timeBytes[k] =
        Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (
                sample *
                0.5 +
                0.5
              ) * 255
            )
          )
        );

    }


    // Bass detection.
    let bassSum = 0;

    const bassBins = 8;

    for (
      let i = 0;
      i < bassBins;
      i++
    ) {

      bassSum +=
        freqBytes[i];

    }


    const bass =
      (
        bassSum /
        bassBins
      ) / 255;


    return {
      freqBytes,
      timeBytes,
      bass
    };

  }


  // =========================================================
  // FINISH UI
  // =========================================================

  function finishUI() {

    recordBtn.disabled =
      !canExport ||
      !img ||
      !audioReady;

    previewBtn.disabled =
      !img ||
      !audioReady;

    recordBtn.textContent =
      '⏺ Create Video';

  }


  // =========================================================
  // CREATE VIDEO
  // =========================================================

  recordBtn.addEventListener(
    'click',
    async function () {

      if (!canExport) {

        setStatus(
          'Video export needs Chrome or Edge.'
        );

        return;

      }


      if (!audioFile || !img) {

        setStatus(
          'Please choose both an audio file and an image.'
        );

        return;

      }


      downloadArea.innerHTML = '';

      recordBtn.disabled = true;
      previewBtn.disabled = true;

      recordBtn.textContent =
        '⏳ Working…';


      if (!audioEl.paused) {
        audioEl.pause();
      }


      try {

        // ---------------------------------------------------
        // DECODE AUDIO
        // ---------------------------------------------------

        setStatus(
          'Decoding audio…'
        );


        const arrayBuffer =
          await audioFile.arrayBuffer();


        const AudioContextClass =
          window.AudioContext ||
          window.webkitAudioContext;


        const decodeCtx =
          new AudioContextClass();


        const audioBuffer =
          await decodeCtx.decodeAudioData(
            arrayBuffer.slice(0)
          );


        const duration =
          audioBuffer.duration;


        const sampleRate =
          audioBuffer.sampleRate;


        // ---------------------------------------------------
        // CONVERT TO MONO
        // ---------------------------------------------------

        const channels = [];


        for (
          let c = 0;
          c < audioBuffer.numberOfChannels;
          c++
        ) {

          channels.push(
            audioBuffer.getChannelData(c)
          );

        }


        const mono =
          new Float32Array(
            audioBuffer.length
          );


        for (
          let i = 0;
          i < mono.length;
          i++
        ) {

          let sample = 0;


          for (
            let c = 0;
            c < channels.length;
            c++
          ) {

            sample +=
              channels[c][i];

          }


          mono[i] =
            sample /
            channels.length;

        }


        // ---------------------------------------------------
        // SAVE LOCATION
        // ---------------------------------------------------

        let writableStream = null;
        let useFS = false;


        if (window.showSaveFilePicker) {

          try {

            const handle =
              await window.showSaveFilePicker({

                suggestedName:
                  'talkify-video.webm',

                types: [
                  {
                    description:
                      'WebM Video',

                    accept: {
                      'video/webm': [
                        '.webm'
                      ]
                    }
                  }
                ]

              });


            writableStream =
              await handle.createWritable();

            useFS = true;

          } catch (error) {

            if (
              error &&
              error.name ===
              'AbortError'
            ) {

              setStatus(
                'Export cancelled.'
              );

              finishUI();

              return;

            }

            console.warn(
              'Save picker unavailable. Using browser download.',
              error
            );

          }

        }


        // ---------------------------------------------------
        // LOAD MEDIABUNNY
        // ---------------------------------------------------

        setStatus(
          'Loading video engine…'
        );


        const {
          Output,
          WebMOutputFormat,
          BufferTarget,
          StreamTarget,
          CanvasSource,
          AudioBufferSource,
          Quality
        } = await loadMediabunny();


        // ---------------------------------------------------
        // OUTPUT
        // ---------------------------------------------------

        const target =
          useFS
            ? new StreamTarget(
                writableStream,
                {
                  chunked: true
                }
              )
            : new BufferTarget();


        const output =
          new Output({
            format:
              new WebMOutputFormat(),

            target
          });


        const videoSource =
          new CanvasSource(
            canvas,
            {
              codec: 'vp9',

              quality:
                new Quality({
                  bitrate:
                    5_000_000
                })
            }
          );


        const audioSource =
          new AudioBufferSource(
            {
              codec: 'opus',

              quality:
                new Quality({
                  bitrate:
                    128_000
                })
            }
          );


        output.addVideoTrack(
          videoSource,
          {
            frameRate: 30
          }
        );


        output.addAudioTrack(
          audioSource
        );


        await output.start();


        // ---------------------------------------------------
        // AUDIO TRACK
        // ---------------------------------------------------

        setStatus(
          'Encoding audio…'
        );


        await audioSource.add(
          audioBuffer
        );


        audioSource.close();


        // ---------------------------------------------------
        // VIDEO FRAMES
        // ---------------------------------------------------

        const fps = 30;


        const totalFrames =
          Math.max(
            1,
            Math.ceil(
              duration * fps
            )
          );


        const smoothed =
          new Uint8Array(128);


        const title =
          titleInput.value.trim();


        const style =
          styleSelect.value;


        for (
          let frame = 0;
          frame < totalFrames;
          frame++
        ) {

          const time =
            frame / fps;


          const {
            freqBytes,
            timeBytes,
            bass
          } =
            computeFrameData(
              mono,
              sampleRate,
              time,
              smoothed
            );


          // Same painter used by live preview.
          paintCanvas(
            freqBytes,
            timeBytes,
            bass,
            style,
            title
          );


          await videoSource.add(
            time,
            1 / fps
          );


          const percentage =
            Math.round(
              (
                (frame + 1) /
                totalFrames
              ) * 100
            );


          progressBar.style.width =
            percentage + '%';


          setStatus(
            'Rendering video… ' +
            percentage +
            '%'
          );


          // Give browser UI a chance to update.
          if (frame % 10 === 0) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  0
                )
            );
          }

        }


        // ---------------------------------------------------
        // FINALIZE
        // ---------------------------------------------------

        videoSource.close();


        setStatus(
          'Finishing up…'
        );


        await output.finalize();


        // ---------------------------------------------------
        // FILE SYSTEM SAVE
        // ---------------------------------------------------

        if (useFS) {

          setStatus(
            'Saved! ✅'
          );

          progressBar.style.width =
            '0%';

        }


        // ---------------------------------------------------
        // BROWSER DOWNLOAD
        // ---------------------------------------------------

        else {

          const buffer =
            output.target.buffer;


          const blob =
            new Blob(
              [buffer],
              {
                type:
                  'video/webm'
              }
            );


          const url =
            URL.createObjectURL(
              blob
            );


          // Auto download.
          const a =
            document.createElement(
              'a'
            );


          a.href = url;

          a.download =
            'talkify-video.webm';


          document.body.appendChild(
            a
          );

          a.click();

          a.remove();


          // Manual download button.
          const link =
            document.createElement(
              'a'
            );


          link.href = url;

          link.download =
            'talkify-video.webm';


          link.className =
            'dl-btn';


          link.textContent =
            '⬇ Download Video (' +
            (
              blob.size /
              1024 /
              1024
            ).toFixed(1) +
            ' MB)';


          downloadArea.appendChild(
            link
          );


          setStatus(
            'Video ready! If it did not auto-download, use the button below.'
          );


          progressBar.style.width =
            '0%';

        }


        finishUI();


      } catch (error) {

        console.error(
          'Export failed:',
          error
        );


        setStatus(
          'Export failed: ' +
          (
            error &&
            error.message
              ? error.message
              : error
          ) +
          '. Try Chrome or Edge.'
        );


        progressBar.style.width =
          '0%';


        finishUI();

      }

    }
  );

})();