import {triangles, vertices} from './face-mesh.js';

const faceOutline = [356,389,251,284,332,297,338,10,109,67,103,54,21,162,127,234,93,132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361,323,454];
const lipUpper = [78,191,80,81,82,13,312,311,310,415,308];
const lipLower = [78,95,88,178,87,14,317,402,318,324,308];
const lipOutline = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
const leftEye = [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7];
const rightEye = [263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249];
const browLeft = [70,63,105,66,107];
const browRight = [336,296,334,293,300];
const model = vertices.slice();
const surfaces = triangles.map(indices => ({indices, part:'face'}));
const lipRig = new Map();
const eyeRig = new Map();
const stillMouth = {open:0,width:0,round:0};

for (let i = 0; i < lipUpper.length; i++) {
  const upper = lipUpper[i];
  const lower = lipLower[i];
  const centre = (vertices[upper][1] + vertices[lower][1]) / 2;
  const weight = Math.sin(i * Math.PI / (lipUpper.length - 1));
  lipRig.set(upper, {centre, offset:.21 * weight});
  if (lower !== upper) lipRig.set(lower, {centre, offset:-1.17 * weight});
}
for (const ring of [leftEye, rightEye]) {
  const centre = ring.reduce((acc, i) => acc + vertices[i][1], 0) / ring.length;
  for (const i of ring) eyeRig.set(i, centre);
}

function addRing(points) {
  return points.map(point => model.push(point) - 1);
}

function normal(a, b, c) {
  const u = b.map((x,i) => x - a[i]);
  const v = c.map((x,i) => x - a[i]);
  return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
}

function connectRings(front, back, part) {
  for (let i = 0; i < front.length; i++) {
    const next = (i + 1) % front.length;
    for (const ids of [[front[i],front[next],back[next]], [front[i],back[next],back[i]]]) {
      const [a,b,c] = ids.map(id => model[id]);
      const n = normal(a,b,c);
      // Orient the generated sides outward from the middle of the head or neck.
      const outward = [a[0]+b[0]+c[0], part === 'head' ? a[1]+b[1]+c[1]-3 : 0, a[2]+b[2]+c[2]+(part === 'neck' ? 2.4 : 4)];
      if (n.some(component => component !== 0) && n.reduce((sum,x,j) => sum + x*outward[j],0) < 0) ids.reverse();
      surfaces.push({indices:ids,part});
    }
  }
}

let lastRing = faceOutline;
for (const [scale, distance, lift] of [[1.015,.33,.44],[.90,.64,.68],[.62,.90,.78],[.29,1.03,.80]]) {
  const ring = addRing(faceOutline.map(i => {
    const [x,y,z] = vertices[i];
    return [x*scale, .9+(y-.9)*scale+lift, z*(1-distance)-7.8*distance];
  }));
  connectRings(lastRing, ring, 'head');
  lastRing = ring;
}
const occiput = model.push([0,1.7,-8.25]) - 1;
lastRing.forEach((i,j) => surfaces.push({indices:[i,lastRing[(j+1)%lastRing.length],occiput],part:'head'}));

let neck;
for (const [y,rx,rz] of [[-6.8,2.85,2.65],[-9.2,2.63,2.35],[-11.7,2.37,2.20],[-13.4,2.35,2.12]]) {
  const ring = addRing(Array.from({length:24}, (_,i) => {
    const angle = i*Math.PI/12;
    return [rx*Math.cos(angle),y,-.8+rz*Math.sin(angle)];
  }));
  if (neck) connectRings(neck,ring,'neck');
  neck = ring;
}

function path(ctx, points, close = true) {
  ctx.beginPath();
  points.forEach(([x,y], i) => {
    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  if (close) ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawFeatures(ctx, points, mouth, gaze) {
  const edge = (ring, color) => {
    path(ctx, ring.map(i => points[i]), false);
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  for (const [ring, pupil] of [[leftEye,159],[rightEye,386]]) {
    path(ctx, ring.map(i => points[i]));
    ctx.fillStyle = '#0b2735';
    ctx.fill();
    ctx.strokeStyle = '#72d6e6';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const [x,y] = points[pupil];
    const lower = points[pupil === 159 ? 145 : 374][1];
    const cy = (y+lower)/2;
    ctx.beginPath();
    ctx.arc(x+gaze,cy,Math.max(1,(lower-y)*.42),0,Math.PI*2);
    ctx.fillStyle = '#b5fbff';
    ctx.fill();
    ctx.restore();
  }
  edge(browLeft, 'rgba(166,236,243,.55)');
  edge(browRight, 'rgba(166,236,243,.55)');

  const upper = lipUpper.map(i => points[i]);
  const lower = lipLower.map(i => points[i]);
  if (mouth.open > .035) {
    path(ctx,[...upper,...lower.slice().reverse()]);
    ctx.fillStyle = '#123745';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // A short tinted highlight follows the upper lip inside the aperture.
    path(ctx,[...upper.slice(2,-2),...upper.slice(2,-2).reverse().map(([x,y]) => [x,y+2.1])]);
    ctx.fillStyle = '#8fd9e2';
    ctx.fill();
    ctx.restore();
  }
  edge(lipOutline.concat(lipOutline[0]), 'rgba(138,218,233,.52)');
  path(ctx,upper,false);
  ctx.strokeStyle = '#7edce9';
  ctx.stroke();
}

export function drawHumanHologram(ctx,w,h,time,state,level,articulation) {
  const unit = Math.min(w/22,h/24,23);
  const mouth = articulation || stillMouth;
  const yaw = (state === 'processing' ? -.32 : .12) + Math.sin(time*.62)*.23;
  const pitch = (state === 'processing' ? -.13 : -.035) + Math.sin(time*.84)*.042;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const blink = 1 - (time ? .94 * Math.max(0,1-Math.abs((time%5.3)-4.4)/.145) : 0);
  const scan = time ? ((time*.24)%1)*24-9 : -50;
  const posed = model.map(([bx,by,bz],i) => {
    let x = bx;
    let y = by;
    let z = bz;
    const lip = lipRig.get(i);
    if (lip) {
      y = lip.centre + lip.offset * mouth.open;
      x *= 1 + mouth.width;
      z += mouth.round*.32;
    } else if (i < vertices.length) {
      const jaw = Math.min(1,Math.max(0,(-y-3.7)/4.4));
      y -= jaw*mouth.open*.55;
      z -= jaw*mouth.open*.14;
      const eye = eyeRig.get(i);
      if (eye !== undefined) y = eye+(y-eye)*blink;
    }
    const rx = x*cy + z*sy;
    const rz = z*cy - x*sy;
    return [rx,y*cp-rz*sp,y*sp+rz*cp];
  });
  const points = posed.map(([x,y,z]) => {
    const perspective = 53/(53-z);
    return [x*unit*perspective, -(y+1.8)*unit*perspective];
  });
  const faces = [];
  for (const {indices,part} of surfaces) {
    const [a,b,c] = indices.map(i => posed[i]);
    const n = normal(a,b,c);
    const facing = n[2]*(53-a[2]) - n[0]*a[0] - n[1]*a[1];
    if (facing <= 0) continue;
    const length = Math.hypot(...n) || 1;
    const diffuse = Math.max(0,(-n[0]*.44+n[1]*.56+n[2]*.68)/length);
    const rim = Math.max(0,1-n[2]/length);
    const y = (a[1]+b[1]+c[1])/3;
    faces.push({indices,part,diffuse,rim,y,z:(a[2]+b[2]+c[2])/3});
  }
  faces.sort((a,b) => a.z-b.z);

  ctx.save();
  ctx.lineWidth = .85;
  const aura = ctx.createRadialGradient(0,-unit*1.1,unit,0,-unit,unit*10.4);
  aura.addColorStop(0,`rgba(59,199,232,${.14+level*.22})`);
  aura.addColorStop(1,'rgba(45,141,183,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(-unit*11,-unit*12,unit*22,unit*24);
  for (let ring=0;ring<3;ring++) {
    ellipse(ctx,0,unit*(10.95+ring*.15),unit*(4.2+ring*.75),unit*(.25+ring*.11),
      `rgba(127,229,247,${.32-ring*.07+level*.18})`);
  }

  for (const {indices,part,diffuse,rim,y} of faces) {
    const band = Math.exp(-((y-scan)**2)/.24);
    const fade = part === 'neck' ? Math.max(.05,Math.min(1,(y+13.5)/4.6)) : 1;
    const tint = diffuse*.78 + rim*.28 + band*.27;
    path(ctx,indices.map(i => points[i]));
    ctx.fillStyle = `rgba(${Math.round(14+62*tint)},${Math.round(43+114*tint)},${Math.round(56+130*tint)},${fade})`;
    ctx.fill();
    ctx.lineWidth = .55;
    ctx.strokeStyle = `rgba(168,242,255,${(.14+rim*.21+band*.33)*fade})`;
    ctx.stroke();
  }
  drawFeatures(ctx,points,mouth,Math.sin(time*.87)*1.6);
  ctx.restore();
}
