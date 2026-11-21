// Approximate articulation from Portuguese spelling. The level of the actual
// playback gates the opening, and the audio element supplies the time base.
const rest = {open:0, width:0, round:0};
const wide = {open:.40, width:.26, round:0};
const open = {open:1, width:.10, round:0};
const round = {open:.58, width:-.24, round:1};
const roundedClose = {open:.28, width:-.31, round:1};
const neutral = {open:.35, width:0, round:0};
const shapes = {a:open, e:wide, i:wide, o:round, u:roundedClose, m:rest, b:rest, p:rest};

export function articulationFor(text) {
  const units = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .match(/[a-z]+|[.,;:!?…]/g) || [];
  const cues = [];
  let duration = 0;
  for (const word of units) {
    if (!/^[a-z]/.test(word)) {
      duration += .5;
      cues.push({at:duration, shape:rest});
      continue;
    }
    for (const letter of word) {
      const length = /[aeiou]/.test(letter) ? 1 : .58;
      duration += length / 2;
      cues.push({at:duration, shape:shapes[letter] || neutral});
      duration += length / 2;
    }
    duration += .26;
  }

  return (position, level) => {
    if (!cues.length || !Number.isFinite(position) || position < 0 || position >= 1 || level <= .025) return rest;
    const time = position * duration;
    let left = 0;
    let right = cues.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (cues[mid].at < time) left = mid + 1;
      else right = mid;
    }
    const previous = cues[left-1] || {at:0, shape:rest};
    const next = cues[left] || {at:duration, shape:rest};
    const mix = (time - previous.at) / Math.max(.001, next.at - previous.at);
    const influence = Math.min(1, (level - .025) * 2.5);
    const blend = key => (previous.shape[key] + (next.shape[key] - previous.shape[key]) * mix) * influence;
    return {open:blend('open'), width:blend('width'), round:blend('round')};
  };
}
