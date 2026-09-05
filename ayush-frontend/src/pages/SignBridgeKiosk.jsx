import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  SignVision, HAND_SHAPES, shapeLabel, createSmoother, drawHand, clearCanvas,
} from '../utils/signVision';

// ─────────────────────────────────────────────────────────────────────────────
// SignBridge Kiosk — visual-first triage wizard for Divyang Jan patients.
//
// Deaf and mute patients read the screen, so this page is deliberately silent:
// no speech synthesis, no audio cues. Every prompt is large, bilingual and
// high-contrast, and every gesture answer has an equally large tap fallback.
//
// Isolated by design — it reuses /api/upload-mobile and /api/triage but never
// touches the stable TouchlessKiosk or TeleConsultRoom flows.
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = ['complaint', 'nidra', 'agni', 'details', 'summary'];

const STEP_LABELS = {
  complaint: { en: 'Complaint', hi: 'शिकायत' },
  nidra: { en: 'Sleep', hi: 'नींद' },
  agni: { en: 'Digestion', hi: 'पाचन' },
  details: { en: 'Details', hi: 'विवरण' },
  summary: { en: 'Summary', hi: 'सारांश' },
};

// Stage 1 — chief complaint. Each card is also reachable by holding its gesture.
const COMPLAINTS = [
  { id: 'FEVER',      emoji: '🤒', en: 'Fever',        hi: 'बुखार',          shape: 'L_SHAPE',   clinical: 'Fever with raised body temperature (Jwara)' },
  { id: 'PAIN',       emoji: '⚡', en: 'Body Pain',    hi: 'दर्द',           shape: 'FIST',      clinical: 'Generalised body pain (Shoola)' },
  { id: 'STOMACH',    emoji: '🤢', en: 'Stomach Pain', hi: 'पेट दर्द',       shape: 'OPEN_PALM', clinical: 'Abdominal pain / stomach discomfort (Udara Shoola)' },
  { id: 'BREATHLESS', emoji: '😮‍💨', en: 'Breathless', hi: 'सांस की तकलीफ',  shape: 'SHAKA',     clinical: 'Breathlessness / difficulty breathing (Shwasa)' },
  { id: 'HEADACHE',   emoji: '🤕', en: 'Headache',     hi: 'सिरदर्द',        shape: 'POINT',     clinical: 'Headache (Shiroshoola)' },
  { id: 'COUGH_COLD', emoji: '🤧', en: 'Cold & Cough', hi: 'खांसी-जुकाम',    shape: 'VICTORY',   clinical: 'Cough and cold (Kasa–Pratishyaya)' },
];

// Stage 2 — Nidra. Thumbs-down OR a closed fist both read as disturbed sleep.
const SLEEP_OPTIONS = [
  { id: 'GOOD',      emoji: '👍', en: 'Yes, good sleep',     hi: 'हाँ, अच्छी नींद आती है',   shapes: ['THUMBS_UP'],           clinical: 'Sushupti — sound, restorative sleep', tone: 'good' },
  { id: 'DISTURBED', emoji: '👎', en: 'No, disturbed sleep', hi: 'नहीं, नींद में परेशानी है', shapes: ['THUMBS_DOWN', 'FIST'], clinical: 'Anidra — disturbed, broken sleep',     tone: 'bad' },
];

// Stage 3 — Agni.
const AGNI_OPTIONS = [
  { id: 'NORMAL',   emoji: '👍', en: 'Yes, digestion is fine',          hi: 'हाँ, पाचन ठीक है',         shapes: ['THUMBS_UP'],           clinical: 'Sama Agni — balanced digestion',                 tone: 'good' },
  { id: 'IMPAIRED', emoji: '👎', en: 'No, gas / indigestion / burning', hi: 'नहीं, गैस / अपच / जलन है', shapes: ['THUMBS_DOWN', 'FIST'], clinical: 'Vishama/Manda Agni — impaired digestion with Ama', tone: 'bad' },
];

const GENDERS = [
  { id: 'Male',   emoji: '👨', en: 'Male',   hi: 'पुरुष' },
  { id: 'Female', emoji: '👩', en: 'Female', hi: 'महिला' },
  { id: 'Other',  emoji: '🧑', en: 'Other',  hi: 'अन्य' },
];

const PRIORITY_CONFIG = {
  P1: { label: 'Critical', ring: 'bg-red-500 text-white',        note: { en: 'Emergency — you will be seen immediately', hi: 'आपातकाल — आपको तुरंत देखा जाएगा' } },
  P2: { label: 'Urgent',   ring: 'bg-amber-400 text-slate-900',  note: { en: 'Urgent — you will be seen very soon',      hi: 'अत्यावश्यक — आपको जल्दी देखा जाएगा' } },
  P3: { label: 'Moderate', ring: 'bg-emerald-400 text-slate-900', note: { en: 'Standard consultation — please wait',     hi: 'सामान्य परामर्श — कृपया प्रतीक्षा करें' } },
  P4: { label: 'Routine',  ring: 'bg-sky-400 text-slate-900',    note: { en: 'Routine visit — please wait',              hi: 'नियमित परामर्श — कृपया प्रतीक्षा करें' } },
};

const DOC_BADGE = {
  PRESCRIPTION: '📄 Prescription',
  LAB_REPORT: '🧪 Lab Report',
  MIXED: '📄🧪 Prescription + Lab',
};

const RETURN_HOME_SECONDS = 45;

export default function SignBridgeKiosk() {
  const navigate = useNavigate();

  // Fresh document-upload session for every kiosk visit
  const [sessionId] = useState(() => 'SIGN-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const mobileUrl = `${window.location.origin}/mobile-scan?sid=${sessionId}`;

  const [lang, setLang] = useState('en');
  const t = (en, hi) => (lang === 'hi' ? hi : en);

  // Wizard
  const [stage, setStage] = useState('complaint');
  const [complaint, setComplaint] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [digestion, setDigestion] = useState(null);
  const [form, setForm] = useState({ name: '', age: '', gender: '', phone: '' });

  // Camera + vision
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [visionStatus, setVisionStatus] = useState('idle'); // idle | loading | ready | failed
  const [visionError, setVisionError] = useState('');
  const [handsVisible, setHandsVisible] = useState(0);
  const [live, setLive] = useState(null);       // { shape, confidence }
  const [stability, setStability] = useState(0);

  // Documents
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docs, setDocs] = useState(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(RETURN_HOME_SECONDS);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const visionRef = useRef(null);
  const advanceRef = useRef(0);
  const tickRef = useRef(0);
  const shapeRef = useRef(null);

  const [smoother] = useState(() => createSmoother({ windowSize: 8, confidenceThreshold: 0.7, cooldownMs: 1000 }));

  // Milliseconds left on a pending auto-advance — drives the countdown banner.
  const [advanceMs, setAdvanceMs] = useState(0);

  const stageIndex = STAGES.indexOf(stage);

  const clearAdvance = useCallback(() => {
    clearTimeout(advanceRef.current);
    clearInterval(tickRef.current);
    setAdvanceMs(0);
  }, []);

  // ── Stage navigation ───────────────────────────────────────────────────────
  const goTo = useCallback((next) => {
    clearAdvance();
    // Soft reset: a hand still held in the previous answer must change shape
    // before it can answer the next question.
    smoother.softReset();
    setStage(next);
  }, [smoother, clearAdvance]);

  // Schedules a hands-free hop to the next stage and counts it down on screen.
  const scheduleAdvance = useCallback((next, delay) => {
    clearTimeout(advanceRef.current);
    clearInterval(tickRef.current);
    const startedAt = Date.now();
    setAdvanceMs(delay);
    tickRef.current = setInterval(() => {
      const left = Math.max(0, delay - (Date.now() - startedAt));
      setAdvanceMs(left);
      if (left <= 0) clearInterval(tickRef.current);
    }, 100);
    advanceRef.current = setTimeout(() => goTo(next), delay);
  }, [goTo]);

  const goNext = useCallback(() => {
    goTo(STAGES[Math.min(STAGES.indexOf(stage) + 1, STAGES.length - 1)]);
  }, [stage, goTo]);

  const goBack = useCallback(() => {
    goTo(STAGES[Math.max(STAGES.indexOf(stage) - 1, 0)]);
  }, [stage, goTo]);

  // Every answer — gestured or tapped — locks in and moves on by itself, so a
  // patient who cannot use a mouse never has to reach for one.
  const answerAndAdvance = useCallback((setter, id, next, delay) => {
    setter(id);
    scheduleAdvance(next, delay);
  }, [scheduleAdvance]);

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setLive(null);
    setHandsVisible(0);
    setStability(0);
    smoother.reset();
  }, [smoother]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? t('Camera permission denied — please allow camera access, or tap the cards below.',
               'कैमरा अनुमति अस्वीकृत — कृपया अनुमति दें, या नीचे कार्ड दबाएँ।')
          : err?.name === 'NotFoundError'
            ? t('No camera found — please tap the cards below.', 'कैमरा नहीं मिला — कृपया नीचे कार्ड दबाएँ।')
            : `${t('Camera error', 'कैमरा त्रुटि')}: ${err?.message || 'unknown'}`
      );
      setCameraOn(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ── Detection loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;

    (async () => {
      if (!visionRef.current) visionRef.current = new SignVision();
      if (!visionRef.current.ready) {
        setVisionStatus('loading');
        try {
          await visionRef.current.initialize();
          if (cancelled) return;
          setVisionStatus('ready');
          setVisionError('');
        } catch (err) {
          if (cancelled) return;
          setVisionStatus('failed');
          setVisionError(err?.message || 'MediaPipe could not load');
          return;
        }
      } else {
        setVisionStatus('ready');
      }

      const loop = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          const w = video.videoWidth || 960;
          const h = video.videoHeight || 720;
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          const ctx = canvas.getContext('2d');
          clearCanvas(ctx, w, h);

          const { hands, prediction } = visionRef.current.detect(video, performance.now());
          hands.forEach((hand, i) => drawHand(ctx, hand, { width: w, height: h, mirror: true, primary: i === 0 }));

          setHandsVisible(hands.length);
          setLive(prediction);

          const committed = smoother.push(prediction?.shape || null, prediction?.confidence || 0);
          setStability(smoother.stability());
          if (committed) shapeRef.current?.(committed.shape);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  }, [cameraOn, smoother]);

  // Release everything on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(advanceRef.current);
    clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    visionRef.current?.close();
  }, []);

  // ── Document session polling ───────────────────────────────────────────────
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/session-docs/${sessionId}`);
        const data = await res.json();
        if (data?.status === 'ready' || data?.status === 'processing') setDocs(data);
      } catch { /* keep polling — the kiosk stays usable offline */ }
    }, 2500);
    return () => clearInterval(poll);
  }, [sessionId]);

  // ── Return-to-home countdown on the success screen ─────────────────────────
  useEffect(() => {
    if (!result) return undefined;
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tick); navigate('/'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [result, navigate]);

  const reports = docs?.reports || [];
  const complaintObj = COMPLAINTS.find(c => c.id === complaint);
  const sleepObj = SLEEP_OPTIONS.find(o => o.id === sleep);
  const agniObj = AGNI_OPTIONS.find(o => o.id === digestion);

  // ── Submission ─────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!form.name.trim()) {
      setSubmitError(t('Patient name is required.', 'रोगी का नाम आवश्यक है।'));
      goTo('details');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          age: form.age || 'N/A',
          gender: form.gender || 'N/A',
          phone: form.phone || 'N/A',
          complaint: complaintObj?.clinical || 'Not specified',
          nidra: sleepObj?.clinical || 'Not assessed',
          agni: agniObj?.clinical || 'Not assessed',
          koshtha: 'Normal',
          triageSource: 'Sign Language Kiosk (Divyang Jan)',
          sessionId,
          lang,
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Triage failed');
      setCountdown(RETURN_HOME_SECONDS);
      setResult(data.record);
      stopCamera();
    } catch (err) {
      setSubmitError(err.message || t('Network error — please try again.', 'नेटवर्क त्रुटि — पुनः प्रयास करें।'));
    } finally {
      setSubmitting(false);
    }
  };

  // Guest fast-path — for a patient who cannot type at all.
  const quickGuestToken = useCallback(() => {
    setForm(f => ({
      ...f,
      name: f.name.trim() || 'Divyang Patient (Divyang Jan)',
      age: f.age || '30',
    }));
    setSubmitError('');
    scheduleAdvance('summary', 1200);
  }, [scheduleAdvance]);

  // ── Gesture → action, resolved against whatever stage is on screen ────────
  const onShape = useCallback((shape) => {
    // The upload drawer takes priority — 👍 closes it and resumes the wizard.
    if (drawerOpen) {
      if (shape === 'THUMBS_UP') { setDrawerOpen(false); goNext(); }
      return;
    }
    if (stage === 'complaint') {
      const hit = COMPLAINTS.find(c => c.shape === shape);
      if (hit) answerAndAdvance(setComplaint, hit.id, 'nidra', 1500);
    } else if (stage === 'nidra') {
      const hit = SLEEP_OPTIONS.find(o => o.shapes.includes(shape));
      if (hit) answerAndAdvance(setSleep, hit.id, 'agni', 1200);
    } else if (stage === 'agni') {
      const hit = AGNI_OPTIONS.find(o => o.shapes.includes(shape));
      if (hit) answerAndAdvance(setDigestion, hit.id, 'details', 1200);
    } else if (stage === 'details') {
      if (shape === 'THUMBS_UP') quickGuestToken();
    } else if (stage === 'summary') {
      if (shape === 'THUMBS_UP' && !submitting) submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, drawerOpen, goNext, answerAndAdvance, quickGuestToken, submitting]);

  useEffect(() => { shapeRef.current = onShape; }, [onShape]);

  const restart = () => {
    setResult(null); setComplaint(null); setSleep(null); setDigestion(null);
    setForm({ name: '', age: '', gender: '', phone: '' });
    setSubmitError(''); setCountdown(RETURN_HOME_SECONDS);
    goTo('complaint');
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <SuccessScreen
        result={result} t={t} countdown={countdown}
        complaintObj={complaintObj} sleepObj={sleepObj} agniObj={agniObj}
        reportCount={reports.length}
        onHome={() => navigate('/')} onRestart={restart}
      />
    );
  }

  const liveShape = live?.shape;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header className="w-full px-4 sm:px-6 h-16 flex items-center justify-between border-b-2 border-slate-700 bg-slate-950">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0" aria-label="Home">
            <span className="material-symbols-outlined text-[22px]">home</span>
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center text-[20px] shrink-0">🤟</div>
          <div className="leading-tight min-w-0">
            <p className="text-base sm:text-lg font-bold truncate">SignBridge · Divyang Jan</p>
            <p className="text-xs text-emerald-300 truncate">सांकेतिक भाषा त्रिआज · Beta</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="px-3 sm:px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-base font-bold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[20px]">translate</span>
            {lang === 'en' ? 'हिंदी' : 'EN'}
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-3 sm:px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 hover:bg-amber-300 text-base font-bold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            <span className="hidden sm:inline">{t('Reports', 'रिपोर्ट')}</span>
            {reports.length > 0 && <span className="px-1.5 rounded-full bg-slate-900 text-amber-300 text-sm">{reports.length}</span>}
          </button>
        </div>
      </header>

      {/* ── Stepper ── */}
      <nav className="w-full px-4 sm:px-6 py-3 bg-slate-950/60 border-b border-slate-800">
        <ol className="max-w-6xl mx-auto flex items-center gap-1.5 sm:gap-3">
          {STAGES.map((s, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <li key={s} className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  done ? 'bg-emerald-500 text-slate-900' : active ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-400/30' : 'bg-slate-700 text-slate-400'
                }`}>
                  {done ? '✓' : i + 1}
                </span>
                <span className={`text-xs sm:text-sm font-bold truncate ${active ? 'text-amber-300' : done ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {t(STEP_LABELS[s].en, STEP_LABELS[s].hi)}
                </span>
                {i < STAGES.length - 1 && <span className={`hidden sm:block flex-1 h-1 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Live attached-document pills — visible on every stage */}
      {reports.length > 0 && (
        <div className="w-full px-4 sm:px-6 py-2 bg-emerald-500/15 border-b-2 border-emerald-500/40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
            <span className="text-base font-black text-emerald-300">
              ✓ {reports.length} {t(`Document${reports.length === 1 ? '' : 's'} Attached`, 'दस्तावेज़ जुड़े')}:
            </span>
            {reports.map((r, i) => (
              <span key={r.id || i} className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-sm font-black">
                {DOC_BADGE[r.documentType] || DOC_BADGE.MIXED}
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* ── Camera column ── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-5 lg:self-start">
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700">
            <div className="relative aspect-[4/3] w-full">
              <video ref={videoRef} autoPlay playsInline muted
                className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] ${cameraOn ? 'opacity-100' : 'opacity-0'}`} />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />

              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <span className="material-symbols-outlined text-[52px] text-slate-500">videocam_off</span>
                  <p className="text-base font-bold text-slate-300">{t('Camera is off', 'कैमरा बंद है')}</p>
                  <p className="text-sm text-slate-400">{t('You can still tap the cards →', 'आप कार्ड दबाकर भी उत्तर दे सकते हैं →')}</p>
                </div>
              )}

              {cameraOn && (
                <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                  <div className="rounded-xl bg-black/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t('Your hand', 'आपका हाथ')}</p>
                    <p className="text-lg font-black leading-tight">
                      {liveShape ? `${HAND_SHAPES[liveShape].emoji} ${shapeLabel(liveShape, lang)}`
                        : handsVisible ? t('Hold a clear shape', 'स्पष्ट संकेत बनाएँ')
                        : t('Show your hand', 'अपना हाथ दिखाएँ')}
                    </p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                    visionStatus === 'ready' ? 'bg-emerald-500 text-slate-900'
                      : visionStatus === 'loading' ? 'bg-amber-400 text-slate-900' : 'bg-red-500 text-white'
                  }`}>
                    {visionStatus === 'ready' ? t('READY', 'तैयार') : visionStatus === 'loading' ? t('LOADING', 'लोड हो रहा') : t('OFFLINE', 'बंद')}
                  </span>
                </div>
              )}
            </div>

            {/* Stability meter — the patient watches this fill before it locks in */}
            {(
              <div className="px-3 py-3 bg-slate-950 border-t-2 border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('Hold steady', 'स्थिर रखें')}</span>
                  <span className={`text-sm font-black ${stability > 0.85 ? 'text-emerald-400' : 'text-amber-300'}`}>{Math.round(stability * 100)}%</span>
                </div>
                <div className="h-4 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${stability > 0.85 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${Math.round(stability * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => (cameraOn ? stopCamera() : startCamera())}
              className={`w-full px-4 py-4 text-lg font-black flex items-center justify-center gap-2 ${
                cameraOn ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">{cameraOn ? 'videocam_off' : 'videocam'}</span>
              {cameraOn ? t('Stop Camera', 'कैमरा बंद करें') : t('Start Camera', 'कैमरा चालू करें')}
            </button>
          </div>

          {cameraError && (
            <p className="rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-100 px-4 py-3 text-base font-semibold">{cameraError}</p>
          )}
          {visionStatus === 'failed' && (
            <p className="rounded-xl bg-amber-400/20 border-2 border-amber-400/50 text-amber-100 px-4 py-3 text-base font-semibold">
              {t('Gesture model unavailable', 'जेस्चर मॉडल अनुपलब्ध')} ({visionError}). {t('Please tap the cards.', 'कृपया कार्ड दबाएँ।')}
            </p>
          )}
        </aside>

        {/* ── Stage column ── */}
        <section className="flex flex-col gap-5">

          {stage === 'complaint' && (
            <StagePanel
              icon="🩺"
              en="What are you suffering from?"
              hi="आप क्या समस्या महसूस कर रहे हैं?"
              help={t('Show the gesture, or tap a card below.', 'संकेत दिखाएँ, या नीचे कार्ड दबाएँ।')}
            >
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {COMPLAINTS.map(c => {
                  const selected = complaint === c.id;
                  const detecting = liveShape === c.shape;
                  return (
                    <button
                      key={c.id}
                      onClick={() => answerAndAdvance(setComplaint, c.id, 'nidra', 1000)}
                      className={`relative rounded-2xl p-4 text-left border-4 transition-all ${
                        selected ? 'border-emerald-400 bg-emerald-500/20'
                          : detecting ? 'border-amber-400 bg-amber-400/15'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-400 text-slate-900 flex items-center justify-center text-lg font-black">✓</span>
                      )}
                      <div className="text-[42px] leading-none mb-2">{c.emoji}</div>
                      <p className="text-xl font-black leading-tight">{c.en}</p>
                      <p className="text-lg font-bold text-emerald-300 leading-tight">{c.hi}</p>
                      <p className="mt-2 text-sm text-slate-400 font-semibold flex items-center gap-1">
                        <span className="text-lg">{HAND_SHAPES[c.shape].emoji}</span>
                        {shapeLabel(c.shape, lang)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {complaintObj && (
                <SelectedBanner
                  emoji={complaintObj.emoji}
                  name={`${complaintObj.en} / ${complaintObj.hi}`}
                  advanceMs={advanceMs}
                  lang={lang}
                />
              )}

              <NextButton disabled={!complaint} onClick={goNext} lang={lang} />
            </StagePanel>
          )}

          {stage === 'nidra' && (
            <StagePanel
              icon="😴"
              en="Are you able to sleep properly?"
              hi="क्या आपको नींद ठीक से आती है?"
              help={t('👍 for yes, 👎 for no — or tap a card.', 'हाँ के लिए 👍, नहीं के लिए 👎 — या कार्ड दबाएँ।')}
              onBack={goBack}
              backLabel={t('Back', 'पीछे')}
            >
              <BinaryChoice
                options={SLEEP_OPTIONS}
                value={sleep}
                liveShape={liveShape}
                lang={lang}
                onPick={(id) => answerAndAdvance(setSleep, id, 'agni', 1200)}
              />
              {sleepObj && <SelectedBanner emoji={sleepObj.emoji} name={t(sleepObj.en, sleepObj.hi)} advanceMs={advanceMs} lang={lang} />}
              <NextButton disabled={!sleep} onClick={goNext} lang={lang} />
            </StagePanel>
          )}

          {stage === 'agni' && (
            <StagePanel
              icon="🍽️"
              en="Are you able to digest properly?"
              hi="क्या आपका पाचन ठीक रहता है?"
              help={t('👍 for yes, 👎 for no — or tap a card.', 'हाँ के लिए 👍, नहीं के लिए 👎 — या कार्ड दबाएँ।')}
              onBack={goBack}
              backLabel={t('Back', 'पीछे')}
            >
              <BinaryChoice
                options={AGNI_OPTIONS}
                value={digestion}
                liveShape={liveShape}
                lang={lang}
                onPick={(id) => answerAndAdvance(setDigestion, id, 'details', 1200)}
              />
              {agniObj && <SelectedBanner emoji={agniObj.emoji} name={t(agniObj.en, agniObj.hi)} advanceMs={advanceMs} lang={lang} />}
              <NextButton disabled={!digestion} onClick={goNext} lang={lang} />
            </StagePanel>
          )}

          {stage === 'details' && (
            <StagePanel
              icon="📝"
              en="Enter Patient Details"
              hi="अपना नाम दर्ज करें"
              help={t('Hold 👍 for a quick guest token, or type the details below.', 'त्वरित टोकन हेतु 👍 रखें, या नीचे विवरण भरें।')}
              onBack={goBack}
              backLabel={t('Back', 'पीछे')}
            >
              <div className="flex flex-col gap-4">
                {/* Hands-free fast path — no keyboard, no mouse */}
                <button
                  onClick={quickGuestToken}
                  className="w-full px-6 py-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xl sm:text-2xl font-black flex flex-col items-center justify-center gap-1 shadow-xl"
                >
                  <span>⚡ त्वरित टोकन / Quick Guest Token (Divyang Jan)</span>
                  <span className="text-base font-bold opacity-80">
                    👍 {t('or hold thumbs-up — name and age fill in automatically',
                          'या अंगूठा ऊपर रखें — नाम व आयु स्वतः भर जाएँगे')}
                  </span>
                </button>

                {advanceMs > 0 && (
                  <SelectedBanner
                    emoji="⚡"
                    name={form.name || 'Divyang Patient (Divyang Jan)'}
                    advanceMs={advanceMs}
                    lang={lang}
                  />
                )}

                <p className="text-center text-base font-bold text-slate-400">
                  {t('— or enter the details below —', '— या नीचे विवरण भरें —')}
                </p>

                <label className="flex flex-col gap-2">
                  <span className="text-lg font-black">
                    {t('Patient Name', 'रोगी का नाम')} <span className="text-red-400">*</span>
                  </span>
                  <input
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); setSubmitError(''); }}
                    placeholder={t('Type your full name', 'अपना पूरा नाम लिखें')}
                    className="h-16 px-5 rounded-2xl bg-slate-800 border-4 border-slate-700 focus:border-emerald-400 focus:outline-none text-2xl font-bold placeholder:text-slate-500 placeholder:font-medium"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-lg font-black">{t('Age', 'आयु')}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min="0" max="120"
                        value={form.age}
                        onChange={e => setForm({ ...form, age: e.target.value })}
                        placeholder="--"
                        className="w-24 h-16 px-3 rounded-2xl bg-slate-800 border-4 border-slate-700 focus:border-emerald-400 focus:outline-none text-2xl font-black text-center placeholder:text-slate-500"
                      />
                      <input
                        type="range" min="0" max="100" step="1"
                        value={form.age === '' ? 30 : form.age}
                        onChange={e => setForm({ ...form, age: e.target.value })}
                        className="flex-1 h-3 accent-emerald-400 cursor-pointer"
                        aria-label={t('Age slider', 'आयु स्लाइडर')}
                      />
                    </div>
                  </label>

                  <div className="flex flex-col gap-2">
                    <span className="text-lg font-black">{t('Gender', 'लिंग')}</span>
                    <div className="flex gap-2">
                      {GENDERS.map(g => (
                        <button
                          key={g.id}
                          onClick={() => setForm({ ...form, gender: g.id })}
                          className={`flex-1 h-16 rounded-2xl border-4 text-base font-black flex flex-col items-center justify-center leading-tight ${
                            form.gender === g.id ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-xl">{g.emoji}</span>
                          {t(g.en, g.hi)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-lg font-black">
                    {t('Mobile Number', 'मोबाइल नंबर')} <span className="text-slate-400 font-bold text-base">({t('optional', 'वैकल्पिक')})</span>
                  </span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit number"
                    className="h-16 px-5 rounded-2xl bg-slate-800 border-4 border-slate-700 focus:border-emerald-400 focus:outline-none text-2xl font-bold placeholder:text-slate-500 placeholder:font-medium"
                  />
                </label>

                {/* Touchless document upload */}
                <div className="rounded-2xl border-4 border-amber-400/40 bg-amber-400/10 p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white p-2 rounded-xl shrink-0">
                    <QRCodeSVG value={mobileUrl} size={116} level="M" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-lg font-black">{t('Have past prescriptions?', 'पुरानी पर्ची है?')}</p>
                    <p className="text-base font-bold text-amber-200">{t('Scan to attach', 'स्कैन करके जोड़ें')} · पुरानी पर्ची स्कैन करें</p>
                    <p className="mt-1 text-sm font-semibold text-slate-300">
                      {reports.length
                        ? `✓ ${reports.length} ${t('report(s) attached', 'रिपोर्ट जुड़ी')}`
                        : docs?.status === 'processing'
                          ? t('Reading your document…', 'दस्तावेज़ पढ़ा जा रहा है…')
                          : t('Optional — you can skip this.', 'वैकल्पिक — आप छोड़ सकते हैं।')}
                    </p>
                  </div>
                  <button
                    onClick={goNext}
                    className={`px-5 py-3 rounded-xl text-base font-black shrink-0 ${
                      reports.length ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {reports.length ? t('Continue Consultation', 'परामर्श जारी रखें') : t('Skip', 'आगे बढ़ें')} ➔
                  </button>
                </div>

                {submitError && (
                  <p className="rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-100 px-4 py-3 text-lg font-bold">{submitError}</p>
                )}

                <NextButton disabled={!form.name.trim()} onClick={goNext} lang={lang} />
                {!form.name.trim() && (
                  <p className="text-center text-base font-bold text-amber-300">{t('Please type your name to continue', 'आगे बढ़ने के लिए अपना नाम लिखें')}</p>
                )}
              </div>
            </StagePanel>
          )}

          {stage === 'summary' && (
            <StagePanel
              icon="🚀"
              en="Please check your answers"
              hi="कृपया अपनी जानकारी जाँचें"
              help={t('Hold 👍 to send, or tap any row to change it.', 'भेजने हेतु 👍 रखें, या बदलने के लिए पंक्ति दबाएँ।')}
              onBack={goBack}
              backLabel={t('Back', 'पीछे')}
            >
              <div className="flex flex-col gap-3">
                <SummaryRow onClick={() => goTo('details')} icon="🧑" label={t('Patient', 'रोगी')}
                  value={`${form.name || '—'}${form.age ? ` · ${form.age} ${t('yrs', 'वर्ष')}` : ''}${form.gender ? ` · ${form.gender}` : ''}${form.phone ? ` · 📱 ${form.phone}` : ''}`} />
                <SummaryRow onClick={() => goTo('complaint')} icon={complaintObj?.emoji || '🩺'} label={t('Complaint', 'शिकायत')}
                  value={complaintObj ? `${complaintObj.en} / ${complaintObj.hi}` : t('Not selected', 'चयनित नहीं')} />
                <SummaryRow onClick={() => goTo('nidra')} icon={sleepObj?.emoji || '😴'} label={t('Sleep (Nidra)', 'नींद (निद्रा)')}
                  value={sleepObj ? t(sleepObj.en, sleepObj.hi) : t('Not answered', 'उत्तर नहीं')} tone={sleepObj?.tone} />
                <SummaryRow onClick={() => goTo('agni')} icon={agniObj?.emoji || '🍽️'} label={t('Digestion (Agni)', 'पाचन (अग्नि)')}
                  value={agniObj ? t(agniObj.en, agniObj.hi) : t('Not answered', 'उत्तर नहीं')} tone={agniObj?.tone} />
                <SummaryRow onClick={() => setDrawerOpen(true)} icon="📄" label={t('Attached reports', 'जुड़ी रिपोर्ट')}
                  value={reports.length ? `${reports.length} ${t('report(s)', 'रिपोर्ट')}` : t('None', 'कोई नहीं')} />

                {submitError && (
                  <p className="rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-100 px-4 py-3 text-lg font-bold">{submitError}</p>
                )}

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full px-6 py-7 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-900 text-2xl sm:text-3xl font-black flex items-center justify-center gap-3 shadow-xl"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
                      {t('Sending…', 'भेजा जा रहा है…')}
                    </>
                  ) : (
                    <>🚀 {t('Submit to Doctor Queue', 'डॉक्टर कतार में भेजें')}</>
                  )}
                </button>
                <p className="text-center text-base font-bold text-emerald-300">
                  👍 {t('Hold thumbs-up in front of the camera to send hands-free',
                        'बिना छुए भेजने हेतु कैमरे के सामने अंगूठा ऊपर रखें')}
                </p>
              </div>
            </StagePanel>
          )}
        </section>
      </main>

      {/* ── Document drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <aside onClick={e => e.stopPropagation()} className="relative w-full max-w-md h-full bg-slate-900 border-l-4 border-slate-700 overflow-y-auto flex flex-col gap-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{t('Upload Reports', 'रिपोर्ट अपलोड')}</h2>
                <p className="text-base font-bold text-emerald-300">पुरानी पर्ची स्कैन करें</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white rounded-2xl">
                <QRCodeSVG value={mobileUrl} size={196} level="M" />
              </div>
              <p className="text-center text-base font-bold text-slate-300">
                {t('Scan with your phone camera to send prescriptions and lab reports.',
                   'फ़ोन कैमरे से स्कैन कर पर्ची व लैब रिपोर्ट भेजें।')}
              </p>
              <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm font-bold text-slate-300">
                {docs?.status === 'processing' ? t('Reading document…', 'दस्तावेज़ पढ़ा जा रहा है…') : `${t('Waiting', 'प्रतीक्षा')} · ${sessionId}`}
              </span>
            </div>

            {reports.length > 0 && (
              <>
                {/* Live preview pill — what the kiosk has received so far */}
                <div className="rounded-2xl bg-emerald-500/20 border-4 border-emerald-400 px-4 py-3 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black">
                    ✓ {reports.length} {t(`Document${reports.length === 1 ? '' : 's'} Attached`, 'दस्तावेज़ जुड़े')}:
                  </span>
                  {reports.map((r, i) => (
                    <span key={r.id || i} className="px-2.5 py-1 rounded-lg bg-slate-900 text-emerald-300 text-sm font-black">
                      {DOC_BADGE[r.documentType] || DOC_BADGE.MIXED}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => { setDrawerOpen(false); goNext(); }}
                  className="w-full px-6 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xl sm:text-2xl font-black flex flex-col items-center justify-center gap-1 shadow-xl"
                >
                  <span>➔ {t('Next: Continue Consultation', 'परामर्श जारी रखें')}</span>
                  <span className="text-base font-bold opacity-80">
                    👍 {t('or hold thumbs-up', 'या अंगूठा ऊपर रखें')}
                  </span>
                </button>
              </>
            )}

            {reports.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-black uppercase tracking-wider text-slate-400">{t('Attached', 'जुड़ी हुई')}</p>
                {reports.map((r, i) => (
                  <div key={r.id || i} className="rounded-xl bg-slate-800 border-2 border-slate-700 p-3">
                    <p className="text-sm font-black text-amber-300">{DOC_BADGE[r.documentType] || DOC_BADGE.MIXED}</p>
                    <p className="text-base font-bold truncate">{r.title || r.fileName}</p>
                    <p className="text-sm font-semibold text-slate-400">
                      💊 {r.medicines?.length || 0} · 🧪 {r.labTests?.length || 0}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setDrawerOpen(false)} className="mt-auto w-full px-5 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xl font-black">
              {t('Done', 'हो गया')}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function StagePanel({ icon, en, hi, help, children, onBack, backLabel }) {
  return (
    <div className="flex flex-col gap-4">
      {/* High-contrast question banner */}
      <div className="rounded-2xl bg-emerald-500 text-slate-900 px-5 py-5 flex items-start gap-4">
        <span className="text-[44px] leading-none shrink-0">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">{en}</h1>
          <p className="text-xl sm:text-2xl font-black leading-tight mt-0.5">{hi}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-slate-300">{help}</p>
        {onBack && (
          <button onClick={onBack} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-base font-black flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>{backLabel}
          </button>
        )}
      </div>

      {children}
    </div>
  );
}

function BinaryChoice({ options, value, liveShape, lang, onPick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map(o => {
        const selected = value === o.id;
        const detecting = o.shapes.includes(liveShape);
        return (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`relative rounded-2xl p-6 border-4 text-left transition-all ${
              selected
                ? 'border-emerald-400 bg-emerald-500/25'
                : detecting ? 'border-amber-300 bg-amber-300/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-500'
            }`}
          >
            {selected && (
              <span className="absolute top-3 right-3 w-10 h-10 rounded-full bg-emerald-400 text-slate-900 flex items-center justify-center text-2xl font-black">✓</span>
            )}
            <div className="text-[64px] leading-none mb-2">{o.emoji}</div>
            <p className="text-2xl font-black leading-tight">{o.en}</p>
            <p className="text-xl font-black text-emerald-300 leading-tight mt-1">{o.hi}</p>
            <p className="mt-3 text-sm font-bold text-slate-400">
              {o.shapes.map(s => `${HAND_SHAPES[s].emoji} ${shapeLabel(s, lang)}`).join('  ·  ')}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// Confirms the locked-in answer and visibly counts down the hands-free hop.
function SelectedBanner({ emoji, name, advanceMs, lang }) {
  const advancing = advanceMs > 0;
  const seconds = (advanceMs / 1000).toFixed(1);
  return (
    <div className={`rounded-2xl bg-emerald-500/25 border-4 border-emerald-400 px-5 py-4 flex flex-col gap-3 ${advancing ? 'animate-pulse' : ''}`}>
      <div className="flex items-center gap-4">
        <span className="text-[40px] leading-none shrink-0">{emoji}</span>
        <div className="min-w-0">
          <p className="text-2xl font-black leading-tight">
            ✓ {name} {lang === 'hi' ? 'चयनित' : 'चयनित (Selected)'}!
          </p>
          <p className="text-lg font-black text-emerald-300 leading-tight">
            {advancing
              ? `आगे बढ़ रहे हैं (Advancing in ${seconds}s)…`
              : (lang === 'hi' ? 'दर्ज हो गया' : 'Recorded')}
          </p>
        </div>
      </div>
      {advancing && (
        <div className="h-3 w-full rounded-full bg-emerald-900/50 overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all duration-100" style={{ width: `${Math.min(100, (advanceMs / 1500) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function NextButton({ disabled, onClick, lang }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-6 py-6 rounded-2xl text-2xl sm:text-3xl font-black flex items-center justify-center gap-3 transition-all ${
        disabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-xl'
      }`}
    >
      {lang === 'hi' ? 'आगे बढ़ें' : 'Next'} ➔
    </button>
  );
}

function SummaryRow({ icon, label, value, tone, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-slate-800 border-4 border-slate-700 hover:border-slate-500 px-5 py-4 flex items-center gap-4 text-left"
    >
      <span className="text-[36px] leading-none shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-xl font-black leading-tight truncate ${tone === 'bad' ? 'text-amber-300' : 'text-slate-100'}`}>{value}</p>
      </div>
      <span className="material-symbols-outlined text-[24px] text-slate-400 shrink-0">edit</span>
    </button>
  );
}

// ── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ result, t, countdown, complaintObj, sleepObj, agniObj, reportCount, onHome, onRestart }) {
  const cfg = PRIORITY_CONFIG[result.triageLevel] || PRIORITY_CONFIG.P3;
  const token = result.id ? `AYUSH-${String(result.id).slice(-6).toUpperCase()}` : 'AYUSH-000000';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-4 py-8 gap-6">
      <div className="w-24 h-24 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center text-[52px] font-black">✓</div>

      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-black">{t('Sent to the Doctor', 'डॉक्टर को भेज दिया गया')}</h1>
        <p className="text-2xl font-black text-emerald-300 mt-1">डॉक्टर कतार में भेज दिया गया</p>
      </div>

      {/* Token */}
      <div className="w-full max-w-lg rounded-3xl bg-slate-800 border-4 border-emerald-400 p-6 flex flex-col items-center gap-2">
        <p className="text-base font-black uppercase tracking-widest text-slate-400">{t('Your OPD Token', 'आपका ओपीडी टोकन')}</p>
        <p className="text-4xl sm:text-5xl font-black text-emerald-300 tracking-wide">{token}</p>
        <p className="text-xl font-bold">{result.name}</p>
      </div>

      {/* Priority */}
      <div className="w-full max-w-lg flex flex-col items-center gap-2">
        <span className={`px-6 py-3 rounded-2xl text-2xl font-black ${cfg.ring}`}>
          {result.triageLevel} — {result.triageLabel || cfg.label}
        </span>
        <p className="text-lg font-bold text-slate-300 text-center">{t(cfg.note.en, cfg.note.hi)}</p>
      </div>

      {/* What was recorded */}
      <div className="w-full max-w-lg rounded-2xl bg-slate-800 border-2 border-slate-700 p-5 flex flex-col gap-2.5">
        <Line icon={complaintObj?.emoji || '🩺'} label={t('Complaint', 'शिकायत')} value={complaintObj ? `${complaintObj.en} / ${complaintObj.hi}` : (result.chiefComplaint || '—')} />
        <Line icon={sleepObj?.emoji || '😴'} label={t('Sleep (Nidra)', 'नींद (निद्रा)')} value={sleepObj ? t(sleepObj.en, sleepObj.hi) : '—'} />
        <Line icon={agniObj?.emoji || '🍽️'} label={t('Digestion (Agni)', 'पाचन (अग्नि)')} value={agniObj ? t(agniObj.en, agniObj.hi) : '—'} />
        <Line icon="🧘" label="Dosha" value={`${result.dosha || '—'} · Agni ${result.agni || '—'} · Koshtha ${result.koshtha || '—'}`} />
        {reportCount > 0 && <Line icon="📄" label={t('Reports attached', 'जुड़ी रिपोर्ट')} value={`${reportCount}`} />}
      </div>

      {/* Countdown */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
          <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${(countdown / RETURN_HOME_SECONDS) * 100}%` }} />
        </div>
        <p className="text-center text-lg font-bold text-slate-300">
          {t(`Returning to the home screen in ${countdown}s`, `${countdown} सेकंड में होम स्क्रीन पर वापस`)}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onHome} className="flex-1 px-6 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xl font-black">
            🏠 {t('Home Now', 'अभी होम जाएँ')}
          </button>
          <button onClick={onRestart} className="flex-1 px-6 py-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xl font-black">
            ➕ {t('New Patient', 'नया रोगी')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[26px] leading-none shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}
