export function createVoiceMeter() {
  let context;
  let source;
  let origin;
  let analyser;
  let samples;
  let level = 0;

  function clear() {
    source?.disconnect();
    analyser?.disconnect();
    source = analyser = samples = origin = undefined;
    level = 0;
  }

  function unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context ||= new AudioContext();
      if (context.state !== 'running') void context.resume().catch(() => {});
    } catch {
      // The panel still records and plays audio on browsers without Web Audio.
    }
  }

  function connect(input, channel) {
    source = input;
    origin = channel;
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    samples = new Float32Array(analyser.fftSize);
    source.connect(analyser);
  }

  function microphone(stream) {
    clear();
    if (!context) return;
    try {
      connect(context.createMediaStreamSource(stream), 'microphone');
    } catch {
      clear();
    }
  }

  function playback(element) {
    clear();
    if (context?.state !== 'running') return;
    try {
      connect(context.createMediaElementSource(element), 'playback');
      analyser.connect(context.destination);
    } catch {
      clear();
    }
  }

  function read() {
    if (!analyser) return null;
    analyser.getFloatTimeDomainData(samples);
    let power = 0;
    for (const sample of samples) power += sample * sample;
    const target = Math.min(1, Math.max(0, (Math.sqrt(power / samples.length) - .007) * 5));
    level += (target - level) * (target > level ? .56 : .20);
    return {samples, level, origin};
  }

  return {clear, unlock, microphone, playback, read};
}
