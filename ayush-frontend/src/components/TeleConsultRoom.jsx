import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sarvamTTS, recordUntilSilence, stopSarvamAudio } from '../utils/sarvam';

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
  P1: { bg: 'bg-red-600', label: 'Critical', icon: 'emergency' },
  P2: { bg: 'bg-orange-500', label: 'Urgent', icon: 'priority_high' },
  P3: { bg: 'bg-blue-600', label: 'Moderate', icon: 'schedule' },
  P4: { bg: 'bg-green-600', label: 'Routine', icon: 'check_circle' },
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
  const [webcamError, setWebcamError] = useState(false);
  const [audioOutputMode, setAudioOutputMode] = useState('speaker'); // 'speaker' | 'earpiece'
  const [docChoice, setDocChoice] = useState('none'); // 'none' | 'ask' | 'yes' (document inquiry)
  const [docResult, setDocResult] = useState(null);
  const docAdvancedRef = useRef(false);
  const pollRef = useRef(null);
  const [sessionId] = useState(() => 'SES-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const mobileUrl = `${window.location.origin}/mobile-scan?sid=${sessionId}`;

  const recRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
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

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }
    } catch {
      setWebcamError(true);
    }
  };
  const stopWebcam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const stopRec = () => { if (recRef.current?.state === 'recording') recRef.current.stop(); };

  // Bot speech — cancels any prior audio (singleton), cuts the mic first so the
  // bot's own voice can never be recorded, and routes to speaker/earpiece.
  const speak = async (text, forceLang) => {
    stopRec(); // strict mic cutoff during playback
    setBotStatus('speaking');
    setCaption(text);
    await sarvamTTS(text, (forceLang || langRef.current) === 'hi' ? 'hi' : 'en', {
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
  const chooseLang = (l) => {
    if (langChosenRef.current) return;
    langChosenRef.current = true;
    langRef.current = l;
    setLang(l);
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
          sessionId, lang: langRef.current, room,
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
    if (!stageAlive(token)) return;
    const code = langRef.current === 'hi' ? 'hi-IN' : 'en-IN';
    await speak(attempt === 0 ? Q[stageKey][langRef.current] : REPROMPT[langRef.current]);
    if (!stageAlive(token)) return;
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
    await speak(DOC_Q[langRef.current], langRef.current);
    if (!stageAlive(token)) return;
    const r = await listenOnce({ langCode: langRef.current === 'hi' ? 'hi-IN' : 'en-IN' });
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
    stopWebcam();
    navigate('/');
  };

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
    startWebcam();
    runFlow(myRun);
    return () => {
      isMountedRef.current = false;
      stopSarvamAudio();
      stopRec();
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaking = botStatus === 'speaking';
  const listening = botStatus === 'listening';
  const stageIdx = STAGES.indexOf(stage);

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col relative overflow-hidden">

      {/* Top status bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 bg-neutral-950/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-label-md text-label-md text-white/90">AYUSH Teleconsult · Room {room}</span>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'waiting' && phase !== 'admitted' && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 font-label-sm text-label-sm text-white/80">{lang === 'hi' ? 'हिंदी' : 'English'}</span>
          )}
          <button onClick={endCall} className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-label-md text-label-md flex items-center gap-1.5 transition-colors">
            <span className="material-symbols-outlined text-[18px]">call_end</span>End Call
          </button>
        </div>
      </div>

      {/* Main call area */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8">

        {/* Main tile: AI Vaidya */}
        <div className="w-full max-w-3xl aspect-video bg-gradient-to-b from-primary/20 to-neutral-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center gap-5 relative overflow-hidden ring-1 ring-white/10">
          <div className="relative flex items-center justify-center">
            {(speaking || listening) && (
              <>
                <div className={`absolute w-48 h-48 rounded-full ${speaking ? 'bg-primary/20' : 'bg-tertiary/20'} animate-ping`} />
                <div className={`absolute w-36 h-36 rounded-full ${speaking ? 'bg-primary/25' : 'bg-tertiary/25'} animate-pulse`} />
              </>
            )}
            <div className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              speaking ? 'bg-primary scale-105' : listening ? 'bg-tertiary/80' : botStatus === 'thinking' ? 'bg-secondary/70' : 'bg-neutral-700'}`}>
              <span className="material-symbols-outlined text-[52px] text-white">
                {speaking ? 'record_voice_over' : listening ? 'hearing' : botStatus === 'thinking' ? 'psychology' : 'stethoscope'}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-title-md text-title-md text-white font-semibold">Dr. AYUSH AI Vaidya</div>
            <div className="font-label-md text-label-md text-primary-fixed/90">
              {speaking ? (lang === 'hi' ? 'बोल रहे हैं…' : 'Speaking…') :
               listening ? (lang === 'hi' ? 'सुन रहे हैं…' : 'Listening…') :
               botStatus === 'thinking' ? (lang === 'hi' ? 'प्रोसेस हो रहा है…' : 'Processing…') : 'AI Vaidya'}
            </div>
          </div>

          {/* Live mic VU meter — confirms the mic is capturing sound */}
          {listening && (
            <div className="flex items-end gap-1 h-8">
              {[0.15, 0.4, 0.7, 1.0, 0.7, 0.4, 0.15].map((th, i) => (
                <div key={i}
                  className={`w-1.5 rounded-full transition-all duration-75 ${liveVolume >= th ? 'bg-green-400' : 'bg-green-400/25'}`}
                  style={{ height: `${8 + th * 22}px` }} />
              ))}
            </div>
          )}

          {/* Live subtitles */}
          {caption && (
            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 items-center">
              <div className="max-w-xl bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center">
                <p className="font-body-md text-body-md text-white">{caption}</p>
              </div>
              {transcript && (
                <div className="max-w-xl bg-primary/70 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                  <p className="font-body-sm text-body-sm text-white">🗣️ {transcript}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating tile: patient camera */}
        <div className="absolute bottom-6 right-6 w-40 sm:w-56 aspect-video bg-black rounded-2xl shadow-xl ring-2 ring-white/20 overflow-hidden">
          {webcamError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/50">
              <span className="material-symbols-outlined text-[28px]">videocam_off</span>
              <span className="font-label-sm text-label-sm">Camera off</span>
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          )}
          <span className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white/90 font-label-sm text-label-sm">You</span>
        </div>

        {/* IVR language buttons */}
        {phase === 'ivr' && !triageResult && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <button onClick={() => chooseLang('hi')} className="px-6 py-4 rounded-2xl bg-primary text-on-primary font-title-md text-title-md shadow-lg hover:bg-primary-container transition-all flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-bold">1</span>
                हिंदी (Hindi)
              </button>
              <button onClick={() => chooseLang('en')} className="px-6 py-4 rounded-2xl bg-white text-neutral-900 font-title-md text-title-md shadow-lg hover:bg-neutral-100 transition-all flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-neutral-900/10 flex items-center justify-center font-bold">2</span>
                English
              </button>
            </div>
            <p className="font-label-md text-label-md text-white/70">{lang === 'hi' ? 'बोलें या दबाएं' : 'Press or say 1 / 2'}</p>
          </div>
        )}

        {/* Interview progress */}
        {phase === 'interview' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s} className={`h-2 rounded-full transition-all ${i < stageIdx ? 'w-6 bg-primary' : i === stageIdx ? 'w-6 bg-primary/60' : 'w-2 bg-white/20'}`} />
            ))}
            <span className="ml-2 font-label-sm text-label-sm text-white/70">{STAGE_LABEL[stage][lang]}</span>
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
                <button onClick={docYes} className="px-5 py-3.5 rounded-2xl bg-primary text-on-primary font-title-md text-title-md shadow-lg hover:bg-primary-container transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                  {lang === 'hi' ? '📄 हाँ, पर्ची स्कैन करें' : '📄 Yes, Scan Document'}
                </button>
                <button onClick={docNo} className="px-5 py-3.5 rounded-2xl bg-white/15 text-white font-title-md text-title-md backdrop-blur-sm hover:bg-white/25 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px]">skip_next</span>
                  {lang === 'hi' ? '⏭️ नहीं, आगे बढ़ें' : '⏭️ No, Skip & Continue'}
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2.5 shadow-xl max-w-sm">
                {docResult?.status === 'ready' ? (
                  <div className="flex flex-col items-center gap-3 text-neutral-900">
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
                    <p className="font-body-sm text-body-sm text-neutral-700 text-center">{lang === 'hi' ? 'फ़ोन कैमरे से यह QR स्कैन करें।' : 'Scan this QR with your phone camera.'}</p>
                    <QRCodeSVG value={mobileUrl} size={150} level="M" />
                    <button onClick={advanceFromDocs} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors flex items-center gap-1.5">
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
        {phase === 'interview' && !triageResult && stage !== 'has_documents' && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-2.5 px-4">
            {TELE_CHIPS[stage] && (
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                {(TELE_CHIPS[stage][lang] || TELE_CHIPS[stage].en).map(chip => (
                  <button key={chip} onClick={() => acceptAnswer(stage, chip)}
                    className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-primary hover:text-on-primary text-white font-label-md text-label-md backdrop-blur-sm transition-colors">
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
                className="flex-1 h-11 px-4 rounded-xl bg-white/90 text-neutral-900 placeholder:text-neutral-500 font-body-md text-body-md focus:outline-none"
              />
              <button onClick={submitTyped} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        )}

        {/* Waiting room overlay */}
        {(phase === 'waiting' || phase === 'admitted') && (
          <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-neutral-800 rounded-3xl shadow-2xl px-10 py-12 flex flex-col items-center gap-5 ring-1 ring-white/10 max-w-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[36px]">stethoscope</span>
              </div>
              {phase === 'waiting' ? (
                <>
                  <h2 className="font-headline-sm text-headline-sm text-white font-semibold">Connecting to Dr. AYUSH AI Vaidya…</h2>
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="font-headline-lg text-headline-lg text-primary font-bold text-[56px]">{countdown}</span>
                    </div>
                  </div>
                  <p className="font-body-md text-body-md text-white/70">Please wait in the consultation room…</p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-primary text-[52px]">check_circle</span>
                  <h2 className="font-headline-sm text-headline-sm text-white font-semibold">Host admitted you to the consultation</h2>
                  <p className="font-body-md text-body-md text-white/70">Starting your session…</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Completion summary overlay */}
        {triageResult && (
          <div className="absolute inset-0 bg-neutral-950/92 backdrop-blur-sm flex items-center justify-center z-20 p-4">
            <div className="bg-white text-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <TeleSummary result={triageResult} lang={lang} />
              <div className="p-5 flex gap-3 border-t border-neutral-200">
                <button onClick={endCall} className="flex-1 px-5 py-3.5 rounded-xl bg-red-600 text-white font-label-lg text-label-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">call_end</span>
                  {lang === 'hi' ? 'कॉल समाप्त करें' : 'End Call'}
                </button>
                <button onClick={() => navigate('/doctor')} className="px-5 py-3.5 rounded-xl bg-neutral-100 text-neutral-800 font-label-md text-label-md hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">stethoscope</span>Doctor View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom call-control toolbar */}
      {!triageResult && phase !== 'waiting' && phase !== 'admitted' && (
        <div className="flex flex-col items-center gap-1.5 pb-5">
          <button
            onClick={toggleAudioOutput}
            title="फोन कान पर लगाकर बात करें / Hold phone near ear"
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-full font-label-lg text-label-lg shadow-lg transition-all ${
              audioOutputMode === 'speaker' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            <span className="material-symbols-outlined text-[22px]">{audioOutputMode === 'speaker' ? 'volume_up' : 'phone_in_talk'}</span>
            {audioOutputMode === 'speaker' ? '🔊 लाउडस्पीकर / Speaker Mode' : '📱 कान के पास / Earpiece Mode'}
          </button>
          <p className="font-label-sm text-label-sm text-white/50">फोन कान पर लगाकर बात करें / Hold phone near ear</p>
        </div>
      )}
    </div>
  );
}

function TeleSummary({ result, lang }) {
  const cfg = PRIORITY_CONFIG[result.triageLevel] || PRIORITY_CONFIG.P3;
  const token = result.id ? `AYUSH-${String(result.id).slice(-6).toUpperCase()}` : 'AYUSH-000000';
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
        <div className="text-right">
          <div className="font-label-sm text-label-sm opacity-80">Token</div>
          <div className="font-title-md text-title-md font-bold tracking-wider">{token}</div>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-3">
        <div>
          <span className="font-label-sm text-label-sm text-neutral-500 uppercase tracking-wide">Chief Complaint</span>
          <p className="font-body-lg text-body-lg text-neutral-900">{result.chiefComplaint}</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { l: 'Dosha', v: result.dosha }, { l: 'Agni', v: result.agni || result.ayurvedicNotes?.agni }, { l: 'Koshtha', v: result.koshtha || result.ayurvedicNotes?.koshtha },
          ].map(x => (
            <div key={x.l} className="bg-neutral-100 rounded-xl p-3 text-center">
              <div className="font-label-sm text-label-sm text-neutral-500">{x.l}</div>
              <div className="font-body-sm text-body-sm text-neutral-900 font-medium">{x.v || '—'}</div>
            </div>
          ))}
        </div>
        {result.recommendation && (
          <div className="bg-primary/5 rounded-xl p-3.5">
            <p className="font-body-md text-body-md text-neutral-800">{result.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
