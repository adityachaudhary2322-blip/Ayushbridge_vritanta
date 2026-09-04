// Shared Sarvam AI utilities — used by PatientIntake and VideoConsult

export function detectMode(text) {
  if (!text) return 'english';
  if (/[ऀ-ॿ]/.test(text)) return 'devanagari';
  if (/\b(mujhe|mere|mera|meri|hai|hain|kya|nahi|nahin|aur|dard|bukhar|pet|sar|sir|taklif|bimari|dawai|khana|pani|bahut|thoda|achha|theek|zyada|jyada|kam|roz|din|raat|subah|shaam|apna|kuch|sab|bura|tez|neend|bolna|sunna)\b/i.test(text)) return 'hinglish';
  return 'english';
}

// Sarvam Bulbul v3 TTS — resolves when audio finishes (or fallback timeout).
// A genuine network/backend failure calls onNetworkError; a browser autoplay
// block is NOT treated as an error (it just resolves quietly).
export async function sarvamTTS(text, lang, { onNetworkError } = {}) {
  if (!text?.trim()) return;
  let data;
  try {
    const res = await fetch('/api/sarvam-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 1500), lang: lang === 'hi' ? 'hi' : 'en' }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    data = await res.json();
    if (!data.success || !data.audio) throw new Error('No audio in response');
  } catch (err) {
    // Network / backend failure — surface to caller, do not block the flow
    console.error('[sarvamTTS] network:', err.message);
    onNetworkError?.(err);
    return;
  }
  // Playback is decoupled from the fetch: an autoplay block must never read as an error
  await new Promise((resolve) => {
    const audio = new Audio(data.audio);
    const fallback = setTimeout(resolve, Math.max(3000, text.length * 58 + 800));
    audio.onended = () => { clearTimeout(fallback); resolve(); };
    audio.onerror = () => { clearTimeout(fallback); resolve(); };
    audio.play().catch((playErr) => {
      console.warn('[sarvamTTS] autoplay deferred until user interaction:', playErr?.message);
      clearTimeout(fallback);
      resolve();
    });
  });
}

// Sarvam Saaras v3 STT — records via MediaRecorder, transcribes via backend
export async function recordAndTranscribe({ onResult, onError, onStart, onStop, maxMs = 6000 }) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      onStop?.();
      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      if (blob.size < 400) { onError?.('empty'); return; }
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      try {
        const res = await fetch('/api/sarvam-stt', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
        const data = await res.json();
        if (data.transcript?.trim()) {
          onResult(data.transcript.trim());
        } else {
          onError?.('no-transcript');
        }
      } catch (err) {
        console.warn('[sarvamSTT]', err.message);
        onError?.('network');
      }
    };

    onStart?.();
    rec.start(250);
    setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, maxMs);
    return rec;
  } catch (err) {
    onError?.(err.name === 'NotAllowedError' ? 'not-allowed' : 'start-failed');
    return null;
  }
}

// Hands-free recorder: auto-stops after `silenceMs` of quiet once speech is
// detected (or at `maxMs` hard cap). Returns the MediaRecorder so the caller can
// stop it early on a manual tap. Transcribes via /api/sarvam-stt.
export async function recordUntilSilence({ onResult, onError, onStart, onStop, silenceMs = 3000, maxMs = 12000 }) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    // Voice-activity detection via Web Audio RMS
    let audioCtx, analyser, rafId;
    let hasSpoken = false;
    let lastSpeech = 0; // set to performance.now() once VAD starts
    const startedAt = performance.now();
    const SPEAK_THRESHOLD = 0.018;

    const cleanupVad = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      lastSpeech = performance.now();

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (rms > SPEAK_THRESHOLD) { hasSpoken = true; lastSpeech = now; }
        const silentFor = now - lastSpeech;
        if ((hasSpoken && silentFor > silenceMs) || (now - startedAt > maxMs)) {
          if (rec.state === 'recording') rec.stop();
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } catch {
      // VAD unavailable → fall back to hard maxMs stop only
      setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, maxMs);
    }

    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    rec.onstop = async () => {
      cleanupVad();
      stream.getTracks().forEach(t => t.stop());
      onStop?.();
      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      if (blob.size < 500) { onError?.('empty'); return; }
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      try {
        const res = await fetch('/api/sarvam-stt', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
        const data = await res.json();
        if (data.transcript?.trim()) onResult(data.transcript.trim());
        else onError?.('no-transcript');
      } catch (err) {
        console.warn('[recordUntilSilence] stt:', err.message);
        onError?.('network');
      }
    };

    onStart?.();
    rec.start(250);
    return rec;
  } catch (err) {
    onError?.(err.name === 'NotAllowedError' ? 'not-allowed' : 'start-failed');
    return null;
  }
}

// Parse conversation slots for display chips
export function extractSlots(messages) {
  const userText = messages.filter(m => m.role === 'user').map(m => m.text).join(' ');
  const slots = {};

  const nameM = userText.match(/(?:name is|naam|I am|mera naam|main|namaskar main)\s+([A-Za-zऀ-ॿ]{2,20})/i);
  if (nameM) slots.name = nameM[1];

  const ageM = userText.match(/(\d{1,3})\s*(?:saal|year|years|sal|yr)\b/i)
    || userText.match(/\bam\s+(\d{1,3})\b/i);
  if (ageM) slots.age = `${ageM[1]} yr`;

  const durM = userText.match(/(\d+)\s*(din|day|days|week|weeks|month|months|mahine|hafte|ghante)/i);
  if (durM) slots.duration = `${durM[1]} ${durM[2]}`;

  const symptomMap = [
    [/bukhar|fever|bukhaar/i, 'Fever'],
    [/dard|pain|ache|drd/i, 'Pain'],
    [/khansi|cough|khaansi/i, 'Cough'],
    [/ulti|vomit|nausea|matli|ulati/i, 'Nausea'],
    [/dast|diarrhea|loose\s*motion/i, 'Diarrhea'],
    [/sar\s*dard|headache|sir\s*dard/i, 'Headache'],
    [/pet\s*dard|stomach|abdomen/i, 'Abdominal'],
    [/chakkar|dizzy|vertigo/i, 'Dizziness'],
    [/kamzori|weakness|fatigue|thakaan/i, 'Fatigue'],
    [/neend\s*nahi|insomnia|sleep/i, 'Insomnia'],
  ];
  const found = symptomMap.filter(([rx]) => rx.test(userText)).map(([, l]) => l);
  if (found.length) slots.symptoms = found.slice(0, 3).join(', ');

  return slots;
}
