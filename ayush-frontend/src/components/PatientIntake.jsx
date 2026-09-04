import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sarvamTTS, recordAndTranscribe } from '../utils/sarvam';
import VideoConsult from './VideoConsult';

// ── Sequential intake definition ───────────────────────────────────────────────
const STEPS = ['name', 'demographics', 'phone', 'symptoms', 'digestion', 'sleep', 'energy', 'history'];

const QUESTIONS = {
  name: {
    en: 'Welcome to AYUSH Clinical Triage! Please tell me your full name.',
    hi: 'नमस्ते! आयुष क्लिनिकल ट्राइएज में आपका स्वागत है। कृपया अपना पूरा नाम बताएं।',
  },
  demographics: {
    en: 'Thank you. What is your age and gender?',
    hi: 'धन्यवाद। आपकी उम्र और लिंग क्या है?',
  },
  phone: {
    en: 'Please enter your 10-digit mobile number.',
    hi: 'कृपया अपना 10 अंकों का मोबाइल नंबर दर्ज करें।',
  },
  symptoms: {
    en: 'What symptoms are you experiencing and for how many days?',
    hi: 'आपको क्या स्वास्थ्य समस्या महसूस हो रही है और कितने दिनों से है?',
  },
  digestion: {
    en: 'How is your appetite and digestion? Any constipation or irregular bowel movements?',
    hi: 'आपकी भूख और पाचन कैसा रहता है? पेट साफ होने में कोई परेशानी?',
  },
  sleep: {
    en: 'How is your sleep quality? Do you experience broken sleep, insomnia, or high stress/anxiety?',
    hi: 'आपकी नींद कैसी है — क्या रात में नींद टूटती है या अत्यधिक तनाव व चिंता महसूस होती है?',
  },
  energy: {
    en: 'How is your daily energy level — excessive fatigue, lethargy, or normal? Do you stay well-hydrated?',
    hi: 'दिनभर आपका ऊर्जा स्तर कैसा रहता है — अत्यधिक सुस्ती, कमजोरी या सामान्य? क्या पर्याप्त पानी पीते हैं?',
  },
  history: {
    en: 'Do you have any pre-existing conditions — Diabetes, Hypertension, Thyroid, asthma, or drug allergies?',
    hi: 'क्या आपको पहले से कोई पुरानी बीमारी है — जैसे बीपी, शुगर, थायराइड, सांस फूलना या किसी दवा से एलर्जी?',
  },
};

const CHIPS = {
  demographics: ['Male', 'Female', 'Other'],
  symptoms: ['पेट दर्द (Abdominal pain)', 'खट्टी डकार व सीने में जलन', 'जोड़ों का दर्द (Joint pain)', 'सिरदर्द व थकान'],
  digestion: ['भूख कम लगती है (Manda)', 'पाचन ठीक है (Sama)', 'कब्ज की समस्या (Krura)', 'खट्टी डकारें (Amla)'],
  sleep: {
    en: ['Sound Sleep', 'Disturbed Sleep', 'Insomnia / High Stress'],
    hi: ['गहरी नींद (Sound Sleep)', 'नींद में बाधा (Disturbed)', 'अनिद्रा व भारी तनाव (Insomnia/Stress)'],
  },
  energy: {
    en: ['Normal Energy', 'Sluggish / Lethargic', 'Severe Weakness / Fatigue'],
    hi: ['ऊर्जा सामान्य (Normal)', 'भारीपन व सुस्ती (Kapha Lethargy)', 'अत्यधिक कमजोरी व थकान (Severe Fatigue)'],
  },
  history: {
    en: ['No Pre-existing Conditions', 'Hypertension / High BP', 'Diabetes / Sugar', 'Respiratory / Allergy'],
    hi: ['कोई पुरानी बीमारी नहीं (None)', 'उच्च रक्तचाप / High BP', 'मधुमेह / Diabetes', 'सांस फूलना या एलर्जी'],
  },
};

const STEP_META = {
  name:         { label: 'Name',        labelHi: 'नाम',         icon: 'person' },
  demographics: { label: 'Age/Gender',  labelHi: 'उम्र/लिंग',   icon: 'cake' },
  phone:        { label: 'Mobile',      labelHi: 'मोबाइल',      icon: 'phone' },
  symptoms:     { label: 'Symptoms',    labelHi: 'तकलीफ',       icon: 'healing' },
  digestion:    { label: 'Agni/Koshtha', labelHi: 'अग्नि/कोष्ठ', icon: 'local_fire_department' },
  sleep:        { label: 'Sleep/Stress', labelHi: 'निद्रा/मानस', icon: 'bedtime' },
  energy:       { label: 'Energy',       labelHi: 'बल/ऊर्जा',    icon: 'bolt' },
  history:      { label: 'History',      labelHi: 'पुरानी बीमारी', icon: 'history' },
};

const PRIORITY_CONFIG = {
  P1: { bg: 'bg-red-600', text: 'text-white', label: 'Critical', icon: 'emergency' },
  P2: { bg: 'bg-orange-500', text: 'text-white', label: 'Urgent', icon: 'priority_high' },
  P3: { bg: 'bg-blue-600', text: 'text-white', label: 'Moderate', icon: 'schedule' },
  P4: { bg: 'bg-green-600', text: 'text-white', label: 'Routine', icon: 'check_circle' },
};

// ── Answer parsers ─────────────────────────────────────────────────────────────
function parseGender(text) {
  const tl = text.toLowerCase();
  if (/female|महिला|स्त्री|औरत|लड़की|mahila|ladki|woman|girl/.test(tl)) return 'Female';
  if (/\bmale\b|पुरुष|मर्द|लड़का|purush|mard|aadmi|man|boy/.test(tl)) return 'Male';
  if (/other|अन्य|transgender/.test(tl)) return 'Other';
  return '';
}

function parseDigestion(text) {
  const tl = text.toLowerCase();
  let agni = 'Vishama'; // irregular default
  if (/manda|कम|low|less|thoda|sluggish|no appetite|भूख नहीं/.test(tl)) agni = 'Manda';
  else if (/tikshna|तेज़|sharp|excessive|bahut|ज़्यादा|zyada|acid|खट्ट|amla/.test(tl)) agni = 'Tikshna';
  else if (/sama|ठीक|normal|fine|good|अच्छ/.test(tl)) agni = 'Sama';

  let koshtha = 'Madhyama';
  if (/krura|कब्ज|constipat|hard|कड़ा|कठोर/.test(tl)) koshtha = 'Krura';
  else if (/mridu|loose|दस्त|soft|पतला|diarr/.test(tl)) koshtha = 'Mridu';
  return { agni, koshtha };
}

export default function PatientIntake() {
  const navigate = useNavigate();
  const onTriage = undefined; // record is persisted server-side; dashboard fetches the queue
  // Language
  const [lang, setLang] = useState('en');
  const langRef = useRef('en');
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Sequential step machine
  const [step, setStep] = useState('name');       // 'name'|'demographics'|'phone'|'symptoms'|'digestion'|'review'
  const stepRef = useRef('name');
  const [fields, setFields] = useState({ name: '', age: '', gender: '', phone: '', symptoms: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });
  const fieldsRef = useRef({ name: '', age: '', gender: '', phone: '', symptoms: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });

  // Chat
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const chatRecRef = useRef(null);
  const chatEndRef = useRef(null);

  // Triage result / video
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

  // QR document scan
  const [sessionId] = useState(() => 'SES-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [qrOpen, setQrOpen] = useState(true);
  const [docResult, setDocResult] = useState(null);  // { status, ocrData, fileBase64, ... }
  const pollRef = useRef(null);
  const didInitRef = useRef(false);

  const mobileUrl = `${window.location.origin}/mobile-scan?sid=${sessionId}`;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = useCallback((role, text) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role, text, time }]);
  }, []);

  const netErr = useCallback(() => {
    setTtsError(langRef.current === 'hi'
      ? 'नेटवर्क समस्या — कृपया जांचें कि बैकएंड सर्वर चल रहा है।'
      : 'Network issue — verify backend server is running.');
  }, []);

  // Ask a step's question (post + speak)
  const askStep = useCallback(async (stepKey) => {
    const q = QUESTIONS[stepKey][langRef.current === 'hi' ? 'hi' : 'en'];
    addMessage('ai', q);
    setTtsError('');
    await sarvamTTS(q, langRef.current, { onNetworkError: netErr });
  }, [addMessage, netErr]);

  // ── Submit full structured payload → triage ─────────────────────────────────
  const submitTriage = useCallback(async (f) => {
    setStep('review'); stepRef.current = 'review';
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: `P${Date.now()}`,
          name: f.name, age: f.age, gender: f.gender, phone: f.phone,
          symptoms: f.symptoms, agni: f.agni, koshtha: f.koshtha,
          sleep_stress: f.sleep_stress, energy_lifestyle: f.energy_lifestyle, chronic_history: f.chronic_history,
          sessionId, lang: langRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rec = data.record || data;
      setTriageResult(rec);
      onTriage?.(rec);
    } catch (err) {
      console.warn('[submitTriage]', err.message);
      const fallback = {
        id: `P${Date.now()}`, name: f.name || 'Anonymous',
        triageLevel: 'P3', triageLabel: 'Moderate',
        surgicalAlert: false, geneticAlert: false,
        dosha: 'Tridosha', agni: f.agni || 'Vishama', koshtha: f.koshtha || 'Madhyama',
        redFlags: 'None', meds: 'None', labs: 'None',
        chiefComplaint: f.symptoms || 'General consultation',
        recommendation: 'Standard Ayurvedic consultation advised.',
      };
      setTriageResult(fallback);
      onTriage?.(fallback);
    } finally {
      setIsSubmitting(false);
    }
  }, [onTriage, sessionId]);

  // ── Handle a patient answer for the current step ────────────────────────────
  const handleAnswer = useCallback((raw) => {
    const text = (raw || '').trim();
    if (!text) return;
    const stepKey = stepRef.current;
    if (!STEPS.includes(stepKey)) return; // review/submitted

    addMessage('patient', text);
    const f = { ...fieldsRef.current };

    if (stepKey === 'name') {
      f.name = text;
    } else if (stepKey === 'demographics') {
      const n = text.match(/\d{1,3}/);
      if (n) f.age = n[0];
      f.gender = parseGender(text) || f.gender || 'Not specified';
    } else if (stepKey === 'phone') {
      const digits = text.replace(/\D/g, '');
      f.phone = digits.length >= 10 ? digits.slice(-10) : (digits || 'N/A');
    } else if (stepKey === 'symptoms') {
      f.symptoms = text;
    } else if (stepKey === 'digestion') {
      const { agni, koshtha } = parseDigestion(text);
      f.agni = agni; f.koshtha = koshtha;
    } else if (stepKey === 'sleep') {
      f.sleep_stress = text;
    } else if (stepKey === 'energy') {
      f.energy_lifestyle = text;
    } else if (stepKey === 'history') {
      f.chronic_history = text;
    }

    fieldsRef.current = f;
    setFields(f);

    const idx = STEPS.indexOf(stepKey);
    const nextKey = STEPS[idx + 1];
    if (nextKey) {
      stepRef.current = nextKey;
      setStep(nextKey);
      setTimeout(() => askStep(nextKey), 350);
    } else {
      submitTriage(f); // history was the last step
    }
  }, [addMessage, askStep, submitTriage]);

  // ── Chat mic ────────────────────────────────────────────────────────────────
  const startListening = async () => {
    if (isListening) {
      if (chatRecRef.current?.state === 'recording') chatRecRef.current.stop();
      return;
    }
    const rec = await recordAndTranscribe({
      maxMs: 6000,
      onStart: () => setIsListening(true),
      onStop: () => setIsListening(false),
      onResult: (t) => handleAnswer(t),
      onError: (code) => {
        setIsListening(false);
        if (code === 'not-allowed') alert('Microphone access denied.\nChrome → 🔒 → Allow microphone → Reload.');
        else if (code === 'network') netErr();
      },
    });
    chatRecRef.current = rec;
  };

  const handleSend = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText('');
    handleAnswer(t);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── Language toggle (re-greet if still on first step) ───────────────────────
  const changeLang = (l) => {
    setLang(l);
    langRef.current = l;
    if (stepRef.current === 'name') {
      setMessages([]);
      setTimeout(() => askStep('name'), 100);
    }
  };

  // ── Mount: greet + start QR polling ─────────────────────────────────────────
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    askStep('name');

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session-docs/${sessionId}`);
        const data = await res.json();
        if (data.status === 'ready') {
          setDocResult(data);
          clearInterval(pollRef.current);
        } else if (data.status === 'processing') {
          setDocResult(data);
        }
      } catch { /* keep polling */ }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const priority = triageResult?.triageLevel || 'P3';
  const pCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.P3;
  const tokenNum = triageResult?.id ? String(triageResult.id).slice(-6).toUpperCase() : `AYU${Date.now().toString().slice(-4)}`;
  const stepIndex = STEPS.indexOf(step);

  // ════════════════════════════════ REVIEW / SUMMARY CARD ═══════════════════════
  if (step === 'review') {
    if (isSubmitting || !triageResult) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[40px] animate-spin">refresh</span>
          </div>
          <div className="text-center">
            <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">Generating Triage Assessment…</p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gemini 3.6 Flash is analysing your intake</p>
          </div>
        </div>
      );
    }
    return (
      <>
        {showVideo && <VideoConsult lang={lang} onClose={() => setShowVideo(false)} initialMessages={messages} />}
        <div className="relative w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          <div className="flex items-center gap-3 bg-primary/5 rounded-2xl p-5 shadow-sm ring-1 ring-primary/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[28px]">task_alt</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Triage Assessment Complete</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Your record has been added to the AYUSH doctor queue.</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-3xl shadow-md overflow-hidden ring-1 ring-surface-container-high">
            <div className={`${pCfg.bg} px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <span className={`material-symbols-outlined ${pCfg.text} text-[36px]`}>{pCfg.icon}</span>
                </div>
                <div>
                  <div className={`font-headline-md text-headline-md ${pCfg.text} font-bold leading-none`}>{priority}</div>
                  <div className={`font-title-md text-title-md ${pCfg.text} opacity-90`}>{triageResult.triageLabel || pCfg.label}</div>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-1">
                <span className={`font-label-sm text-label-sm ${pCfg.text} opacity-75 uppercase tracking-wider`}>Token Number</span>
                <span className={`font-headline-sm text-headline-sm ${pCfg.text} font-bold tracking-widest`}>AYUSH-{tokenNum}</span>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {(triageResult.surgicalAlert || (triageResult.redFlags && triageResult.redFlags !== 'None')) && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-error/10 text-error font-label-md text-label-md ring-1 ring-error/20 w-fit">
                  <span className="material-symbols-outlined text-[18px]">emergency</span>
                  {triageResult.redFlags && triageResult.redFlags !== 'None' ? triageResult.redFlags : 'Red Flag — Immediate Review'}
                </div>
              )}

              <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[15px]">medical_information</span> Chief Complaint
                </div>
                <p className="font-body-lg text-body-lg text-on-surface">{triageResult.chiefComplaint}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Dosha', val: triageResult.dosha || '—', icon: 'balance' },
                  { label: 'Agni', val: triageResult.agni || triageResult.ayurvedicNotes?.agni || '—', icon: 'local_fire_department' },
                  { label: 'Koshtha', val: triageResult.koshtha || triageResult.ayurvedicNotes?.koshtha || '—', icon: 'gastroenterology' },
                  { label: 'Medications', val: triageResult.meds || 'None', icon: 'medication' },
                ].map(({ label, val, icon }) => (
                  <div key={label} className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                      <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface font-medium leading-snug">{val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[22px] mt-0.5 shrink-0">recommend</span>
                <div>
                  <p className="font-label-md text-label-md text-primary uppercase tracking-wide mb-1">Physician Recommendation</p>
                  <p className="font-body-md text-body-md text-on-surface">{triageResult.recommendation}</p>
                </div>
              </div>

              <div className="bg-surface-container rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[22px]">hourglass_top</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-semibold">Please wait for your token to be called</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Estimated wait: <strong className="text-primary">&lt; 5 minutes</strong></p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button onClick={() => setShowVideo(true)} className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container transition-all">
                <span className="material-symbols-outlined text-[22px]">videocam</span>
                Start Video Consult
              </button>
              <button onClick={() => navigate('/doctor')} className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                Switch to Doctor Dashboard
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary">Staff Demo</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════ INTAKE VIEW ════════════════════════════════
  return (
    <>
      {showVideo && <VideoConsult lang={lang} onClose={() => setShowVideo(false)} initialMessages={messages} />}

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* Emergency Notice */}
        <div className="w-full bg-secondary-container/25 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px]">medical_services</span>
            </div>
            <div>
              <span className="font-label-lg text-label-lg text-on-secondary-container font-semibold">Emergency Medical Notice / आपातकालीन सूचना</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Severe chest pain, breathlessness, trauma? Call <strong className="text-secondary">108</strong> immediately.</p>
            </div>
          </div>
          <a className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-90 transition-all flex-shrink-0" href="tel:108">
            <span className="material-symbols-outlined text-[16px]">call</span>
            Call 108
          </a>
        </div>

        {/* Language selection banner */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">translate</span>
            </div>
            <div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold">AYUSH Clinical Triage</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Choose your language / अपनी भाषा चुनें</p>
            </div>
          </div>
          <div className="inline-flex items-center bg-surface-container rounded-full p-1 gap-1">
            <button onClick={() => changeLang('hi')} className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${lang === 'hi' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>🇮🇳 हिंदी (Hindi)</button>
            <button onClick={() => changeLang('en')} className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${lang === 'en' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>🇬🇧 English</button>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <div className="flex items-center w-full">
                    <div className={`h-1 flex-1 rounded-full ${i === 0 ? 'opacity-0' : done || active ? 'bg-primary' : 'bg-surface-container-high'}`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mx-1 transition-all ${
                      done ? 'bg-primary text-on-primary' : active ? 'bg-primary/15 text-primary ring-2 ring-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {done ? <span className="material-symbols-outlined text-[16px]">check</span>
                            : <span className="material-symbols-outlined text-[16px]">{STEP_META[s].icon}</span>}
                    </div>
                    <div className={`h-1 flex-1 rounded-full ${i === STEPS.length - 1 ? 'opacity-0' : done ? 'bg-primary' : 'bg-surface-container-high'}`} />
                  </div>
                  <span className={`font-label-sm text-label-sm text-center leading-tight truncate w-full ${active ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                    {lang === 'hi' ? STEP_META[s].labelHi : STEP_META[s].label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-column: QR scan (left) + Chat (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: Touchless QR document scan */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden ring-1 ring-surface-container-high">
              <button onClick={() => setQrOpen(o => !o)} className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
                  </div>
                  <div className="text-left">
                    <h2 className="font-title-md text-title-md text-on-surface font-semibold">Prescriptions / Lab Reports</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">पर्चा स्कैन करें · Touchless mobile upload</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[22px]">{qrOpen ? 'expand_less' : 'expand_more'}</span>
              </button>

              {qrOpen && (
                <div className="px-5 pb-5 flex flex-col items-center gap-4">
                  {!docResult || docResult.status === 'waiting' ? (
                    <>
                      <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <QRCodeSVG value={mobileUrl} size={168} level="M" includeMargin={false} />
                      </div>
                      <div className="text-center">
                        <p className="font-body-md text-body-md text-on-surface font-medium">Scan with your phone camera</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">फ़ोन से स्कैन करके पर्चा या रिपोर्ट अपलोड करें</p>
                      </div>
                      <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-[16px]">wifi</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Waiting for upload · Session {sessionId}</span>
                        <span className="ml-auto w-2 h-2 rounded-full bg-primary animate-ping" />
                      </div>
                    </>
                  ) : docResult.status === 'processing' ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <span className="material-symbols-outlined text-primary text-[40px] animate-spin">refresh</span>
                      <p className="font-body-md text-body-md text-on-surface">Analysing document with Gemini Vision…</p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        <span className="font-label-md text-label-md font-semibold">Document Received</span>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">{docResult.ocrData?.documentType || 'Document'}</span>
                      </div>
                      {docResult.ocrData?.medicines?.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Medicines</span>
                          <div className="flex flex-wrap gap-1.5">
                            {docResult.ocrData.medicines.map((m, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-label-sm text-label-sm">
                                <span className="material-symbols-outlined text-[13px]">medication</span>{m.name}{m.dosage ? ` — ${m.dosage}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {docResult.ocrData?.abnormalLabValues?.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Abnormal Labs</span>
                          <div className="flex flex-wrap gap-1.5">
                            {docResult.ocrData.abnormalLabValues.map((l, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-container/40 text-on-secondary-container font-label-sm text-label-sm">
                                <span className="material-symbols-outlined text-[13px]">science</span>{l.test}: {l.value} {l.flag && `(${l.flag})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {docResult.ocrData?.clinicalImpressions && (
                        <p className="font-body-sm text-body-sm text-on-surface bg-surface-container-low rounded-xl p-3">{docResult.ocrData.clinicalImpressions}</p>
                      )}
                      {docResult.fileBase64 && docResult.mimeType?.startsWith('image/') && (
                        <img src={docResult.fileBase64} alt="scanned document" className="w-full max-h-48 object-contain rounded-xl bg-surface-container-low" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Sequential AI chat */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col h-[640px] overflow-hidden ring-1 ring-surface-container-high">
              {/* Chat header */}
              <div className="bg-surface-container-low p-4 sm:px-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">psychiatry</span>
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-tertiary-container shadow-sm" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-title-md text-title-md text-on-surface font-semibold">AYUSH Sahayak</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                        Step {Math.min(stepIndex + 1, STEPS.length)}/{STEPS.length} — {lang === 'hi' ? STEP_META[step].labelHi : STEP_META[step].label}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-primary font-medium">Sarvam Bulbul v3 · Saaras v3 · Gemini 3.6 Flash</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 bg-surface/40">
                {messages.map((msg, i) => (
                  msg.role === 'ai' ? (
                    <div key={i} className="flex items-start gap-3 max-w-[90%]">
                      <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">spa</span>
                      </div>
                      <div className="bg-surface-container-low p-4 rounded-2xl rounded-tl-none shadow-sm flex flex-col gap-1.5">
                        <p className="font-body-md text-body-md text-on-surface">{msg.text}</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant self-end">{msg.time}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-3 max-w-[88%] self-end flex-row-reverse">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">person</span>
                      </div>
                      <div className="bg-surface-container p-4 rounded-2xl rounded-tr-none shadow-sm flex flex-col gap-1.5">
                        <p className="font-body-md text-body-md text-on-surface">{msg.text}</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant self-start">{msg.time}</span>
                      </div>
                    </div>
                  )
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* TTS network error banner (never shown for autoplay blocks) */}
              {ttsError && (
                <div className="mx-4 mb-1 bg-error-container/30 text-on-error-container rounded-xl p-2.5 font-body-sm text-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[16px]">wifi_off</span>
                  <span>{ttsError}</span>
                </div>
              )}

              {/* Quick chips for current step (some steps have language-specific chip sets) */}
              {CHIPS[step] && (() => {
                const chipSet = Array.isArray(CHIPS[step]) ? CHIPS[step] : (CHIPS[step][lang] || CHIPS[step].en);
                return (
                  <div className="px-4 py-2.5 bg-surface-container-low/70 flex items-center gap-2 overflow-x-auto">
                    <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">Quick:</span>
                    {chipSet.map(chip => (
                      <button key={chip} onClick={() => handleAnswer(chip)}
                        className="px-3 py-1 rounded-full bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-sm text-label-sm whitespace-nowrap shadow-sm transition-colors">
                        {chip}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Input bar */}
              <div className="p-4 bg-surface-container-lowest shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-primary">
                    <span className={`w-2 h-2 rounded-full bg-primary ${isListening ? 'animate-ping' : ''}`} />
                    {isListening ? 'Recording… tap mic to stop' : `${lang === 'hi' ? 'हिंदी' : 'English'} · tap mic or type`}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Sarvam Saaras v3 STT</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    className={`flex items-center justify-center w-12 h-12 rounded-2xl text-on-primary shadow-sm flex-shrink-0 transition-all ${isListening ? 'bg-secondary animate-pulse scale-110' : 'bg-primary hover:bg-primary-container'}`}
                    onClick={startListening} title="Tap to record" type="button"
                  >
                    <span className="material-symbols-outlined text-[24px]">{isListening ? 'stop' : 'mic'}</span>
                  </button>
                  <div className="flex-1 relative flex items-center">
                    <input
                      className="w-full h-12 pl-4 pr-12 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all"
                      placeholder={lang === 'hi' ? 'यहाँ लिखें या माइक दबाएं…' : 'Type your answer or tap mic…'}
                      value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} type="text"
                    />
                    <button className="absolute right-2 w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary-container transition-colors" onClick={handleSend} type="button">
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Staff shortcut */}
            <div className="flex justify-end">
              <button onClick={() => navigate('/doctor')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                Switch to Doctor Dashboard
                <span className="px-1.5 py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary">Staff Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
