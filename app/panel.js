import {animate} from './hologram.js';
import {articulationFor} from './face-speech.js';
import {openCapture} from './capture.js';
import {createVoiceMeter} from './voice-meter.js';

const $ = (id) => document.getElementById(id);
const form = document.querySelector('form');
const bridge = location.hostname === '127.0.0.1' && document.documentElement.dataset.bridge === 'yes';
const autoSend = $('auto-send');
const voiceChoice = $('voice-choice');
const briefing = 'Neste briefing de exemplo, você tem cinco mensagens simuladas e uma reunião às dez. O painel está pronto para receber seu próximo pedido.';
const demoReply = 'Recebi seu pedido. Você está no modo de demonstração. Abra o painel pela ponte local para receber uma resposta do seu assistente.';
const presetVoices = {
  faber: {label:'Faber', briefing:'briefing.mp3', reply:'resposta-faber.mp3'},
  edresson: {label:'Edresson', briefing:'briefing-edresson.mp3', reply:'resposta-edresson.mp3'},
};
const piperVoices = JSON.parse(document.documentElement.dataset.voices || '[]');

function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function savePreference(key, value) {
  try { localStorage.setItem(key, value); } catch { /* A escolha vale nesta aba. */ }
}

autoSend.checked = readPreference('painel-de-voz-auto-send') === 'true';
autoSend.addEventListener('change', () => savePreference('painel-de-voz-auto-send', String(autoSend.checked)));
const voiceKey = 'painel-de-voz-voice';

function browserVoices() {
  return (window.speechSynthesis?.getVoices() || [])
    .filter(item => item.localService && /^pt\b/i.test(item.lang));
}

function loadVoices() {
  const preferred = readPreference(voiceKey) || voiceChoice.value;
  const options = bridge
    ? piperVoices.map(id => {
      const [, name] = /^pt_BR-(.+?)-(?:x_low|low|medium|high)$/.exec(id) || [];
      const label = name ? name[0].toUpperCase() + name.slice(1) : id;
      return [id, label];
    })
    : Object.entries(presetVoices).map(([id, item]) => [id, item.label + ' · demonstração']);
  for (const option of options) {
    if (options.some(other => other !== option && other[1] === option[1])) option[1] = option[0];
  }
  for (const item of browserVoices()) options.push(['browser:' + item.voiceURI, item.name + ' · neste dispositivo']);
  if (!options.length) options.push(['default', 'Padrão do dispositivo']);
  voiceChoice.replaceChildren(...options.map(([id, label]) => new Option(label, id)));
  if (options.some(([id]) => id === preferred)) voiceChoice.value = preferred;
}

loadVoices();
window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
voiceChoice.addEventListener('change', () => savePreference(voiceKey, voiceChoice.value));

const status = {idle:'Pronto', recording:'Gravando', processing:'Processando', speaking:'Falando', error:'Atenção'};
const session = crypto.randomUUID();
const speechLanguage = {langs:['pt-BR'], processLocally:true};
let state = 'idle';
const meter = createVoiceMeter();
let voice = false;
let capture;
let capturePending = false;
let captureMode = '';
let cancelPending = false;
let listening = false;
let awaitingReview = false;
let nextListen;

let audio;
let playbackUrl;
let articulate;
let speechGeneration = 0;
const redraw = animate(() => {
  const visual = $('visual').value;
  const signal = meter.read();
  const articulation = visual === 'human' && state === 'speaking' && signal?.origin === 'playback'
    ? articulate?.(audio.currentTime / audio.duration, signal.level) : null;
  return {state, visual, signal, articulation};
});

function update(next, hint = '') {
  state = next;
  document.body.dataset.state = next;
  $('state').textContent = status[next];
  $('hint').textContent = hint || 'Microfone fechado.';
  const busy = next === 'processing' || next === 'recording';
  $('example').disabled = busy;
  $('send').disabled = busy;
  $('mic').disabled = next === 'processing';
  $('voice-preview').disabled = busy;
  voiceChoice.disabled = next === 'recording';
  $('language').disabled = busy;
  autoSend.disabled = busy;
  $('mic').setAttribute('aria-pressed', String(next === 'recording'));
  $('mic').textContent = next === 'recording' ? 'Parar e transcrever' : 'Gravar pergunta';
  redraw?.();
  clearTimeout(nextListen);
  if (next === 'idle' && listening && !awaitingReview) {
    nextListen = setTimeout(() => void startCapture(true), 220);
  }
}

$('visual').addEventListener('change', () => redraw?.());

function stopPlayback() {
  speechGeneration++;
  window.speechSynthesis?.cancel();
  if (audio) {
    meter.clear();
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  playbackUrl = undefined;
  audio = undefined;
  articulate = undefined;
}

function setVoice(enabled) {
  voice = enabled;
  if (enabled) meter.unlock();
  $('voice').setAttribute('aria-pressed', String(enabled));
  $('voice').textContent = enabled ? 'Desligar som' : 'Ligar som';
}

$('voice').addEventListener('click', () => {
  setVoice(!voice);
  if (!voice) {
    stopPlayback();
    if (state === 'speaking') update('idle');
  }
});

function addMessage(role, text) {
  $('log').querySelector('.empty')?.remove();
  const row = document.createElement('article');
  const who = document.createElement('strong');
  const message = document.createElement('p');
  row.className = 'message';
  row.dataset.role = role;
  who.textContent = role === 'user' ? 'Você' : 'Assistente';
  message.textContent = text;
  row.append(who,message);
  $('log').append(row);
  if ($('log').children.length > 60) $('log').firstElementChild.remove();
  $('log').scrollTop = $('log').scrollHeight;
}

async function endpoint(path, body, type = 'application/json', timeout = 95000) {
  const response = await fetch(path, {method:'POST', body, headers:{'Content-Type':type}, signal:AbortSignal.timeout(timeout)});
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.error || 'A ponte local não respondeu. Confira o terminal.');
  }
  return response;
}

async function speak(text, sample) {
  if (!voice) { update('idle'); return; }
  const generation = ++speechGeneration;
  const done = () => { if (generation === speechGeneration && state === 'speaking') update('idle'); };
  try {
    const selected = voiceChoice.value;
    const browserVoice = browserVoices().find(item => selected === 'browser:' + item.voiceURI);
    const piperVoice = piperVoices.includes(selected);
    const preset = presetVoices[selected];
    const demoFile = preset
      ? (sample ? preset.briefing : preset.reply)
      : sample && !piperVoice && !browserVoice ? presetVoices.faber.briefing : null;
    if (piperVoice || demoFile) {
      if (piperVoice) {
        update('speaking', 'Preparando a voz local…');
        const response = await endpoint('/speak', JSON.stringify({text, voice:selected}), 'application/json', 35000);
        const blob = await response.blob();
        if (generation !== speechGeneration) return;
        playbackUrl = URL.createObjectURL(blob);
      }
      if (generation !== speechGeneration) return;
      audio = new Audio(demoFile || playbackUrl);
      articulate = articulationFor(text.slice(0,3000));
      meter.playback(audio);
      audio.onended = () => { stopPlayback(); if (state === 'speaking') update('idle'); };
      audio.onerror = () => {
        if (generation === speechGeneration) {
          stopPlayback();
          update('idle', 'O áudio falhou. A resposta está na conversa.');
        }
      };
      update('speaking');
      await audio.play();
      return;
    }
    const localVoice = browserVoice || browserVoices()[0];
    if (!localVoice) throw new Error('Instale uma voz local ou configure uma voz Piper na ponte.');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = localVoice;
    utterance.onend = done;
    utterance.onerror = () => { if (generation === speechGeneration) update('idle', 'A voz local falhou. A resposta está na conversa.'); };
    update('speaking');
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    if (generation === speechGeneration) {
      stopPlayback();
      update('idle', error.message);
    }
  }
}

async function send(text, {sample = false, fromVoice = false} = {}) {
  if (!text.trim() || (!fromVoice && ['recording','processing'].includes(state))) return;
  awaitingReview = false;
  stopPlayback();
  addMessage('user', text);
  update('processing', 'Preparando a resposta…');
  try {
    const response = sample ? briefing : bridge
      ? (await (await endpoint('/chat', JSON.stringify({session, text}))).json()).reply
      : demoReply;
    addMessage('assistant', response);
    await speak(response, sample);
  } catch (error) {
    if (fromVoice && !$('message').value.trim()) $('message').value = text;
    showError(error.message);
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('message').value.trim();
  if (!text || text.length > 12000 || ['recording','processing'].includes(state)) return;
  $('message').value = '';
  void send(text);
});
$('example').addEventListener('click', () => void send('Me dê o briefing de exemplo.', {sample:true}));
$('voice-preview').addEventListener('click', () => {
  if (state === 'recording' || state === 'processing') return;
  stopPlayback();
  setVoice(true);
  void speak(briefing, true);
});

async function localRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition?.available || !('processLocally' in Recognition.prototype)) {
    throw new Error('Este navegador não oferece transcrição local. Digite ou abra pela ponte local.');
  }
  const ready = await Recognition.available(speechLanguage);
  $('language').hidden = ready !== 'downloadable' || typeof Recognition.install !== 'function';
  if (!$('language').hidden) throw new Error('Baixe o idioma para transcrever português no navegador.');
  if (ready === 'downloading') throw new Error('O navegador está baixando o idioma. Tente gravar em instantes.');
  if (ready !== 'available') {
    throw new Error('O idioma português local não está pronto neste navegador. Use a ponte local ou digite.');
  }
  return Recognition;
}

$('language').addEventListener('click', async () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  update('processing', 'Baixando o português para o reconhecimento local…');
  try {
    const installed = await Recognition.install(speechLanguage);
    if (!installed) throw new Error('O navegador não concluiu o download.');
    $('language').hidden = true;
    update('idle', 'Português instalado. Clique em Gravar pergunta.');
    $('mic').focus();
  } catch {
    update('error', 'O navegador não conseguiu instalar o idioma. Tente de novo, digite ou use a ponte local.');
  }
});

function setListening(enabled) {
  listening = enabled;
  $('listen').setAttribute('aria-pressed', String(enabled));
  $('listen').textContent = enabled ? 'Desligar escuta contínua' : 'Ligar escuta contínua';
  if (!enabled) clearTimeout(nextListen);
}

function showError(message) {
  setListening(false);
  update('error', message);
}

function putTranscript(text, handsFree, interrupted = false) {
  if (interrupted) setListening(false);
  const transcript = text.trim();
  if (!transcript) {
    if (handsFree && listening) update('idle', 'Nenhuma fala detectada. Voltando a ouvir…');
    else showError('Nenhuma fala detectada. Tente novamente.');
    return;
  }
  if (autoSend.checked && !interrupted && (!handsFree || listening) && transcript.length <= 12000) {
    void send(transcript, {fromVoice:true});
    return;
  }
  awaitingReview = listening;
  $('message').value = transcript;
  const hint = transcript.length > 12000
    ? 'O texto passou de 12.000 caracteres. Encurte antes de enviar.'
    : interrupted ? 'A captura foi interrompida. Revise a parte transcrita antes de enviar.'
    : awaitingReview ? 'Revise e envie para voltar à escuta.' : 'Revise a transcrição antes de enviar.';
  update('idle', hint);
  $('message').focus();
}

async function startCapture(handsFree) {
  if (capture || capturePending || (handsFree && (!listening || awaitingReview))) return;
  stopPlayback();
  meter.unlock();
  capturePending = true;
  captureMode = handsFree ? 'continuous' : 'manual';
  cancelPending = false;
  update('processing', 'Aguardando acesso ao microfone…');
  try {
    const Recognition = bridge ? null : await localRecognition();
    if (cancelPending) { update('idle'); return; }
    capture = await openCapture({
      Recognition, handsFree, meter,
      async onFinish(value, reason) {
        capture = null;
        captureMode = '';
        if (reason === 'quiet' || reason === 'discard') { update('idle'); return; }
        const interrupted = reason === 'review';
        if (typeof value === 'string') { putTranscript(value, handsFree, interrupted); return; }
        if (!value?.size) { putTranscript('', handsFree, interrupted); return; }
        update('processing', 'Transcrevendo o áudio no seu computador…');
        try {
          const response = await endpoint('/transcribe', value, value.type, 180_000);
          putTranscript((await response.json()).text, handsFree, interrupted);
        } catch (error) {
          showError(error.message);
        }
      },
      onError(error) {
        capture = null;
        captureMode = '';
        showError(error.message);
      },
    });
    if (cancelPending) { capture.stop('discard'); return; }
    update('recording', handsFree
      ? 'Escuta contínua ativa. Faça uma pausa para concluir o pedido.'
      : 'Fale e pressione de novo para encerrar. Até 3 minutos por pedido.');
  } catch (error) {
    captureMode = '';
    if (cancelPending) update('idle');
    else showError(error.name === 'NotAllowedError' ? 'Permita o acesso ao microfone ou digite sua pergunta.' : error.message);
  } finally {
    capturePending = false;
  }
}

$('mic').addEventListener('click', () => {
  if (capture) {
    $('mic').disabled = true;
    capture.stop();
  } else if (state !== 'processing') {
    void startCapture(listening);
  }
});

$('listen').addEventListener('click', () => {
  if (listening) {
    setListening(false);
    awaitingReview = false;
    if (captureMode === 'continuous') {
      cancelPending = true;
      capture?.stop('discard');
    }
    if (state === 'idle') update('idle', 'Escuta contínua desligada.');
    return;
  }
  setListening(true);
  awaitingReview = Boolean($('message').value.trim());
  if (awaitingReview && state === 'idle') {
    update('idle', 'Envie ou apague o rascunho para começar a escuta contínua.');
  } else if (state === 'idle' || state === 'error') void startCapture(true);
});

$('message').addEventListener('input', () => {
  if (listening && awaitingReview && !$('message').value.trim()) {
    awaitingReview = false;
    if (state === 'idle') update('idle', 'Voltando a ouvir…');
  }
});
if (bridge) $('mode').textContent = document.documentElement.dataset.agent;
