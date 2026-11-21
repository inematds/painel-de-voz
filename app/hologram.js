import {drawHumanHologram} from './human-hologram.js';

const canvas = document.querySelector('#hologram');
const context = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dots = Array.from({length: 520}, (_, i) => {
  const y = 1 - 2 * (i + .5) / 520;
  const distance = Math.sqrt(1 - y * y);
  const angle = i * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(angle) * distance, y, Math.sin(angle) * distance];
});

export function animate(getState) {
  if (!context) return;
  let width = 0;
  let height = 0;
  let scale = 1;
  let frame = 0;
  let lastDraw = 0;
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    if (!reduced.matches && time - lastDraw < 30) { schedule(); return; }
    lastDraw = time;
    const {state, visual, signal, articulation} = getState();
    draw(width, height, scale, reduced.matches ? 0 : time / 1000, state, visual, reduced.matches ? null : signal, reduced.matches ? null : articulation);
    if (!reduced.matches && !document.hidden) schedule();
  }
  new ResizeObserver(([entry]) => {
    const {width: w, height: h} = entry.contentRect;
    scale = Math.min(devicePixelRatio || 1, 2);
    width = w;
    height = h;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    schedule();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  reduced.addEventListener('change', schedule);
  return schedule;
}

function draw(w, h, scale, time, state, visual, signal, articulation) {
  if (!w || !h) return;
  const ctx = context;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  const radius = Math.min(w * .28, h * .34, 195);
  const level = signal?.level || 0;
  const energy = (state === 'processing' ? .36 : .15) + level * .8;
  const light = ctx.createRadialGradient(0, 0, radius * .06, 0, 0, radius * 1.7);
  light.addColorStop(0, 'rgba(80,208,254,.16)');
  light.addColorStop(1, 'rgba(41,130,180,0)');
  if (visual === 'human') {
    drawHumanHologram(ctx,w,h,time,state,level,articulation);
    return;
  }
  const avatar = visual === 'robot' || visual === 'robot-f';
  if (avatar) {
    const speechLevel = state === 'speaking' && signal?.origin === 'playback' ? level : 0;
    drawRobot(ctx, Math.min(w / 320, h / 310, 1.74), time, speechLevel, visual === 'robot-f', state);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = light;
  ctx.fillRect(-w/2, -h/2, w, h);
  ctx.restore();
  if (avatar) return;
  if (visual === 'wave') {
    drawWave(ctx, Math.min(w * .85, 620), Math.min(h * .39, 145), signal);
    return;
  }
  for (let ring = 0; ring < 4; ring++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(142,233,246,${.16+ring*.055})`;
    ctx.ellipse(0, 0, radius*(1.16+ring*.1), radius*(.22+ring*.15),
      -.4 + ring*.54 + Math.sin(time*.35+ring)*.22, 0, Math.PI*2);
    ctx.stroke();
  }
  const angle = time * (.26 + energy * .24);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pulse = 1 + level * .12 + Math.sin(time * 4) * energy * .025;
  for (const [x,y,z] of dots) {
    const depth = z*cos-x*sin;
    const px = (x*cos+z*sin) * radius * pulse;
    const py = (y*.94+depth*.23) * radius * pulse;
    ctx.fillStyle = `rgba(155,235,255,${.18+(depth+1)*.33})`;
    ctx.fillRect(px, py, 1.35+depth*.7, 1.35+depth*.7);
  }
}

function drawWave(ctx, width, height, signal) {
  ctx.strokeStyle = 'rgba(142,233,246,.16)';
  ctx.lineWidth = 1;
  for (let y = -2; y <= 2; y++) {
    ctx.beginPath();
    ctx.moveTo(-width / 2, y * height / 2);
    ctx.lineTo(width / 2, y * height / 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#a2effb';
  const samples = signal?.samples;
  const points = 250;
  for (let i = 0; i <= points; i++) {
    const position = i / points;
    const sample = samples ? samples[Math.floor(position * (samples.length - 1))] : 0;
    const x = (position - .5) * width;
    const y = Math.tanh(sample * 3) * height * Math.sin(Math.PI * position) ** .35;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#a2effb';
  const active = Math.round((signal?.level || 0) * 25);
  for (let i = 0; i < 25; i++) {
    ctx.globalAlpha = i < active ? .85 : .18;
    ctx.fillRect(-width / 2 + width * i / 25, height * 1.18, width / 25 - 3, 3);
  }
  ctx.globalAlpha = 1;
}

// The busts are built from authored contours at different depths. Keep the contours
// themselves immutable; expressions and projection operate on the canvas transform.
const contours = new Map();
function plate(ctx, outline, fill, stroke, width = 1) {
  let path = contours.get(outline);
  if (!path) {
    path = new Path2D(outline);
    contours.set(outline, path);
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(path); }
}

function oval(ctx, x, y, rx, ry, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function finish(ctx, x1, y1, x2, y2, stops) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  return gradient;
}

function optics(ctx, x, y, blink, gaze, radius) {
  ctx.save();
  ctx.translate(x + gaze, y);
  ctx.scale(1, blink);
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 1.7);
  glow.addColorStop(0, '#70faff');
  glow.addColorStop(.45, '#2adff1');
  glow.addColorStop(1, 'rgba(42,223,241,0)');
  oval(ctx, 0, 0, radius * 1.7, radius * 1.7, glow);
  oval(ctx, 0, 0, radius, radius, '#09506a', '#b2fffd', 1.8);
  oval(ctx, 0, 0, radius * .65, radius * .65, '#09293c', '#4edfeb', .9);
  oval(ctx, 0, 0, radius * .32, radius * .32, '#b5fffc');
  oval(ctx, -radius * .42, -radius * .45, 1.7, 1.7, '#efffff');
  ctx.restore();
}

function drawEngineer(ctx, layer, blink, gaze, openness) {
  const rim = '#80b2bd';
  const light = '#c2fafe';
  const joint = '#102530';
  const shell = finish(ctx, -63, -86, 64, 46, [
    [0,'#e2eeeb'], [.22,'#b7cece'], [.53,'#7395a1'], [.79,'#3d6276'], [1,'#18384a']
  ]);
  const body = finish(ctx, -95, 66, 67, 139, [[0,'#a1c4ca'], [.38,'#527b89'], [.73,'#284757'], [1,'#152f3d']]);
  const glass = finish(ctx, -15,-49,14,2, [[0,'#244d5d'], [.27,'#0f2938'], [.76,'#06161f'], [1,'#1a3542']]);

  layer(-14, false, () => {
    plate(ctx, 'M-108 111 Q-106 92 -82 86 L-42 72 Q-26 62 -25 48 L25 48 Q26 63 42 72 L82 86 Q106 92 108 111 Q82 134 0 136 Q-82 134 -108 111Z', body, rim);
    plate(ctx, 'M-105 107 Q-94 92 -73 87 L-55 81 L-43 97 L-61 111 L-86 119Z M105 107 Q94 92 73 87 L55 81 L43 97 L61 111 L86 119Z', shell, '#769aa5');
    plate(ctx, 'M-53 84 L-27 94 L0 99 L27 94 L53 84 L47 105 L17 124 H-17 L-47 105Z', joint, rim);
    plate(ctx, 'M-26 110 L-12 116 H12 L26 110', null, '#74f4f6', 2.4);
    plate(ctx, 'M-24 46 H24 L32 82 Q0 102 -32 82Z', joint, rim);
    plate(ctx, 'M-24 61 Q0 73 24 61 M-25 69 Q0 82 25 69 M-26 77 Q0 90 26 77', null, '#71949e', 2.7);
  });
  layer(-19, true, () => {
    plate(ctx, 'M-46 -69 L-69 -106 L-69 -122', null, '#638797', 4);
    oval(ctx,-69,-123,3.8,3.8,'#ffb86c');
    plate(ctx, 'M-75 -44 Q-81 -40 -81 -26 V6 L-72 19 H-53 V-43Z M75 -44 Q81 -40 81 -26 V6 L72 19 H53 V-43Z', joint, rim, 1.6);
    plate(ctx, 'M-76 -31 V4 M76 -31 V4', null, '#70dbe6', 2.4);
    plate(ctx, 'M-66 -54 Q-60 -94 -24 -100 Q11 -108 47 -90 Q68 -78 70 -49 V8 Q65 36 37 52 L23 58 H-19 L-48 44 Q-72 26 -70 2Z', '#335361', rim, 1.6);
  });
  layer(3, true, () => {
    plate(ctx, 'M-66 -56 Q-64 -86 -41 -95 Q-13 -105 22 -101 Q64 -98 68 -66 L70 -14 Q68 15 56 32 L34 53 Q28 59 19 61 H-19 Q-28 60 -35 54 L-55 38 Q-67 26 -69 6Z', shell, '#bbd9da', 1.3);
    plate(ctx, 'M30 -99 Q64 -97 68 -66 L70 -14 Q68 15 56 32 L34 53 L24 56 Q53 32 54 2 L55 -54 Q55 -86 30 -99Z', 'rgba(10,36,49,.29)');
    plate(ctx, 'M-62 -65 Q-61 -85 -42 -92 Q-36 -94 -31 -95 Q-53 -82 -56 -66Z', 'rgba(244,255,246,.44)');
    plate(ctx, 'M-58 -69 Q-56 -84 -39 -91 M-30 -94 Q-3 -101 18 -97', null, '#edf8ee', 1.6);
    plate(ctx, 'M-38 -94 L-32 -81 Q0 -87 33 -81 L38 -94', null, '#62818b', 1.2);
    plate(ctx, 'M-20 -87 Q0 -90 18 -87', null, '#4c717d', 2.7);
    plate(ctx, 'M-66 -24 L-56 -18 L-52 13 L-32 37 L-34 48 L-55 32 Q-68 18 -66 -24Z M66 -24 L56 -18 L52 13 L32 37 L34 48 L55 32 Q68 18 66 -24Z', '#476d7d', '#9bbac0');
    plate(ctx, 'M-60 5 L-55 18 L-47 26 M60 5 L55 18 L47 26', null, '#9ef7f5', 1.7);
    for (const side of [-1,1]) {
      oval(ctx, side * 53, 13, 2.7, 2.7, joint, '#a2b8bc', .8);
      oval(ctx, side * 56, -68, 2, 2, '#395e69');
    }
  });
  layer(13, true, () => {
    plate(ctx, 'M-62 -57 Q-39 -71 0 -68 Q41 -70 60 -58 Q67 -51 65 -36 L60 -12 Q57 -3 44 -1 L20 -1 L10 -6 H-10 L-20 -1 H-43 Q-57 -2 -60 -13 L-65 -40 Q-67 -49 -62 -57Z', joint, '#add2d6', 1.6);
    plate(ctx, 'M-58 -52 Q-35 -64 0 -62 Q37 -64 56 -53 Q62 -48 60 -39 L55 -17 Q53 -9 43 -8 H22 L12 -13 H-12 L-22 -8 H-43 Q-52 -9 -55 -17 L-60 -40 Q-62 -47 -58 -52Z', glass, '#426270');
    plate(ctx, 'M-58 -52 Q-33 -63 -9 -62 L-42 -11 Q-50 -11 -54 -19 L-59 -39 Q-61 -48 -58 -52Z', 'rgba(143,225,229,.055)');
    plate(ctx, 'M-51 -49 Q-29 -59 4 -57 M39 -56 L48 -54', null, '#589098', 1.1);
    optics(ctx,-27,-34,blink,gaze,10.8);
    optics(ctx,27,-34,blink,gaze,10.8);
    plate(ctx, 'M-4 -35 H4', null, '#699ba3', 1.4);
    plate(ctx, 'M-43 14 L-28 6 Q0 12 28 6 L43 14 L33 37 L19 48 H-19 L-33 37Z', shell, '#c0d9d9');
    plate(ctx, 'M-30 16 Q0 12 30 16 L25 31 Q0 38 -25 31Z', joint, '#527783');
    // The upper rail stays fixed while the hinged lower rail and chin follow the voice.
    const jawDrop = openness * 10;
    ctx.beginPath();
    ctx.moveTo(-24, 18);
    ctx.lineTo(-18, 16);
    ctx.lineTo(18, 16);
    ctx.lineTo(24, 18);
    ctx.lineTo(18, 21 + jawDrop);
    ctx.lineTo(-18, 21 + jawDrop);
    ctx.closePath();
    ctx.fillStyle = '#070f17';
    ctx.fill();
    plate(ctx, 'M-23 18 L-17 17 H17 L23 18', null, '#94e1e4', 1.35);
    ctx.save();
    ctx.translate(0, jawDrop);
    plate(ctx, 'M-22 20 L-17 21 H17 L22 20 L17 24 H-17Z', '#387480', '#79bec7', .9);
    ctx.translate(0, -jawDrop * .58);
    plate(ctx, 'M-15 41 H15', null, '#527683', 1.4);
    ctx.restore();
    plate(ctx, 'M-10 -77 Q0 -78 10 -77', null, '#ffbd76', 2.7);
  });
}

function drawAndroid(ctx, layer, blink, gaze, openness) {
  const dark = '#292d46';
  const seam = '#697084';
  const pearl = finish(ctx, -43,-61,51,42, [[0,'#fff4e5'], [.24,'#e3d7d4'], [.51,'#c2b4c1'], [.77,'#9b92aa'], [1,'#686e8c']]);
  const hair = finish(ctx, -70,-95,45,29, [[0,'#e8e6ff'], [.19,'#aaa8dc'], [.43,'#65699b'], [.76,'#3a4568'], [1,'#1b2e45']]);
  const collar = finish(ctx, -65,71,71,127, [[0,'#a6a1c3'], [.4,'#535a7d'], [.75,'#313f60'], [1,'#8391b0']]);

  layer(-18, false, () => {
    plate(ctx, 'M-91 116 Q-90 98 -65 90 L-33 80 Q-18 72 -21 44 H21 Q17 74 32 81 L64 91 Q87 97 91 116 Q64 133 0 136 Q-62 134 -91 116Z', collar, '#bcbad6');
    plate(ctx, 'M-23 41 L-5 52 L21 36 L19 72 L28 81 Q14 98 0 107 Q-19 96 -28 82 L-20 71Z', pearl, seam);
    plate(ctx, 'M-15 65 L-10 74 L3 84 L14 78 M-16 74 L0 91 L9 88', null, seam, 1.2);
    plate(ctx, 'M-89 116 Q-84 101 -61 94 L-34 83 L-19 101 L-41 104 L-59 124Z M89 116 Q84 101 61 94 L34 83 L19 101 L41 104 L59 124Z', hair, '#afb4cd');
    plate(ctx, 'M-47 92 Q-22 112 0 126 Q24 112 47 92 M-81 113 L-61 104 M81 113 L61 104', null, '#9ae9e7', 1.1);
  });
  layer(-20, true, () => {
    plate(ctx, 'M-63 9 Q-79 -30 -65 -72 Q-54 -110 -14 -109 Q35 -116 58 -84 Q82 -53 68 -3 Q65 17 75 39 Q69 43 60 36 Q64 59 72 67 Q45 61 36 33 L-39 35 Q-47 58 -71 68 Q-60 49 -62 34 L-77 44 Q-67 26 -63 9Z', hair, '#a8aecf', 1.4);
    plate(ctx, 'M-62 8 Q-58 42 -68 57 M60 -7 Q54 33 65 51', null, '#9f9cca', 2);
  });
  layer(3, true, () => {
    plate(ctx, 'M-48 -62 Q-28 -96 6 -89 Q43 -90 56 -62 L52 -5 Q49 16 40 28 L22 46 Q12 56 2 58 Q-8 58 -17 50 L-37 34 Q-49 21 -54 -4 L-56 -32Z', pearl, '#e1d4df', 1.3);
    plate(ctx, 'M40 -66 Q52 -54 53 -33 L51 -4 Q49 16 39 28 L22 46 Q12 57 2 58 Q13 53 21 42 L33 25 Q39 17 38 11 L45 -1 L46 -29Z', 'rgba(62,58,93,.22)');
    plate(ctx, 'M-46 -7 Q-43 4 -31 7 L-21 8 L-33 3Z', 'rgba(255,243,229,.35)');
    plate(ctx, 'M42 -9 L28 0 L19 5 L33 3Z', 'rgba(255,240,231,.24)');
    plate(ctx, 'M-48 -8 Q-45 15 -34 26 L-22 35 L-25 39 M48 -9 Q45 15 36 24 L25 33 L28 37', null, seam, 1);
    plate(ctx, 'M-47 0 L-40 11 L-36 12 M47 0 L40 11 L36 12', null, '#e9f9fb', 1.6);
    plate(ctx, 'M-18 48 Q2 60 22 45 Q9 58 2 58 Q-7 58 -18 48Z', '#9090aa');
  });
  layer(9, true, () => {
    for (const side of [-1,1]) {
      ctx.save();
      ctx.scale(side,1);
      // Curved brow and a clipped iris preserve the almond-shaped optical aperture.
      plate(ctx, 'M10 -33 Q23 -46 42 -39 L43 -37 Q25 -39 13 -31Z', dark);
      ctx.save();
      ctx.translate(0,-22);
      ctx.scale(1,blink);
      const eye = 'M11 1 Q25 -12 42 -6 Q31 8 20 6 Q15 5 11 1Z';
      plate(ctx, eye, '#d0f5f2', dark, 1.2);
      ctx.clip(contours.get(eye));
      oval(ctx, 27 + gaze * side,-1,6,6,'#67d4d7','#536176',1);
      oval(ctx, 27 + gaze * side,-1,3,3,'#28334c');
      oval(ctx, 25 + gaze * side,-3,1.5,1.5,'#f9ffff');
      ctx.restore();
      ctx.save();
      ctx.translate(0,-22);
      ctx.scale(1,blink);
      plate(ctx, 'M10 1 Q25 -12 40 -7 L46 -10 L42 -5 Q26 -10 11 2Z', dark);
      ctx.restore();
      ctx.restore();
    }
    plate(ctx, 'M5 -23 Q6 -11 9 2 Q10 6 5 8 L0 9 L3 5Z', 'rgba(98,80,111,.20)');
    plate(ctx, 'M2 -20 Q2 -3 -5 4 Q-5 8 1 9 L8 6', null, '#958b9a', 1.25);
    plate(ctx, 'M4 -12 Q4 -1 1 3', null, '#fff0e6', 1.1);
    ctx.save();
    ctx.translate(1,24);
    ctx.scale(1,.15 + openness * 1.45);
    plate(ctx, 'M-16 0 Q-9 -2 0 -2 Q10 -2 16 0 Q8 8 0 8 Q-8 8 -16 0Z', dark);
    ctx.restore();
    plate(ctx, 'M-16 24 Q-8 21 -4 19 Q-1 19 1 21 Q4 18 8 20 L17 24 Q9 24 2 23 Q-7 23 -16 24Z', '#98798b');
    ctx.save();
    ctx.translate(0,openness * 9);
    plate(ctx, 'M-15 25 Q1 28 16 25 Q8 32 1 32 Q-7 31 -15 25Z', '#ab8296');
    plate(ctx, 'M-6 29 Q1 31 7 29', null, '#ecc1cc', 1);
    ctx.restore();
  });
  layer(15, true, () => {
    plate(ctx, 'M-54 -10 Q-70 -26 -66 -58 Q-65 -95 -42 -105 Q-20 -117 2 -111 Q26 -121 49 -104 Q70 -91 67 -53 Q67 -30 54 -9 Q59 -36 47 -58 Q35 -74 22 -80 Q8 -61 -14 -53 Q-45 -44 -54 -10Z', hair, '#d4cced', 1.3);
    plate(ctx, 'M-59 -32 Q-59 -64 -28 -79 Q1 -94 9 -109 M-62 -48 Q-62 -75 -40 -91 M-48 -53 Q-38 -68 -16 -77 Q5 -86 15 -101 M30 -102 Q56 -96 62 -64', null, '#a2a2cc', 1.2);
    plate(ctx, 'M-51 -32 Q-44 -47 -18 -57 Q10 -69 22 -85 Q41 -79 49 -61', null, '#d4cfe9', 1.8);
    for (const side of [-1,1]) {
      oval(ctx, side * 54, -4, 6, 9, '#454e6c', '#bcc2df', 1.3);
      oval(ctx, side * 54, -4, 2.2, 4.3, '#8cf4ee');
    }
    plate(ctx, 'M-54 6 L-54 18 M54 6 L54 18', null, '#96d6df', 1.4);
  });
}

function drawRobot(ctx, size, time, level, feminine, state) {
  ctx.save();
  ctx.scale(size,size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const accent = feminine ? '184,173,255' : '104,231,238';
  const color = opacity => `rgba(${accent},${opacity})`;
  const yaw = (feminine ? -.12 : .15) + Math.sin(time * .53) * .14;
  const pitch = -.045 + Math.sin(time * .77) * .035;
  const roll = Math.sin(time * .68) * .018;
  const drift = Math.sin(time * .97) * 1.9;
  // A plane at depth z is foreshortened and displaced around the head pivot.
  function layer(z, head, paint) {
    const angle = head ? yaw : yaw * .32;
    const tilt = head ? pitch : pitch * .2;
    const depth = 520 / (520 - z * Math.cos(angle));
    ctx.save();
    ctx.translate(Math.sin(angle) * z * depth, drift - Math.sin(tilt) * z * depth);
    ctx.rotate(head ? roll : roll * .2);
    ctx.scale(Math.cos(angle) * depth, Math.cos(tilt) * depth);
    paint();
    ctx.restore();
  }

  const cadence = time % 5.6;
  const blink = 1 - .94 * Math.max(0,1 - Math.abs(cadence - 4.8) / .12);
  const gaze = Math.sin(time * .85) * (state === 'processing' ? 2.8 : 1.2);
  const openness = Math.min(1, Math.max(0, (level - .035) * 1.45));
  if (feminine) drawAndroid(ctx,layer,blink,gaze,openness);
  else drawEngineer(ctx,layer,blink,gaze,openness);

  // Fine scan lines stay on the rendered bust, fading it into the projector at its base.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color(.06);
  for (let y = -122; y < 136; y += 3) ctx.fillRect(-110,y,220,.55);
  const fade = finish(ctx,0,110,0,137,[[0,'rgba(10,22,32,0)'],[1,'rgba(10,22,32,.84)']]);
  ctx.fillStyle = fade;
  ctx.fillRect(-110,110,220,28);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  const field = ctx.createRadialGradient(0,-22,20,0,-9,133);
  field.addColorStop(0,color(.18));
  field.addColorStop(1,color(0));
  oval(ctx,0,-9,133,133,field);
  oval(ctx,0,-20,96,96,null,color(.14),.65);
  for (let i = 0; i < 60; i++) {
    const angle = i * Math.PI / 30;
    const length = i % 5 === 0 ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(100 * Math.cos(angle), -20 + 100 * Math.sin(angle));
    ctx.lineTo((100 + length) * Math.cos(angle), -20 + (100 + length) * Math.sin(angle));
    ctx.strokeStyle = color(i % 5 === 0 ? .42 : .23);
    ctx.lineWidth = .75;
    ctx.stroke();
  }
  ctx.restore();
  oval(ctx,0,137,69,5.3,null,color(.55),1.1);
  oval(ctx,0,138,86,8,null,color(.22),.85);
  oval(ctx,0,137,38,2.4,color(.16));
  ctx.restore();
}
