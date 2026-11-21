const MAX_RECORDING_MS = 180_000;
const SILENCE_MS = 2_600;
const MIN_VOICE_MS = 260;
const MIN_LEVEL = .075;

export async function openCapture({Recognition, handsFree, meter, onFinish, onError}) {
  const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true}});
  meter.microphone(stream);
  let finished = false;
  let reason;
  let stopEngine;
  let timer;
  let restart;
  let watchdog;
  let voicedMs = 0;
  let hasWords = false;
  let lastVoice = performance.now();
  const started = lastVoice;

  function release() {
    if (finished) return false;
    finished = true;
    clearInterval(timer);
    clearTimeout(restart);
    clearTimeout(watchdog);
    meter.clear();
    stream.getTracks().forEach(track => track.stop());
    return true;
  }

  function finish(value) {
    if (release()) onFinish(reason === 'send' || reason === 'review' ? value : null, reason);
  }

  function fail(error) {
    if (release()) onError(error);
  }

  function stop(action = 'send') {
    if (finished) return;
    if (reason) {
      if (action === 'discard') reason = action;
      return;
    }
    reason = action;
    try {
      stopEngine();
    } catch (error) {
      fail(error);
    }
  }

  try {
    if (Recognition) {
      const batches = [];
      let results = '';
      let interim = '';
      let engine;
      const track = stream.getAudioTracks()[0];

      function complete() {
        finish([...batches, results, interim].filter(Boolean).join(' '));
      }

      function start() {
        if (finished) return;
        results = interim = '';
        const current = new Recognition();
        engine = current;
        current.lang = 'pt-BR';
        current.processLocally = true;
        current.continuous = true;
        current.interimResults = true;
        current.onresult = (event) => {
          if (finished || engine !== current) return;
          const confirmed = [];
          const pending = [];
          for (const result of Array.from(event.results)) {
            (result.isFinal ? confirmed : pending).push(result[0].transcript.trim());
          }
          results = confirmed.filter(Boolean).join(' ');
          interim = pending.filter(Boolean).join(' ');
          if (results || interim) {
            hasWords = true;
            lastVoice = performance.now();
          }
        };
        current.onerror = ({error}) => {
          if (finished || engine !== current || error === 'no-speech' || reason) return;
          if (batches.length || results || interim) {
            reason = 'review';
            complete();
            return;
          }
          const denied = error === 'not-allowed' || error === 'service-not-allowed';
          fail(new Error(denied
            ? 'Permita o acesso ao microfone nas configurações do site ou digite.'
            : 'O navegador interrompeu o reconhecimento. Tente novamente ou use a ponte local.'));
        };
        current.onend = () => {
          if (finished || engine !== current) return;
          engine = undefined;
          if (reason) {
            complete();
            return;
          }
          const text = [results, interim].filter(Boolean).join(' ');
          if (text) batches.push(text);
          results = interim = '';
          restart = setTimeout(() => {
            try { start(); } catch (error) {
              if (!batches.length) fail(error);
              else { reason = 'review'; complete(); }
            }
          }, 180);
        };
        current.start(track);
      }

      stopEngine = () => {
        clearTimeout(restart);
        if (!engine) { complete(); return; }
        watchdog = setTimeout(complete, 2500);
        engine.stop();
      };
      start();
    } else {
      const recorder = new MediaRecorder(stream, {audioBitsPerSecond:96_000});
      const chunks = [];
      recorder.ondataavailable = ({data}) => { if (data.size) chunks.push(data); };
      recorder.onerror = (event) => fail(event.error || new Error('A gravação falhou.'));
      recorder.onstop = () => {
        // A perda do microfone encerra o trecho já gravado.
        reason ||= 'review';
        const mime = (recorder.mimeType || chunks[0]?.type || 'audio/webm').split(';')[0];
        finish(new Blob(chunks, {type:mime}));
      };
      stopEngine = () => recorder.stop();
      recorder.start(1000);
    }

    let previous = started;
    timer = setInterval(() => {
      if (finished || reason) return;
      const now = performance.now();
      if (handsFree) {
        if ((meter.read()?.level || 0) >= MIN_LEVEL) {
          voicedMs += Math.min(now - previous, 100);
          lastVoice = now;
        }
        if ((hasWords || voicedMs >= MIN_VOICE_MS) && now - lastVoice >= SILENCE_MS) stop();
      }
      if (now - started >= MAX_RECORDING_MS) {
        stop(handsFree && !hasWords && voicedMs < MIN_VOICE_MS ? 'quiet' : 'send');
      }
      previous = now;
    }, 100);
    return {stop};
  } catch (error) {
    release();
    throw error;
  }
}
