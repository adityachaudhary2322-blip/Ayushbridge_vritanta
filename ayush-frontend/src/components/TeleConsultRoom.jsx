import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sarvamTTS, recordUntilSilence, stopSarvamAudio } from '../utils/sarvam';
import { TELECONSULT_LANGUAGES, coerceTeleconsultLang, uiVariant } from '../utils/languages';
import { BrandMark, OfficialStrip, ThemeToggle } from './Brand';

const STAGES = ['name', 'ageGender', 'complaint', 'has_documents', 'agni', 'sleep', 'energy', 'history'];

const DOC_Q = {
  en: 'Do you have any past prescription or lab test report you would like to scan?',
  hi: 'क्या आपके पास कोई पुरानी डॉक्टर की पर्ची या लैब रिपोर्ट है जिसे आप अपलोड करना चाहते हैं?',
};
function detectDocIntent(text) {
  const tl = (text || '').toLowerCase();
  if (/हाँ|हां|haan|\bha\b|\byes\b|scan|पर्ची|पर्चा|pardi|pardhi|report|रिपोर्ट/.test(tl)) return 'yes';
  if (/नहीं|नही|nahi|nahin|\bno\b|skip|आगे|छोड़/.test(tl)) return 'no';
  return null;
}

const Q = {
  name:      { en: 'Hello, I am Dr. AYUSH AI Vaidya. To begin, please tell me your full name.',        hi: 'नमस्ते, मैं डॉक्टर आयुष एआई वैद्य हूँ। शुरू करने के लिए कृपया अपना पूरा नाम बताएं।' },
  ageGender: { en: 'Thank you. What is your age and gender?',                                            hi: 'धन्यवाद। आपकी उम्र और लिंग क्या है?' },
  complaint: { en: 'What health problem are you facing, and since how many days?',                       hi: 'आपको क्या स्वास्थ्य समस्या है, और कितने दिनों से है?' },
  agni:      { en: 'How is your appetite and digestion? Any constipation or irregular bowels?',          hi: 'आपकी भूख और पाचन कैसा है? कब्ज या अनियमित पेट तो नहीं?' },
  sleep:     { en: 'How is your sleep quality? Do you experience broken sleep, insomnia, or high stress and anxiety?', hi: 'आपकी नींद कैसी है — क्या रात में नींद टूटती है या अत्यधिक तनाव व चिंता महसूस होती है?' },
  energy:    { en: 'How is your daily energy level — excessive fatigue, lethargy, or normal? Do you stay well-hydrated?', hi: 'दिनभर आपका ऊर्जा स्तर कैसा रहता है — अत्यधिक सुस्ती, कमजोरी या सामान्य? क्या पर्याप्त पानी पीते हैं?' },
  history:   { en: 'Do you have any pre-existing conditions — Diabetes, Hypertension, Thyroid, asthma, or drug allergies?', hi: 'क्या आपको पहले से कोई पुरानी बीमारी है — जैसे बीपी, शुगर, थायराइड, सांस फूलना या किसी दवा से एलर्जी?' },
};
const REPROMPT = { en: 'Please speak a bit louder.', hi: 'कृपया थोड़ा ज़ोर से बोलें।' };
const STAGE_LABEL = {
  name: { en: 'Name', hi: 'नाम' }, ageGender: { en: 'Age & Gender', hi: 'उम्र व लिंग' },
  complaint: { en: 'Chief Complaint', hi: 'मुख्य तकलीफ' }, has_documents: { en: 'Documents', hi: 'दस्तावेज़' },
  agni: { en: 'Agni & Koshtha', hi: 'अग्नि व कोष्ठ' },
  sleep: { en: 'Sleep & Stress', hi: 'निद्रा व मानस' }, energy: { en: 'Energy & Vitality', hi: 'बल व ऊर्जा' },
  history: { en: 'Chronic History', hi: 'पुरानी बीमारी' },
};
const IVR_PROMPT = 'नमस्ते! हिंदी के लिए 1 दबाएं या बोलें। For English, press or say 2.';

// Tap-to-answer fallback chips per stage (noisy room / mic failure escape hatch).
const TELE_CHIPS = {
  ageGender: { en: ['Male', 'Female', 'Other'], hi: ['पुरुष (Male)', 'महिला (Female)', 'अन्य (Other)'] },
  complaint: { en: ['Abdominal pain', 'Acidity / Heartburn', 'Joint pain', 'Headache & fatigue'], hi: ['पेट दर्द', 'खट्टी डकार व जलन', 'जोड़ों का दर्द', 'सिरदर्द व थकान'] },
  agni: { en: ['Low appetite (Manda)', 'Normal (Sama)', 'Constipation (Krura)', 'Acidity (Amla)'], hi: ['भूख कम (Manda)', 'पाचन ठीक (Sama)', 'कब्ज (Krura)', 'खट्टी डकारें (Amla)'] },
  sleep: { en: ['Sound Sleep', 'Disturbed Sleep', 'Insomnia / High Stress'], hi: ['गहरी नींद (Sound)', 'नींद में बाधा (Disturbed)', 'अनिद्रा व तनाव (Insomnia)'] },
  energy: { en: ['Normal Energy', 'Sluggish / Lethargic', 'Severe Weakness'], hi: ['ऊर्जा सामान्य (Normal)', 'भारीपन व सुस्ती (Lethargy)', 'अत्यधिक कमजोरी (Fatigue)'] },
  history: { en: ['No Pre-existing Conditions', 'Hypertension / High BP', 'Diabetes / Sugar', 'Respiratory / Allergy'], hi: ['कोई पुरानी बीमारी नहीं', 'उच्च रक्तचाप (BP)', 'मधुमेह (Diabetes)', 'सांस/एलर्जी'] },
};

const PRIORITY_CONFIG = {
  P1: { bg: 'bg-rose-800', label: 'Critical', icon: 'emergency' },
  P2: { bg: 'bg-amber-700', label: 'Urgent', icon: 'priority_high' },
  P3: { bg: 'bg-[#57534e]', label: 'Moderate', icon: 'schedule' },
  P4: { bg: 'bg-emerald-800', label: 'Routine', icon: 'check_circle' },
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

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
function detectLangChoice(t) {
  const tl = t.toLowerCase();
  if (/\b1\b|एक|hindi|हिंदी/.test(tl)) return 'hi';
  if (/\b2\b|दो|two|english|इंग्लिश|अंग्रे/.test(tl)) return 'en';
  return null;
}

export default function TeleConsultRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room') || `AYUSH-${Date.now().toString().slice(-4)}`;

  const [phase, setPhase] = useState('waiting');   // waiting | admitted | ivr | interview | complete
  const [countdown, setCountdown] = useState(5);
  const [lang, setLang] = useState('en');
  const [botStatus, setBotStatus] = useState('idle'); // idle|speaking|listening|thinking
  const [caption, setCaption] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [voiceError, setVoiceError] = useState('');   // distinct API/mic error banner
  const [liveVolume, setLiveVolume] = useState(0);     // 0..1 live mic VU meter
  const [typedAnswer, setTypedAnswer] = useState('');
  const [stage, setStage] = useState('name');
  const [fields, setFields] = useState({ name: '', age: '', gender: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });
  const [triageResult, setTriageResult] = useState(null);
  const [audioOutputMode, setAudioOutputMode] = useState('speaker'); // 'speaker' | 'earpiece'
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callNotes, setCallNotes] = useState('');     // physician's notes, saved with the record
  const mutedRef = useRef(false);
  const onHoldRef = useRef(false);
  const callNotesRef = useRef('');
  const [docChoice, setDocChoice] = useState('none'); // 'none' | 'ask' | 'yes' (document inquiry)
  const [docResult, setDocResult] = useState(null);
  const docAdvancedRef = useRef(false);
  const pollRef = useRef(null);
  const [sessionId] = useState(() => 'SES-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const mobileUrl = `${window.location.origin}/mobile-scan?sid=${sessionId}`;

  const recRef = useRef(null);
  const langRef = useRef('en');
  const langChosenRef = useRef(false);
  const stageRef = useRef('name');
  const stageTokenRef = useRef(0);
  const fieldsRef = useRef({ name: '', age: '', gender: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });

  // Audio-singleton + StrictMode guards
  const activeAudioRef = useRef(null);
  const isMountedRef = useRef(false);
  const runIdRef = useRef(0);
  const audioOutputModeRef = useRef('speaker');
  const earpieceSinkRef = useRef(null);

  const alive = (run) => isMountedRef.current && runIdRef.current === run;
  const stageAlive = (token) => isMountedRef.current && stageTokenRef.current === token;

  const netErr = () => setVoiceError(langRef.current === 'hi'
    ? '⚠️ वॉयस सेवा त्रुटि — कृपया दोबारा प्रयास करें या नीचे टाइप/टैप करें।'
    : '⚠️ Voice Service Error reaching TTS — retry or type/tap your answer below.');

  const stopRec = () => { if (recRef.current?.state === 'recording') recRef.current.stop(); };

  // Mute / Hold pause the interview loop: bumping the stage token orphans any
  // in-flight speak→listen chain, and resuming re-asks the current question.
  const pauseInterview = () => {
    stageTokenRef.current++;
    stopRec();
    setLiveVolume(0);
    setBotStatus('idle');
  };
  const resumeInterview = () => {
    if (mutedRef.current || onHoldRef.current || phase !== 'interview' || triageResult) return;
    setVoiceError('');
    const token = ++stageTokenRef.current;
    if (stageRef.current === 'has_documents') runDocStage(token);
    else askAndListen(stageRef.current, 0, token);
  };
  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) pauseInterview(); else resumeInterview();
  };
  const toggleHold = () => {
    const next = !onHoldRef.current;
    onHoldRef.current = next;
    setOnHold(next);
    if (next) { stopSarvamAudio(); pauseInterview(); } else resumeInterview();
  };

  // Bot speech — cancels any prior audio (singleton), cuts the mic first so the
  // bot's own voice can never be recorded, and routes to speaker/earpiece.
  const speak = async (text, forceLang) => {
    stopRec(); // strict mic cutoff during playback
    setBotStatus('speaking');
    setCaption(text);
    await sarvamTTS(text, coerceTeleconsultLang(forceLang || langRef.current), {
      onNetworkError: netErr,
      volume: audioOutputModeRef.current === 'earpiece' ? 0.35 : 1.0,
      sinkId: audioOutputModeRef.current === 'earpiece' ? (earpieceSinkRef.current || undefined) : 'default',
      audioRef: activeAudioRef,
    });
  };

  // Resolves to { status: 'ok'|'empty'|'error', text, code, msg }
  const listenOnce = ({ initialWaitMs = 5000, trailingSilenceMs = 2000, maxRecordMs = 9000, langCode } = {}) => new Promise((resolve) => {
    setBotStatus('listening');
    setTranscript('');
    setLiveVolume(0);
    recordUntilSilence({
      initialWaitMs, trailingSilenceMs, maxRecordMs, langCode,
      onVolumeChange: (v) => setLiveVolume(v),
      onStop: () => { setBotStatus('thinking'); setLiveVolume(0); },
      onResult: (t) => resolve({ status: t ? 'ok' : 'empty', text: t }),
      onError: (code, msg) => resolve({ status: 'error', code, msg }),
    }).then((rec) => { recRef.current = rec; });
  });

  // IVR voice detection OR the on-screen buttons
  // A call is Hindi/English ONLY — the physician has to follow it live, so any
  // regional code (deep link, stale kiosk hand-off, mis-detected IVR reply) is
  // collapsed here rather than being allowed through to STT/TTS.
  const chooseLang = (l) => {
    if (langChosenRef.current) return;
    langChosenRef.current = true;
    const safe = uiVariant(coerceTeleconsultLang(l));
    langRef.current = safe;
    setLang(safe);
    setVoiceError('');
    stopRec(); // cancel any in-progress voice detection for this step
    setBotStatus('idle');
    startInterview(); // begin the clinical interview in the chosen language
  };

  // Speaker <-> earpiece routing toggle
  const toggleAudioOutput = async () => {
    const next = audioOutputModeRef.current === 'speaker' ? 'earpiece' : 'speaker';
    audioOutputModeRef.current = next;
    setAudioOutputMode(next);
    const audio = activeAudioRef.current;
    if (next === 'earpiece') {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        const ep = devices?.find(d => d.kind === 'audiooutput' &&
          (d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('receiver') || d.deviceId === 'communications'));
        if (ep) earpieceSinkRef.current = ep.deviceId;
      } catch { /* ignore */ }
      if (audio) {
        audio.volume = 0.35;
        if (typeof audio.setSinkId === 'function' && earpieceSinkRef.current) audio.setSinkId(earpieceSinkRef.current).catch(() => {});
      }
    } else {
      earpieceSinkRef.current = null;
      if (audio) {
        audio.volume = 1.0;
        if (typeof audio.setSinkId === 'function') audio.setSinkId('default').catch(() => {});
      }
    }
  };

  const storeAnswer = (stageKey, text) => {
    const f = { ...fieldsRef.current };
    if (stageKey === 'name') f.name = text;
    else if (stageKey === 'ageGender') {
      const n = text.match(/\d{1,3}/); if (n) f.age = n[0];
      f.gender = parseGender(text);
    } else if (stageKey === 'complaint') f.complaint = text;
    else if (stageKey === 'agni') { const { agni, koshtha } = parseDigestion(text); f.agni = agni; f.koshtha = koshtha; }
    else if (stageKey === 'sleep') f.sleep_stress = text;
    else if (stageKey === 'energy') f.energy_lifestyle = text;
    else if (stageKey === 'history') f.chronic_history = text;
    fieldsRef.current = f;
    setFields(f);
  };

  const submitTriage = async () => {
    setPhase('complete'); setBotStatus('thinking');
    const f = fieldsRef.current;
    const done = langRef.current === 'hi'
      ? 'धन्यवाद! आपका परामर्श पूरा हुआ। रिपोर्ट डॉक्टर को भेज दी गई है।'
      : 'Thank you! Your consultation is complete. Your report has been sent to the doctor.';
    speak(done);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: `PT${Date.now()}`,
          name: f.name, age: f.age, gender: f.gender,
          symptoms: f.complaint, agni: f.agni, koshtha: f.koshtha,
          sleep_stress: f.sleep_stress, energy_lifestyle: f.energy_lifestyle, chronic_history: f.chronic_history,
          sessionId, lang: coerceTeleconsultLang(langRef.current), room,
          triageSource: 'Telephony Voice Call', callNotes: callNotesRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTriageResult(data.record || data);
    } catch (err) {
      console.warn('[teleconsult triage]', err.message);
      setTriageResult({
        id: `PT${Date.now()}`, name: f.name || 'Anonymous',
        triageLevel: 'P3', triageLabel: 'Moderate',
        chiefComplaint: f.complaint || 'General consultation',
        agni: f.agni || 'Vishama', koshtha: f.koshtha || 'Madhyama', dosha: 'Tridosha',
        recommendation: 'Standard Ayurvedic consultation advised.',
      });
    } finally {
      setBotStatus('idle');
    }
  };

  // IVR: prompt + listen for a spoken 1/2. Buttons (chooseLang) can fire any time.
  const runIVR = async (run) => {
    setPhase('ivr');
    await speak(IVR_PROMPT, 'hi');
    let tries = 0;
    while (!langChosenRef.current && tries < 2 && alive(run)) {
      const r = await listenOnce({ langCode: 'unknown', maxRecordMs: 7000 });
      if (langChosenRef.current) return;      // a button was tapped mid-listen
      if (r.status === 'error') {
        setVoiceError(langRef.current === 'hi'
          ? '⚠️ वॉयस सेवा त्रुटि — कृपया नीचे 1 या 2 बटन दबाएं।'
          : '⚠️ Voice Service Error — please press button 1 or 2 below.');
        return; // buttons remain; do not auto-default on an API error
      }
      const l = r.text && detectLangChoice(r.text);
      if (l) { chooseLang(l); return; }
      tries++;
      if (!langChosenRef.current && tries < 2 && alive(run)) {
        await speak('कृपया 1 या 2 कहें। Please say 1 or 2.', 'hi');
      }
    }
    if (!langChosenRef.current && alive(run)) chooseLang('hi'); // sensible default after silence
  };

  // ── Resumable interview stage machine (voice OR chip/text advances any step) ────
  const acceptAnswer = (stageKey, text) => {
    const t = (text || '').trim();
    if (!t) return;
    stopRec();
    stopSarvamAudio();
    setLiveVolume(0); setVoiceError(''); setTypedAnswer('');
    storeAnswer(stageKey, t);
    setTranscript(t);
    const next = STAGES[STAGES.indexOf(stageKey) + 1];
    if (next) goToStage(next);
    else submitTriage();
  };

  async function askAndListen(stageKey, attempt, token) {
    if (!stageAlive(token) || onHoldRef.current) return;
    const code = coerceTeleconsultLang(langRef.current);
    await speak(attempt === 0 ? Q[stageKey][langRef.current] : REPROMPT[langRef.current]);
    if (!stageAlive(token)) return;
    if (mutedRef.current) { setBotStatus('idle'); return; } // muted: ask, but don't open the mic
    const r = await listenOnce({ langCode: code });
    if (!stageAlive(token)) return; // a chip/text tap already advanced
    if (r.status === 'ok') { acceptAnswer(stageKey, r.text); return; }
    if (r.status === 'error') {
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
    // empty → the patient didn't speak / not recognized → "speak louder" + retry once
    if (attempt < 2) { askAndListen(stageKey, attempt + 1, token); }
    else { setBotStatus('idle'); }
  }

  function goToStage(stageKey) {
    const token = ++stageTokenRef.current;
    stageRef.current = stageKey; setStage(stageKey);
    if (stageKey === 'has_documents') { runDocStage(token); return; }
    askAndListen(stageKey, 0, token);
  }

  function startInterview() {
    setPhase('interview');
    goToStage(STAGES[0]);
  }

  const advanceFromDocs = () => {
    setDocChoice('none');
    const next = STAGES[STAGES.indexOf('has_documents') + 1];
    if (next) goToStage(next); else submitTriage();
  };

  async function runDocStage(token) {
    docAdvancedRef.current = false;
    setDocChoice('ask');
    setTranscript('');
    if (onHoldRef.current) return;
    await speak(DOC_Q[langRef.current], langRef.current);
    if (!stageAlive(token)) return;
    if (mutedRef.current) { setBotStatus('idle'); return; }
    const r = await listenOnce({ langCode: coerceTeleconsultLang(langRef.current) });
    if (!stageAlive(token)) return;
    if (r.status === 'ok') {
      const intent = detectDocIntent(r.text);
      if (intent === 'yes') { docYes(); return; }
      if (intent === 'no') { docNo(); return; }
      setBotStatus('idle'); return;
    }
    if (r.status === 'error') {
      setBotStatus('idle');
      setVoiceError(langRef.current === 'hi' ? '⚠️ वॉयस सेवा त्रुटि — कृपया नीचे बटन दबाएं।' : '⚠️ Voice Service Error — please tap a button below.');
      return;
    }
    setBotStatus('idle');
  }
  const docYes = () => { stopRec(); stopSarvamAudio(); setLiveVolume(0); setVoiceError(''); docAdvancedRef.current = false; setDocChoice('yes'); setBotStatus('idle'); };
  const docNo = () => { stopRec(); stopSarvamAudio(); setLiveVolume(0); setVoiceError(''); advanceFromDocs(); };

  const retryVoice = () => {
    setVoiceError('');
    if (stageRef.current === 'has_documents') { runDocStage(stageTokenRef.current); return; }
    askAndListen(stageRef.current, 0, stageTokenRef.current);
  };
  const submitTyped = () => acceptAnswer(stageRef.current, typedAnswer);

  const runFlow = async (run) => {
    for (let c = 5; c >= 1; c--) {
      if (!alive(run)) return;
      setCountdown(c);
      await wait(1000);
    }
    if (!alive(run)) return;
    setCountdown(0);
    setPhase('admitted');
    await wait(1400);
    if (!alive(run)) return;
    await runIVR(run);   // chooseLang() starts the interview when a language is picked
  };

  const endCall = () => {
    isMountedRef.current = false;
    stopSarvamAudio();
    stopRec();
    navigate('/');
  };

  // Call duration timer — starts once the patient is connected.
  useEffect(() => {
    if (phase === 'waiting' || phase === 'admitted' || triageResult) return undefined;
    const id = setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, triageResult]);

  // Poll for a mobile document upload tied to this session
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session-docs/${sessionId}`);
        const data = await res.json();
        if (data.status === 'ready') { setDocResult(data); clearInterval(pollRef.current); }
        else if (data.status === 'processing') setDocResult(data);
      } catch { /* keep polling */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upload lands during the inquiry stage → chips shown, then GUARANTEE an advance
  // so the call can never stay stuck (manual green button also available).
  useEffect(() => {
    if (docChoice === 'yes' && stage === 'has_documents' && docResult?.status === 'ready' && !docAdvancedRef.current) {
      docAdvancedRef.current = true;
      const t = setTimeout(() => advanceFromDocs(), 2500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docResult, docChoice, stage]);

  useEffect(() => {
    isMountedRef.current = true;
    const myRun = ++runIdRef.current;    // new token each mount → StrictMode's first run is orphaned
    runFlow(myRun);
    return () => {
      isMountedRef.current = false;
      stopSarvamAudio();
      stopRec();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaking = botStatus === 'speaking';
  const listening = botStatus === 'listening';
  const stageIdx = STAGES.indexOf(stage);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col relative overflow-hidden">

      <style>{`
        @keyframes call-wave { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
      `}</style>

      {/* Top status bar */}
      <OfficialStrip />
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16 bg-stone-950/80 backdrop-blur-sm border-b border-stone-800">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark compact />
          <span className="hidden sm:block w-px h-8 bg-stone-800" aria-hidden="true" />
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${onHold ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
          <span className="font-label-md text-label-md text-amber-400 truncate">📞 Telephony Voice Consultation · <span className="text-stone-200">Line {room}</span></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {phase !== 'waiting' && phase !== 'admitted' && (
            <>
              <span className="px-2.5 py-1 rounded-full bg-stone-800/70 font-label-sm text-label-sm text-stone-300 tabular-nums">{formatDuration(callSeconds)}</span>
              <span className="hidden sm:inline px-2.5 py-1 rounded-full bg-stone-800/70 font-label-sm text-label-sm text-stone-300">{lang === 'hi' ? 'हिंदी' : 'English'}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
      {/* Main call area */}
      <div className="flex-1 relative flex items-start justify-center p-4 sm:p-8 min-h-[780px]">

        {/* Audio call card: AI Vaidya */}
        <div className="w-full max-w-2xl bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl flex flex-col items-center gap-5 px-6 pt-10 pb-8 relative overflow-hidden">
          <div className="relative flex items-center justify-center">
            {(speaking || listening) && !onHold && (
              <>
                <div className={`absolute w-44 h-44 rounded-full ${speaking ? 'bg-primary/20' : 'bg-tertiary/20'} animate-ping`} />
                <div className={`absolute w-36 h-36 rounded-full ${speaking ? 'bg-primary/25' : 'bg-tertiary/25'} animate-pulse`} />
              </>
            )}
            <div className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              onHold ? 'bg-amber-700' : speaking ? 'bg-emerald-700 scale-105' : listening ? 'bg-emerald-600' : botStatus === 'thinking' ? 'bg-amber-700' : 'bg-[#57534e]'}`}>
              <span className="material-symbols-outlined text-[52px] text-white">
                {onHold ? 'phone_paused' : speaking ? 'record_voice_over' : listening ? 'hearing' : botStatus === 'thinking' ? 'psychology' : 'call'}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-title-md text-title-md text-amber-400 font-semibold">Dr. AYUSH AI Vaidya</div>
            <div className="font-label-md text-label-md text-emerald-300">
              {onHold ? (lang === 'hi' ? 'कॉल होल्ड पर है' : 'Call on hold') :
               speaking ? (lang === 'hi' ? 'बोल रहे हैं…' : 'Speaking…') :
               muted ? (lang === 'hi' ? 'आपका माइक म्यूट है' : 'Your microphone is muted') :
               listening ? (lang === 'hi' ? 'सुन रहे हैं…' : 'Listening…') :
               botStatus === 'thinking' ? (lang === 'hi' ? 'प्रोसेस हो रहा है…' : 'Processing…') :
               (lang === 'hi' ? 'कॉल जुड़ी है' : 'Connected')}
            </div>
          </div>

          {/* Voice waveform: live mic level while listening, animated while the Vaidya speaks */}
          <div className="flex items-center gap-1 h-14" aria-hidden="true">
            {WAVE_BARS.map((w, i) => {
              const active = !onHold && (speaking || (listening && !muted));
              const level = listening ? Math.max(0.12, Math.min(1, liveVolume * 1.6 * w)) : 0.12;
              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full origin-center ${speaking ? 'bg-amber-400' : listening ? 'bg-emerald-400' : 'bg-stone-700'}`}
                  style={speaking && active
                    ? { height: `${16 + w * 40}px`, animation: `call-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.05}s infinite` }
                    : { height: `${8 + (active ? level : 0.12) * 48}px`, transition: 'height 80ms linear' }}
                />
              );
            })}
          </div>

          {/* Live subtitles */}
          <div className="w-full flex flex-col gap-2 items-center min-h-[96px]">
            {caption && (
              <div className="max-w-xl bg-stone-950/70 border border-stone-800 rounded-xl px-4 py-2.5 text-center">
                <p className="font-body-md text-body-md text-stone-100">{caption}</p>
              </div>
            )}
            {transcript && (
              <div className="max-w-xl bg-primary/70 rounded-xl px-4 py-2 text-center">
                <p className="font-body-sm text-body-sm text-white">🗣️ {transcript}</p>
              </div>
            )}
          </div>
        </div>

        {/* IVR language buttons */}
        {phase === 'ivr' && !triageResult && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              {/* Rendered from TELECONSULT_LANGUAGES — a call can only ever offer these two. */}
              {TELECONSULT_LANGUAGES.map((l, i) => (
                <button
                  key={l.code}
                  onClick={() => chooseLang(l.code)}
                  className={`px-6 py-4 rounded-2xl font-title-md text-title-md shadow-lg transition-all flex items-center gap-2 ${
                    i === 0 ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'border border-amber-600/50 bg-stone-900 text-amber-300 hover:bg-stone-800'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-white/20' : 'bg-amber-500/15'}`}>{i + 1}</span>
                  {l.native}{l.native === l.name ? '' : ` (${l.name})`}
                </button>
              ))}
            </div>
            <p className="font-label-md text-label-md text-stone-400">{lang === 'hi' ? 'बोलें या दबाएं' : 'Press or say 1 / 2'}</p>
          </div>
        )}

        {/* Interview progress */}
        {phase === 'interview' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s} className={`h-2 rounded-full transition-all ${i < stageIdx ? 'w-6 bg-emerald-600' : i === stageIdx ? 'w-6 bg-amber-500' : 'w-2 bg-stone-700'}`} />
            ))}
            <span className="ml-2 font-label-sm text-label-sm text-stone-400">{STAGE_LABEL[stage][lang]}</span>
          </div>
        )}

        {/* Distinct voice-service error banner (click to retry) */}
        {voiceError && (
          <button onClick={retryVoice}
            className="absolute top-14 left-1/2 -translate-x-1/2 max-w-lg text-left bg-red-600/90 text-white rounded-xl px-4 py-2.5 font-body-sm text-body-sm flex items-start gap-2 hover:bg-red-700/90 transition-colors">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <span>{voiceError} <span className="underline">{lang === 'hi' ? 'पुनः प्रयास' : 'Retry'}</span></span>
          </button>
        )}

        {/* Document inquiry stage — Yes/No, then QR + extracted chips */}
        {phase === 'interview' && stage === 'has_documents' && !triageResult && (
          <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-3 px-4">
            {docChoice !== 'yes' ? (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button onClick={docYes} className="px-5 py-3.5 rounded-2xl bg-emerald-700 text-white font-title-md text-title-md shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                  {lang === 'hi' ? '📄 हाँ, पर्ची स्कैन करें' : '📄 Yes, Scan Document'}
                </button>
                <button onClick={docNo} className="px-5 py-3.5 rounded-2xl bg-stone-800 text-stone-100 font-title-md text-title-md backdrop-blur-sm hover:bg-stone-700 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px]">skip_next</span>
                  {lang === 'hi' ? '⏭️ नहीं, आगे बढ़ें' : '⏭️ No, Skip & Continue'}
                </button>
              </div>
            ) : (
              <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-col items-center gap-2.5 max-w-sm">
                {docResult?.status === 'ready' ? (
                  <div className="flex flex-col items-center gap-3 text-stone-100">
                    <div className="flex items-center gap-2 text-green-600">
                      <span className="material-symbols-outlined text-[22px]">check_circle</span>
                      <span className="font-title-md text-title-md font-semibold">{lang === 'hi' ? 'दस्तावेज़ मिला!' : 'Document Received!'}</span>
                    </div>
                    {docResult.ocrData?.medicines?.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {docResult.ocrData.medicines.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-label-sm text-label-sm">
                            <span className="material-symbols-outlined text-[13px]">medication</span>{m.name}{m.dosage ? ` — ${m.dosage}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Guaranteed manual advance — patient is never trapped */}
                    <button onClick={advanceFromDocs} className="px-5 py-3 rounded-xl bg-green-600 text-white font-label-lg text-label-lg shadow-md hover:bg-green-700 transition-colors flex items-center gap-2">
                      {lang === 'hi' ? 'आगे बढ़ें: अग्नि एवं कोष्ठ' : 'Continue to Agni & Koshtha'}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-body-sm text-body-sm text-stone-300 text-center">{lang === 'hi' ? 'फ़ोन कैमरे से यह QR स्कैन करें।' : 'Scan this QR with your phone camera.'}</p>
                    <div className="p-2 bg-white rounded-md"><QRCodeSVG value={mobileUrl} size={150} level="M" /></div>
                    <button onClick={advanceFromDocs} className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-label-md text-label-md hover:bg-emerald-600 transition-colors flex items-center gap-1.5">
                      {lang === 'hi' ? 'आगे बढ़ें' : 'Continue Intake'}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Interview chip / text fallback — noisy room or mic failure escape hatch (not on doc stage) */}
        {phase === 'interview' && !triageResult && stage !== 'has_documents' && !onHold && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-2.5 px-4">
            {TELE_CHIPS[stage] && (
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                {(TELE_CHIPS[stage][lang] || TELE_CHIPS[stage].en).map(chip => (
                  <button key={chip} onClick={() => acceptAnswer(stage, chip)}
                    className="px-3.5 py-2 rounded-full bg-stone-800 hover:bg-emerald-700 hover:text-white text-stone-100 font-label-md text-label-md backdrop-blur-sm transition-colors">
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <div className="w-full max-w-md flex items-center gap-2">
              <input
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
                placeholder={lang === 'hi' ? 'शोर हो? यहाँ टाइप करें…' : 'Noisy? Type your answer…'}
                className="flex-1 h-11 px-4 rounded-md bg-stone-950 border border-stone-700 text-stone-100 placeholder:text-stone-600 font-body-md text-body-md focus:outline-none focus:border-emerald-600"
              />
              <button onClick={submitTyped} className="h-11 px-4 rounded-xl bg-emerald-700 text-white font-label-md text-label-md hover:bg-emerald-600 transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        )}

        {/* Waiting room overlay */}
        {(phase === 'waiting' || phase === 'admitted') && (
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-stone-800 rounded-3xl shadow-2xl px-10 py-12 flex flex-col items-center gap-5 border border-stone-700 max-w-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[36px]">stethoscope</span>
              </div>
              {phase === 'waiting' ? (
                <>
                  <h2 className="font-headline-sm text-headline-sm text-stone-100 font-semibold">Connecting to Dr. AYUSH AI Vaidya…</h2>
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="font-headline-lg text-headline-lg text-primary font-bold text-[56px]">{countdown}</span>
                    </div>
                  </div>
                  <p className="font-body-md text-body-md text-stone-400">Please wait in the consultation room…</p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-primary text-[52px]">check_circle</span>
                  <h2 className="font-headline-sm text-headline-sm text-stone-100 font-semibold">Host admitted you to the consultation</h2>
                  <p className="font-body-md text-body-md text-stone-400">Starting your session…</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Completion summary overlay */}
        {triageResult && (
          <div className="absolute inset-0 bg-stone-950/92 backdrop-blur-sm flex items-center justify-center z-20 p-4">
            <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-xl w-full max-w-lg overflow-hidden">
              <TeleSummary result={triageResult} lang={lang} />
              <div className="p-5 flex gap-3 border-t border-stone-800">
                <button onClick={endCall} className="flex-1 px-5 py-3.5 rounded-xl bg-red-600 text-white font-label-lg text-label-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">call_end</span>
                  {lang === 'hi' ? 'कॉल समाप्त करें' : 'End Call'}
                </button>
                <button onClick={() => navigate('/doctor')} className="px-5 py-3.5 rounded-md border border-stone-700 text-stone-200 font-label-md text-label-md hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">stethoscope</span>Doctor View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Doctor clinical notes — live structured capture plus free-text notes */}
      {phase !== 'waiting' && phase !== 'admitted' && (
        <aside className="lg:w-80 shrink-0 bg-stone-900 border-t-2 lg:border-t-0 lg:border-l-2 border-amber-500 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[20px]">clinical_notes</span>
            <span className="font-title-md text-title-md text-amber-400 font-semibold">Doctor Clinical Notes</span>
          </div>
          <dl className="flex flex-col gap-1.5 rounded-xl bg-stone-800/40 p-3 font-body-sm text-body-sm">
            {[
              ['Name', fields.name],
              ['Age / Gender', [fields.age, fields.gender].filter(Boolean).join(' / ')],
              ['Complaint', fields.complaint],
              ['Agni / Koshtha', [fields.agni, fields.koshtha].filter(Boolean).join(' / ')],
              ['Nidra & Manas', fields.sleep_stress],
              ['Bala', fields.energy_lifestyle],
              ['Purva Vyadhi', fields.chronic_history],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-stone-500">{k}</dt>
                <dd className="text-stone-200 break-words min-w-0">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-stone-400 uppercase tracking-wide">Physician notes</span>
            <textarea
              rows={6}
              value={callNotes}
              disabled={phase === 'complete'}
              onChange={(e) => { setCallNotes(e.target.value); callNotesRef.current = e.target.value; }}
              placeholder="Voice quality, patient's tone, observations to verify at OPD…"
              className="w-full rounded-xl bg-stone-950 border border-stone-700 px-3 py-2 font-body-sm text-body-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <span className="font-label-sm text-label-sm text-stone-500">
              {phase === 'complete' ? 'Saved with the patient record.' : 'Saved with the patient record when the call summary is generated.'}
            </span>
          </label>
        </aside>
      )}
      </div>

      {/* Bottom audio call controls */}
      {!triageResult && phase !== 'waiting' && phase !== 'admitted' && (
        <div className="flex flex-col items-center gap-2 py-4 border-t border-stone-800 bg-stone-950/70">
          <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
            <CallControl
              icon={muted ? 'mic_off' : 'mic'}
              label={muted ? 'Unmute' : 'Mute'}
              active={muted}
              disabled={phase !== 'interview'}
              onClick={toggleMute}
            />
            <CallControl
              icon={onHold ? 'play_arrow' : 'pause'}
              label={onHold ? 'Resume' : 'Hold'}
              active={onHold}
              disabled={phase !== 'interview'}
              onClick={toggleHold}
            />
            <CallControl
              icon={audioOutputMode === 'speaker' ? 'volume_up' : 'phone_in_talk'}
              label={audioOutputMode === 'speaker' ? 'Speaker' : 'Earpiece'}
              active={audioOutputMode === 'earpiece'}
              onClick={toggleAudioOutput}
            />
            <CallControl icon="call_end" label="End Call" danger onClick={endCall} />
          </div>
          <p className="font-label-sm text-label-sm text-stone-500">फोन कान पर लगाकर बात करें / Hold phone near ear</p>
        </div>
      )}
    </div>
  );
}

// Relative heights for the waveform bars (symmetrical envelope).
const WAVE_BARS = [0.3, 0.5, 0.75, 0.55, 0.9, 0.65, 1, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.45, 0.6, 0.3];

function formatDuration(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function CallControl({ icon, label, onClick, active = false, danger = false, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed group">
      <span className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
        danger ? 'bg-red-600 group-hover:bg-red-700 text-white'
          : active ? 'bg-amber-500 text-stone-950'
          : 'bg-stone-800 group-hover:bg-stone-700 text-stone-100'}`}>
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </span>
      <span className="font-label-sm text-label-sm text-stone-300">{label}</span>
    </button>
  );
}

function TeleSummary({ result, lang }) {
  const cfg = PRIORITY_CONFIG[result.triageLevel] || PRIORITY_CONFIG.P3;
  const token = result.token || (result.id ? `AYUSH-${String(result.id).slice(-6).toUpperCase()}` : 'AYUSH-000000');
  return (
    <div>
      <div className={`${cfg.bg} px-6 py-5 text-white flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[32px]">{cfg.icon}</span>
          <div>
            <div className="font-headline-sm text-headline-sm font-bold leading-none">{result.triageLevel} — {result.triageLabel || cfg.label}</div>
            <div className="font-label-sm text-label-sm opacity-90">{lang === 'hi' ? 'ट्राइएज परिणाम' : 'Triage result'}</div>
          </div>
        </div>
        <div className="text-right px-3 py-1.5 rounded-xl bg-amber-500 ring-2 ring-white/70">
          <div className="font-label-sm text-label-sm opacity-90">Token</div>
          <div className="font-title-md text-title-md font-bold tracking-wider">{token}</div>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-3">
        <div>
          <span className="font-label-sm text-label-sm text-stone-500 uppercase tracking-wide">Chief Complaint</span>
          <p className="font-body-lg text-body-lg text-stone-100">{result.chiefComplaint}</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { l: 'Dosha', v: result.dosha }, { l: 'Agni', v: result.agni || result.ayurvedicNotes?.agni }, { l: 'Koshtha', v: result.koshtha || result.ayurvedicNotes?.koshtha },
          ].map(x => (
            <div key={x.l} className="border border-stone-800 bg-stone-950/60 rounded-lg p-3 text-center">
              <div className="font-label-sm text-label-sm text-stone-500">{x.l}</div>
              <div className="font-serif text-sm text-stone-100">{x.v || '—'}</div>
            </div>
          ))}
        </div>
        {result.recommendation && (
          <div className="bg-primary/5 rounded-xl p-3.5">
            <p className="font-body-md text-body-md text-stone-300">{result.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
