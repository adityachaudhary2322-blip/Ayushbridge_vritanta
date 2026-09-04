import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sarvamTTS, recordUntilSilence, stopSarvamAudio } from '../utils/sarvam';

const STAGES = ['name', 'ageGender', 'mobile', 'complaint', 'agni', 'sleep', 'energy', 'history'];

const Q = {
  name:      { en: 'Namaste! Welcome to AYUSH Swasthya Sahayak. Please say your full name.',           hi: 'नमस्ते! आयुष स्वास्थ्य सहायक में आपका स्वागत है। कृपया अपना पूरा नाम बोलें।' },
  ageGender: { en: 'Thank you. Please tell me your age and gender.',                                    hi: 'धन्यवाद। कृपया अपनी उम्र और लिंग बताएं।' },
  mobile:    { en: 'Please say your ten-digit mobile number.',                                          hi: 'कृपया अपना दस अंकों का मोबाइल नंबर बोलें।' },
  complaint: { en: 'What health problem are you facing, and since how many days?',                      hi: 'आपको क्या स्वास्थ्य समस्या है, और कितने दिनों से है?' },
  agni:      { en: 'How is your appetite and digestion? Any constipation or irregular bowels?',        hi: 'आपकी भूख और पाचन कैसा है? कब्ज या अनियमित पेट तो नहीं?' },
  sleep:     { en: 'How is your sleep quality? Do you experience broken sleep, insomnia, or high stress and anxiety?', hi: 'आपकी नींद कैसी है — क्या रात में नींद टूटती है या अत्यधिक तनाव व चिंता महसूस होती है?' },
  energy:    { en: 'How is your daily energy level — excessive fatigue, lethargy, or normal? Do you stay well-hydrated?', hi: 'दिनभर आपका ऊर्जा स्तर कैसा रहता है — अत्यधिक सुस्ती, कमजोरी या सामान्य? क्या पर्याप्त पानी पीते हैं?' },
  history:   { en: 'Do you have any pre-existing conditions — Diabetes, Hypertension, Thyroid, asthma, or drug allergies?', hi: 'क्या आपको पहले से कोई पुरानी बीमारी है — जैसे बीपी, शुगर, थायराइड, सांस फूलना या किसी दवा से एलर्जी?' },
};
const REPROMPT = { en: 'Please speak a bit louder.', hi: 'कृपया थोड़ा ज़ोर से बोलें।' };
const STAGE_LABEL = {
  name: { en: 'Name', hi: 'नाम' }, ageGender: { en: 'Age & Gender', hi: 'उम्र व लिंग' },
  mobile: { en: 'Mobile', hi: 'मोबाइल' }, complaint: { en: 'Complaint', hi: 'तकलीफ' }, agni: { en: 'Agni / Koshtha', hi: 'अग्नि / कोष्ठ' },
  sleep: { en: 'Sleep & Stress', hi: 'निद्रा व मानस' }, energy: { en: 'Energy & Vitality', hi: 'बल व ऊर्जा' }, history: { en: 'Chronic History', hi: 'पुरानी बीमारी' },
};

const PRIORITY_CONFIG = {
  P1: { bg: 'bg-red-600', label: 'Critical', icon: 'emergency' },
  P2: { bg: 'bg-orange-500', label: 'Urgent', icon: 'priority_high' },
  P3: { bg: 'bg-blue-600', label: 'Moderate', icon: 'schedule' },
  P4: { bg: 'bg-green-600', label: 'Routine', icon: 'check_circle' },
};

// Tap-to-answer fallback chips per stage (noisy room / mic failure escape hatch).
// name & mobile are free-text → covered by the always-present text input.
const KIOSK_CHIPS = {
  ageGender: { en: ['Male', 'Female', 'Other'], hi: ['पुरुष (Male)', 'महिला (Female)', 'अन्य (Other)'] },
  complaint: { en: ['Abdominal pain', 'Acidity / Heartburn', 'Joint pain', 'Headache & fatigue'], hi: ['पेट दर्द', 'खट्टी डकार व जलन', 'जोड़ों का दर्द', 'सिरदर्द व थकान'] },
  agni: { en: ['Low appetite (Manda)', 'Normal (Sama)', 'Constipation (Krura)', 'Acidity (Amla)'], hi: ['भूख कम (Manda)', 'पाचन ठीक (Sama)', 'कब्ज (Krura)', 'खट्टी डकारें (Amla)'] },
  sleep: { en: ['Sound Sleep', 'Disturbed Sleep', 'Insomnia / High Stress'], hi: ['गहरी नींद (Sound)', 'नींद में बाधा (Disturbed)', 'अनिद्रा व तनाव (Insomnia)'] },
  energy: { en: ['Normal Energy', 'Sluggish / Lethargic', 'Severe Weakness'], hi: ['ऊर्जा सामान्य (Normal)', 'भारीपन व सुस्ती (Lethargy)', 'अत्यधिक कमजोरी (Fatigue)'] },
  history: { en: ['No Pre-existing Conditions', 'Hypertension / High BP', 'Diabetes / Sugar', 'Respiratory / Allergy'], hi: ['कोई पुरानी बीमारी नहीं', 'उच्च रक्तचाप (BP)', 'मधुमेह (Diabetes)', 'सांस/एलर्जी'] },
};

function parseGender(text) {
  const tl = text.toLowerCase();
  if (/female|महिला|स्त्री|औरत|लड़की|mahila|ladki|woman|girl/.test(tl)) return 'Female';
  if (/\bmale\b|पुरुष|मर्द|लड़का|purush|mard|aadmi|man|boy/.test(tl)) return 'Male';
  if (/other|अन्य/.test(tl)) return 'Other';
  return 'Not specified';
}
function parseDigestion(text) {
  const tl = text.toLowerCase();
  let agni = 'Vishama';
  if (/manda|कम|low|less|thoda|sluggish|भूख नहीं/.test(tl)) agni = 'Manda';
  else if (/tikshna|तेज़|sharp|excessive|ज़्यादा|zyada|acid|खट्ट/.test(tl)) agni = 'Tikshna';
  else if (/sama|ठीक|normal|fine|good|अच्छ/.test(tl)) agni = 'Sama';
  let koshtha = 'Madhyama';
  if (/krura|कब्ज|constipat|hard|कठोर/.test(tl)) koshtha = 'Krura';
  else if (/mridu|loose|दस्त|soft|पतला/.test(tl)) koshtha = 'Mridu';
  return { agni, koshtha };
}

export default function TouchlessKiosk() {
  const navigate = useNavigate();

  const [lang, setLang] = useState('en');
  const langRef = useRef('en');
  useEffect(() => { langRef.current = lang; }, [lang]);

  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState('name');       // 'name'…'history' | 'complete'
  const stageRef = useRef('name');
  const stageTokenRef = useRef(0);                    // bumped on every stage change (voice/chip guard)
  const [botStatus, setBotStatus] = useState('idle'); // idle|speaking|listening|thinking
  const [caption, setCaption] = useState('');         // AI's spoken question
  const [transcript, setTranscript] = useState('');   // patient's live transcript
  const [error, setError] = useState('');
  const [liveVolume, setLiveVolume] = useState(0);    // 0..1 live mic VU meter
  const [voiceError, setVoiceError] = useState('');   // distinct API/mic error banner
  const [typedAnswer, setTypedAnswer] = useState('');

  const fieldsRef = useRef({ name: '', age: '', gender: '', mobile: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });
  const [fields, setFields] = useState(fieldsRef.current);
  const isMountedRef = useRef(false);

  const [triageResult, setTriageResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeRef = useRef(false);
  const recRef = useRef(null);
  const pollRef = useRef(null);

  // QR document upload
  const [sessionId] = useState(() => 'SES-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [docResult, setDocResult] = useState(null);
  const mobileUrl = `${window.location.origin}/mobile-scan?sid=${sessionId}`;

  const netErr = useCallback(() => {
    setError(langRef.current === 'hi'
      ? 'नेटवर्क समस्या — कृपया जांचें कि बैकएंड सर्वर चल रहा है।'
      : 'Network issue — verify the backend server is running.');
  }, []);

  // ── Voice primitives ─────────────────────────────────────────────────────────
  const speak = useCallback(async (text) => {
    setBotStatus('speaking');
    setCaption(text);
    await sarvamTTS(text, langRef.current, {
      onNetworkError: () => setVoiceError(langRef.current === 'hi'
        ? '⚠️ वॉयस सेवा त्रुटि — कृपया दोबारा प्रयास करें या नीचे टाइप/टैप करें।'
        : '⚠️ Voice Service Error reaching TTS — retry or type/tap your answer below.'),
    });
  }, []);

  // Resolves to { status: 'ok'|'empty'|'error', text, code, msg }
  const listen = useCallback(() => new Promise((resolve) => {
    setBotStatus('listening');
    setTranscript('');
    setLiveVolume(0);
    recordUntilSilence({
      initialWaitMs: 5000,      // up to 5s to BEGIN speaking
      trailingSilenceMs: 2000,  // stop 2s after they go quiet
      maxRecordMs: 9000,        // hard safety cutoff
      langCode: langRef.current === 'hi' ? 'hi-IN' : 'en-IN',
      onVolumeChange: (v) => setLiveVolume(v),
      onStop: () => { setBotStatus('thinking'); setLiveVolume(0); },
      onResult: (t) => resolve({ status: t ? 'ok' : 'empty', text: t }),
      onError: (code, msg) => resolve({ status: 'error', code, msg }),
    }).then((rec) => { recRef.current = rec; });
  }), []);

  const storeAnswer = useCallback((stageKey, text) => {
    const f = { ...fieldsRef.current };
    if (stageKey === 'name') f.name = text;
    else if (stageKey === 'ageGender') {
      const n = text.match(/\d{1,3}/); if (n) f.age = n[0];
      f.gender = parseGender(text);
    } else if (stageKey === 'mobile') {
      const d = text.replace(/\D/g, ''); f.mobile = d.length >= 10 ? d.slice(-10) : (d || 'N/A');
    } else if (stageKey === 'complaint') f.complaint = text;
    else if (stageKey === 'agni') { const { agni, koshtha } = parseDigestion(text); f.agni = agni; f.koshtha = koshtha; }
    else if (stageKey === 'sleep') f.sleep_stress = text;
    else if (stageKey === 'energy') f.energy_lifestyle = text;
    else if (stageKey === 'history') f.chronic_history = text;
    fieldsRef.current = f;
    setFields(f);
  }, []);

  const submitTriage = useCallback(async () => {
    setStage('complete'); stageRef.current = 'complete';
    setBotStatus('thinking');
    setIsSubmitting(true);
    const f = fieldsRef.current;
    const done = langRef.current === 'hi'
      ? 'धन्यवाद! आपका पंजीकरण पूरा हो गया। कृपया अपने टोकन की प्रतीक्षा करें।'
      : 'Thank you! Your registration is complete. Please wait for your token to be called.';
    speak(done);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: `PK${Date.now()}`,
          name: f.name, age: f.age, gender: f.gender, phone: f.mobile,
          symptoms: f.complaint, agni: f.agni, koshtha: f.koshtha,
          sleep_stress: f.sleep_stress, energy_lifestyle: f.energy_lifestyle, chronic_history: f.chronic_history,
          sessionId, lang: langRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTriageResult(data.record || data);
    } catch (err) {
      console.warn('[kiosk triage]', err.message);
      setTriageResult({
        id: `PK${Date.now()}`, name: f.name || 'Anonymous',
        triageLevel: 'P3', triageLabel: 'Moderate',
        chiefComplaint: f.complaint || 'General consultation',
        agni: f.agni || 'Vishama', koshtha: f.koshtha || 'Madhyama', dosha: 'Tridosha',
        recommendation: 'Standard Ayurvedic consultation advised.',
      });
    } finally {
      setBotStatus('idle');
      setIsSubmitting(false);
    }
  }, [speak, sessionId]);

  // ── Resumable stage machine (voice OR chip/text can advance any step) ──────────
  const isAlive = (token) => activeRef.current && stageTokenRef.current === token;

  // acceptAnswer is the single entry point for BOTH voice results and chip/text taps
  const acceptAnswer = (stageKey, text) => {
    const t = (text || '').trim();
    if (!t) return;
    if (recRef.current?.state === 'recording') recRef.current.stop();
    stopSarvamAudio();
    setLiveVolume(0); setVoiceError(''); setTypedAnswer('');
    storeAnswer(stageKey, t);
    setTranscript(t);
    const next = STAGES[STAGES.indexOf(stageKey) + 1];
    if (next) goToStage(next);
    else submitTriage();
  };

  async function askAndListen(stageKey, attempt, token) {
    if (!isAlive(token)) return;
    await speak(attempt === 0 ? Q[stageKey][langRef.current] : REPROMPT[langRef.current]);
    if (!isAlive(token)) return;
    const r = await listen();
    if (!isAlive(token)) return; // a chip/text tap already advanced the stage
    if (r.status === 'ok') { acceptAnswer(stageKey, r.text); return; }
    if (r.status === 'error') {
      // API / mic failure → explicit banner, DO NOT say "speak louder". Wait for chip/text/retry.
      setBotStatus('idle');
      if (r.code === 'not-allowed') {
        setVoiceError(langRef.current === 'hi'
          ? '⚠️ माइक्रोफ़ोन अनुमति नहीं मिली — कृपया अनुमति दें, या नीचे टाइप/टैप करें।'
          : '⚠️ Microphone permission denied — allow it, or type/tap your answer below.');
      } else {
        setVoiceError(langRef.current === 'hi'
          ? `⚠️ वॉयस सेवा त्रुटि: ${r.msg || 'unknown'}. दोबारा प्रयास करें या नीचे टाइप/टैप करें।`
          : `⚠️ Voice Service Error: ${r.msg || 'unknown'}. Retry or type/tap your answer below.`);
      }
      return;
    }
    // status === 'empty' → the patient didn't speak / not recognized → "speak louder" and retry
    if (attempt < 2) { askAndListen(stageKey, attempt + 1, token); }
    else { setBotStatus('idle'); } // stop auto-retrying; chips/text remain available
  }

  async function goToStage(stageKey) {
    const token = ++stageTokenRef.current;
    stageRef.current = stageKey; setStage(stageKey);
    await askAndListen(stageKey, 0, token);
  }

  // ── Start / stop ──────────────────────────────────────────────────────────────
  const begin = () => {
    if (started) return;
    stopSarvamAudio();           // ensure no stale/overlapping audio before we start
    setStarted(true);
    activeRef.current = true;
    // Unlock browser audio within the user gesture so TTS can auto-play hands-free
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) { const ctx = new Ctx(); ctx.resume?.().catch(() => {}); }
    } catch { /* ignore */ }
    goToStage(STAGES[0]);
  };

  // Manual "done speaking" — end the current recording now
  const tapMic = () => {
    if (recRef.current?.state === 'recording') recRef.current.stop();
  };

  // Retry voice after an API/mic error banner
  const retryVoice = () => {
    setVoiceError('');
    askAndListen(stageRef.current, 0, stageTokenRef.current);
  };

  // Chip / typed answer → advance the current stage
  const submitTyped = () => acceptAnswer(stageRef.current, typedAnswer);

  const resetKiosk = () => {
    activeRef.current = false;
    stopSarvamAudio();
    if (recRef.current?.state === 'recording') recRef.current.stop();
    fieldsRef.current = { name: '', age: '', gender: '', mobile: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' };
    setFields(fieldsRef.current);
    setTriageResult(null); setStage('name'); stageRef.current = 'name'; stageTokenRef.current = 0;
    setCaption(''); setTranscript(''); setBotStatus('idle'); setStarted(false);
    setLiveVolume(0); setVoiceError(''); setTypedAnswer('');
  };

  // QR polling + cleanup
  useEffect(() => {
    if (isMountedRef.current) return; // guard React StrictMode double-invoke in dev
    isMountedRef.current = true;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session-docs/${sessionId}`);
        const data = await res.json();
        if (data.status === 'ready') { setDocResult(data); clearInterval(pollRef.current); }
        else if (data.status === 'processing') setDocResult(data);
      } catch { /* keep polling */ }
    }, 2000);
    return () => {
      activeRef.current = false;
      isMountedRef.current = false;
      stopSarvamAudio();
      if (pollRef.current) clearInterval(pollRef.current);
      if (recRef.current?.state === 'recording') recRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageIdx = STAGES.indexOf(stage);
  const speaking = botStatus === 'speaking';
  const listening = botStatus === 'listening';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-surface to-surface-container-low">

      {/* Top bar */}
      <header className="w-full px-4 sm:px-8 h-16 flex items-center justify-between border-b border-surface-container-high bg-surface-container-lowest/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[20px]">spa</span>
          </div>
          <div>
            <div className="font-title-md text-title-md text-on-surface font-semibold leading-none">AYUSH Swasthya Sahayak</div>
            <div className="font-label-sm text-label-sm text-on-surface-variant">आयुष स्वास्थ्य सहायक · Touchless Triage Kiosk</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-surface-container rounded-full p-1 gap-1">
            <button onClick={() => setLang('hi')} className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-all ${lang === 'hi' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>🇮🇳 हिंदी</button>
            <button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-all ${lang === 'en' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>🇬🇧 English</button>
          </div>
          <button onClick={() => navigate('/text-intake')} className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">keyboard</span>
            Switch to Text Intake
          </button>
          <button onClick={() => navigate('/doctor')} title="Doctor Dashboard" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-[18px]">stethoscope</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 relative flex flex-col lg:flex-row items-stretch">

        {/* Center stage */}
        <section className="flex-1 flex flex-col items-center justify-center gap-8 p-6 sm:p-10">

          {triageResult ? (
            // ── Triage token card ──
            <TokenCard result={triageResult} lang={lang} onReset={resetKiosk} onDoctor={() => navigate('/doctor')} />
          ) : (
            <>
              {/* Avatar with concentric waveform rings */}
              <div className="relative flex items-center justify-center w-64 h-64">
                {(speaking || listening) && (
                  <>
                    <div className={`absolute w-64 h-64 rounded-full ${speaking ? 'bg-primary/10' : 'bg-tertiary/10'} animate-ping`} />
                    <div className={`absolute w-52 h-52 rounded-full ${speaking ? 'bg-primary/15' : 'bg-tertiary/15'} animate-pulse`} />
                    <div className={`absolute w-40 h-40 rounded-full ${speaking ? 'bg-primary/20' : 'bg-tertiary/20'} animate-pulse`} />
                  </>
                )}
                <div className={`relative w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                  speaking ? 'bg-primary scale-105' :
                  listening ? 'bg-tertiary/80 scale-100' :
                  botStatus === 'thinking' ? 'bg-secondary/60 scale-95' : 'bg-surface-container-high'
                }`}>
                  <span className={`material-symbols-outlined text-[56px] ${botStatus === 'idle' ? 'text-on-surface-variant' : 'text-white'}`}>
                    {speaking ? 'record_voice_over' : listening ? 'hearing' : botStatus === 'thinking' ? 'psychology' : 'spa'}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">AI Vaidya</p>
                <p className="font-label-md text-label-md text-primary">
                  {speaking ? (lang === 'hi' ? 'बोल रहे हैं…' : 'Speaking…') :
                   listening ? (lang === 'hi' ? 'सुन रहे हैं — बोलिए' : 'Listening — please speak') :
                   botStatus === 'thinking' ? (lang === 'hi' ? 'प्रोसेस हो रहा है…' : 'Processing…') :
                   (lang === 'hi' ? 'तैयार' : 'Ready')}
                </p>
              </div>

              {/* Live mic VU meter — visual confirmation the mic is capturing sound */}
              {listening && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-end gap-1 h-8">
                    {[0.15, 0.35, 0.6, 0.85, 1.0, 0.85, 0.6, 0.35, 0.15].map((th, i) => (
                      <div key={i}
                        className={`w-1.5 rounded-full transition-all duration-75 ${liveVolume >= th ? 'bg-green-500' : 'bg-green-500/20'}`}
                        style={{ height: `${8 + th * 24}px`, opacity: liveVolume >= th ? 1 : 0.4 }} />
                    ))}
                  </div>
                  <span className="font-label-sm text-label-sm text-green-600">
                    {liveVolume > 0.05 ? (lang === 'hi' ? '🎙️ आवाज़ मिल रही है' : '🎙️ Mic is picking up sound') : (lang === 'hi' ? 'बोलिए…' : 'Speak now…')}
                  </span>
                </div>
              )}

              {/* Live captions */}
              <div className="w-full max-w-2xl flex flex-col gap-3">
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex items-start gap-3 min-h-[76px]">
                  <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">spa</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">{caption || (lang === 'hi' ? 'शुरू करने के लिए नीचे बटन दबाएं।' : 'Tap the button below to begin.')}</p>
                </div>
                {(transcript || listening) && (
                  <div className="bg-surface-container rounded-2xl p-4 shadow-sm flex items-start gap-3 self-end max-w-[85%]">
                    <p className="font-body-md text-body-md text-on-surface">{transcript || (lang === 'hi' ? '…' : '…')}</p>
                    <div className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                    </div>
                  </div>
                )}
              </div>

              {voiceError && (
                <button onClick={retryVoice}
                  className="max-w-2xl text-left bg-error-container/40 text-on-error-container rounded-xl px-4 py-3 font-body-md text-body-md flex items-start gap-2.5 hover:bg-error-container/60 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">error</span>
                  <span>{voiceError} <span className="underline font-medium">{lang === 'hi' ? 'पुनः प्रयास करें' : 'Click to retry'}</span></span>
                </button>
              )}

              {/* Controls */}
              {!started ? (
                <button onClick={begin} className="px-8 sm:px-10 py-5 rounded-full bg-primary text-on-primary font-title-md text-title-md sm:font-headline-sm sm:text-headline-sm shadow-xl hover:bg-primary-container transition-all flex items-center gap-3 animate-pulse text-center">
                  <span className="material-symbols-outlined text-[32px]">mic</span>
                  {lang === 'hi'
                    ? '🎙️ परामर्श शुरू करें — एक बार टैप करें'
                    : '🎙️ Tap Once to Begin Touchless Consultation'}
                </button>
              ) : (
                <button
                  onClick={tapMic}
                  disabled={!listening}
                  className={`px-8 py-4 rounded-full font-title-md text-title-md shadow-lg transition-all flex items-center gap-2.5 ${
                    listening ? 'bg-secondary text-on-secondary hover:opacity-90' : 'bg-surface-container-high text-on-surface-variant cursor-default'}`}
                >
                  <span className="material-symbols-outlined text-[26px]">{listening ? 'stop_circle' : 'mic'}</span>
                  {listening ? (lang === 'hi' ? 'बोलकर हो गया — टैप करें' : 'Done Speaking — Tap') : (lang === 'hi' ? 'हैंड्स-फ्री सुन रहा है' : 'Hands-free active')}
                </button>
              )}

              {/* Progress dots */}
              {started && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {STAGES.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <div className={`h-2.5 rounded-full transition-all ${i < stageIdx ? 'w-8 bg-primary' : i === stageIdx ? 'w-8 bg-primary/60' : 'w-2.5 bg-surface-container-high'}`} />
                      <span className={`font-label-sm text-label-sm ${i === stageIdx ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>{STAGE_LABEL[s][lang]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tap-to-answer fallback — always available so no one gets stuck */}
              {started && (
                <div className="w-full max-w-2xl flex flex-col items-center gap-2.5">
                  {KIOSK_CHIPS[stage] && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {(KIOSK_CHIPS[stage][lang] || KIOSK_CHIPS[stage].en).map(chip => (
                        <button key={chip} onClick={() => acceptAnswer(stage, chip)}
                          className="px-3.5 py-2 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface font-label-md text-label-md shadow-sm transition-colors">
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="w-full flex items-center gap-2">
                    <input
                      value={typedAnswer}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
                      placeholder={lang === 'hi' ? 'शोर हो? यहाँ टाइप करके उत्तर दें…' : 'Noisy? Type your answer here…'}
                      className="flex-1 h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none focus:bg-surface-container"
                    />
                    <button onClick={submitTyped} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      {lang === 'hi' ? 'भेजें' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Side floating QR card */}
        <aside className="lg:w-80 shrink-0 p-6 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-md p-5 flex flex-col items-center gap-4 ring-1 ring-surface-container-high lg:sticky lg:top-6">
            <div className="flex items-center gap-2 self-start">
              <span className="material-symbols-outlined text-primary text-[22px]">qr_code_2</span>
              <div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold leading-none">Touchless Document Upload</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">पर्चा स्कैन करें</p>
              </div>
            </div>

            {docResult && docResult.status === 'ready' ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[36px]">check_circle</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  Document Attached
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">{docResult.ocrData?.documentType || 'Document'}</span>
                {docResult.ocrData?.medicines?.length > 0 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                    {docResult.ocrData.medicines.length} medicine(s) · {docResult.ocrData.abnormalLabValues?.length || 0} lab flag(s)
                  </p>
                )}
              </div>
            ) : docResult && docResult.status === 'processing' ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <span className="material-symbols-outlined text-primary text-[32px] animate-spin">refresh</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Analysing document…</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-sm">
                  <QRCodeSVG value={mobileUrl} size={168} level="M" />
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                  {lang === 'hi' ? 'फ़ोन कैमरे से स्कैन करें और पर्चा/रिपोर्ट अपलोड करें' : 'Scan with your phone camera to upload a prescription or report'}
                </p>
                <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Waiting · {sessionId}</span>
                </div>
              </>
            )}
          </div>

          <button onClick={() => navigate('/text-intake')} className="sm:hidden inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md">
            <span className="material-symbols-outlined text-[18px]">keyboard</span>
            Switch to Text Intake
          </button>
        </aside>
      </main>
    </div>
  );
}

// ── Triage token confirmation card ──────────────────────────────────────────────
function TokenCard({ result, lang, onReset, onDoctor }) {
  const cfg = PRIORITY_CONFIG[result.triageLevel] || PRIORITY_CONFIG.P3;
  const token = result.id ? `AYUSH-${String(result.id).slice(-6).toUpperCase()}` : 'AYUSH-000000';
  return (
    <div className="w-full max-w-lg flex flex-col gap-5">
      <div className="flex items-center gap-3 justify-center text-primary">
        <span className="material-symbols-outlined text-[32px]">task_alt</span>
        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          {lang === 'hi' ? 'ट्राइएज पूर्ण' : 'Triage Complete'}
        </span>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl shadow-xl overflow-hidden ring-1 ring-surface-container-high">
        <div className={`${cfg.bg} px-6 py-6 text-white flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[38px]">{cfg.icon}</span>
            </div>
            <div>
              <div className="font-headline-md text-headline-md font-bold leading-none">{result.triageLevel}</div>
              <div className="font-title-md text-title-md opacity-90">{result.triageLabel || cfg.label}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-label-sm text-label-sm opacity-80 uppercase tracking-wider">Token</div>
            <div className="font-headline-sm text-headline-sm font-bold tracking-widest">{token}</div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Chief Complaint</span>
            <p className="font-body-lg text-body-lg text-on-surface">{result.chiefComplaint}</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { l: 'Dosha', v: result.dosha }, { l: 'Agni', v: result.agni || result.ayurvedicNotes?.agni }, { l: 'Koshtha', v: result.koshtha || result.ayurvedicNotes?.koshtha },
            ].map(x => (
              <div key={x.l} className="bg-surface-container-low rounded-xl p-3 text-center">
                <div className="font-label-sm text-label-sm text-on-surface-variant">{x.l}</div>
                <div className="font-body-sm text-body-sm text-on-surface font-medium">{x.v || '—'}</div>
              </div>
            ))}
          </div>
          <div className="bg-primary/5 rounded-2xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[22px]">hourglass_top</span>
            <p className="font-body-md text-body-md text-on-surface">
              {lang === 'hi' ? 'कृपया अपने टोकन नंबर के बुलाए जाने की प्रतीक्षा करें।' : 'Please wait for your token number to be called.'}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <button onClick={onReset} className="flex-1 px-5 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[22px]">person_add</span>
            {lang === 'hi' ? 'अगला मरीज़' : 'Next Patient'}
          </button>
          <button onClick={onDoctor} className="px-5 py-3.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">stethoscope</span>
            Doctor Dashboard
            <span className="px-1.5 py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary">Staff</span>
          </button>
        </div>
      </div>
    </div>
  );
}
