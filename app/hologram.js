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
    const {state, visual, signal} = getState();
    draw(width, height, scale, reduced.matches ? 0 : time / 1000, state, visual, reduced.matches ? null : signal);
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

function draw(w, h, scale, time, state, visual, signal) {
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
  ctx.fillStyle = light;
  ctx.fillRect(-w/2, -h/2, w, h);
  if (visual === 'wave') {
    drawWave(ctx, Math.min(w * .85, 620), Math.min(h * .39, 145), signal);
    return;
  }
  if (visual === 'robot' || visual === 'robot-f') {
    drawRobot(ctx, radius, time, level, visual === 'robot-f', state);
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

function drawRobot(ctx, radius, time, level, feminine, state) {
  const yaw = Math.sin(time * .78) * .14;
  const float = Math.sin(time * 1.25) * .034;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const tint = feminine ? '#b5b6ff' : '#93ecff';
  const edge = feminine ? '#707abd' : '#5396b0';
  const jaw = feminine ? .29 : .43;
  const forehead = feminine ? .55 : .63;
  const head = [
    [-forehead,-.56,.26], [-.42,-.84,.35], [.42,-.84,.35], [forehead,-.56,.26],
    [.62,.13,.30], [jaw,.62,.38], [.21,.75,.42], [-.21,.75,.42], [-jaw,.62,.38], [-.62,.13,.30],
  ];

  function project([x,y,z]) {
    const depth = z * cos - x * sin;
    const size = radius * (1 + depth * .13);
    return [(x * cos + z * sin) * size, (y + float) * size];
  }

  function shape(points, fill, stroke, lineWidth = 1, close = true) {
    ctx.beginPath();
    points.forEach((point, i) => {
      const [x,y] = project(point);
      if (i === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  ctx.save();
  ctx.lineWidth = 1;
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(142,233,246,${.17 + ring * .07 + level * .21})`;
    ctx.ellipse(0, radius * 1.04, radius * (.77 + ring * .15), radius * (.088 + ring * .045), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  shape([[-.25,.56,-.04],[.25,.56,-.04],[.31,.90,.05],[-.31,.90,.05]], '#152633', edge);
  for (const side of [-1,1]) {
    shape([
      [.56*side,-.39,.10], [.76*side,-.31,-.09], [.78*side,.11,-.09],
      [.66*side,.28,.11], [.56*side,.17,.30],
    ], '#193244', edge);
    shape([[.70*side,-.22,.14],[.70*side,.10,.14]], null, tint, 1.4, false);
  }

  const faceLight = ctx.createLinearGradient(-radius, -radius * .8, radius * .65, radius);
  faceLight.addColorStop(0, feminine ? '#314468' : '#254e62');
  faceLight.addColorStop(.52, '#11232e');
  faceLight.addColorStop(1, '#0e1b2d');
  shape(head, faceLight, tint, 1.6);
  if (feminine) {
    shape([head[0],[-.42,-.84,.35],[.04,-.88,.38],[-.15,-.60,.60],[-.50,-.33,.39]], '#34466d', edge);
    shape([[.04,-.88,.38],head[2],head[3],[.51,-.27,.40],[.28,-.57,.54]], '#2b3d62', edge);
  }
  shape([head[0],head[1],[-.28,-.59,.51],[.28,-.59,.51],head[2],head[3]], '#34526a', edge);
  shape([[-.29,-.53,.52],[0,-.62,.56],[.29,-.53,.52],[.40,-.15,.51],[0,-.06,.68],[-.40,-.15,.51]], '#172a3c', edge);
  for (const side of [-1,1]) {
    shape([
      [.25*side,-.45,.56], [.51*side,-.39,.38], [.48*side,-.13,.41], [.08*side,-.125,.67],
      [.12*side,-.30,.68],
    ], '#0c1927', edge);
    const blink = time && Math.sin(time * .68) > .994 ? .019 : .078;
    ctx.save();
    ctx.shadowColor = tint;
    ctx.shadowBlur = 11 + level * 17;
    shape([
      [.12*side,-.225,.69], [.45*side,feminine ? -.27 : -.295,.49],
      [.41*side,(feminine ? -.27 : -.295)+blink,.50], [.16*side,-.225+blink,.68],
    ], tint, null);
    ctx.restore();
    shape([
      [.54*side,-.07,.35], [.43*side,.26,.44], [.27*side,.39,.49], [.20*side,.27,.59],
      [.34*side,.08,.54],
    ], '#214052', edge);
  }
  shape([[-.07,-.20,.64],[.07,-.20,.64],[.12,.09,.64],[0,.14,.74],[-.12,.09,.64]], '#315063', edge);
  shape([[0,-.83,.39],[-.074,-.62,.57],[0,-.54,.59],[.074,-.62,.57]], tint, null);

  const mouthWidth = feminine ? .19 : .26;
  const mouthHeight = .024 + level * .19;
  shape([
    [-mouthWidth,.35,.59],[mouthWidth,.35,.59],
    [mouthWidth*.72,.40+mouthHeight,.59],[-mouthWidth*.72,.40+mouthHeight,.59],
  ], '#090f19', edge);
  for (let i = -3; i <= 3; i++) {
    const x = i * mouthWidth * .22;
    const height = mouthHeight * (1 - Math.abs(i) * .12);
    shape([[x,.39,.64],[x,.39+height,.64]], null, tint, 2, false);
  }
  shape([[-jaw,.62,.38],[-.22,.56,.54],[.22,.56,.54],[jaw,.62,.38],[.21,.75,.42],[-.21,.75,.42]], '#162d40', edge);
  shape([[-.12,.65,.49],[.12,.65,.49]], null, tint, 1, false);
  if (state === 'processing' && time) {
    const position = (time * .42) % 1;
    const y = -.71 + position * 1.32;
    shape([[-.42,y,.62],[.42,y,.62]], null, 'rgba(142,233,246,.38)', 1, false);
  }
}
