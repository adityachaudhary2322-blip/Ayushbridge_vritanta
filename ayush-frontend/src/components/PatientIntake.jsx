import { useState, useRef, useEffect, useCallback } from 'react';
import { sarvamTTS, recordAndTranscribe, detectMode } from '../utils/sarvam';
import VideoConsult from './VideoConsult';

const WIZARD_STEPS = [
  { id: 1, label: 'Name', labelHi: 'नाम',
    prompt_hi: 'नमस्ते! कृपया अपना पूरा नाम बताएं।',
    prompt_en: 'Hello! Please tell me your full name.' },
  { id: 2, label: 'Age & Gender', labelHi: 'उम्र और लिंग',
    prompt_hi: 'आपकी उम्र और लिंग क्या है?',
    prompt_en: 'Please say your age and gender.' },
  { id: 3, label: 'Mobile', labelHi: 'मोबाइल नंबर',
    prompt_hi: 'अपना दस अंकों का मोबाइल नंबर बताएं।',
    prompt_en: 'Please say your 10-digit mobile number.' },
  { id: 4, label: 'Chief Complaint', labelHi: 'मुख्य तकलीफ',
    prompt_hi: 'आपको क्या तकलीफ है और कितने दिनों से है?',
    prompt_en: 'What symptoms are you experiencing and for how many days?' },
  { id: 5, label: 'Agni / Appetite', labelHi: 'भूख / अग्नि',
    prompt_hi: 'आपकी भूख कैसी है — कम, सामान्य, या ज़्यादा?',
    prompt_en: 'How is your appetite — low, normal, or high?' },
];

const DONE_MSG = {
  hi: 'आपका विवरण दर्ज हो गया। अब आप नीचे चैट में अपनी तकलीफ विस्तार से बताएं।',
  en: 'Registration complete! Now describe your health concern in detail in the chat below.',
};

const INITIAL_GREETING_EN = "Namaste! I'm AYUSH Sahayak, your AI health assistant. Please tell me your name and the health concern that brings you here today.";
const INITIAL_GREETING_HI = "नमस्ते! मैं आयुष सहायक हूँ। कृपया अपना नाम और आज की तकलीफ बताएं।";

const PRIORITY_CONFIG = {
  P1: { bg: 'bg-red-600', text: 'text-white', ring: 'ring-red-500', label: 'Surgical Emergency', icon: 'emergency' },
  P2: { bg: 'bg-orange-500', text: 'text-white', ring: 'ring-orange-400', label: 'Urgent', icon: 'priority_high' },
  P3: { bg: 'bg-blue-600', text: 'text-white', ring: 'ring-blue-500', label: 'Standard', icon: 'schedule' },
  P4: { bg: 'bg-green-600', text: 'text-white', ring: 'ring-green-500', label: 'Routine', icon: 'check_circle' },
};

export default function PatientIntake({ onNavigate, onTriage }) {
  // Language
  const [lang, setLang] = useState('en');
  const langRef = useRef('en');
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Chat messages (messagesRef mirrors state for sync access in async callbacks)
  const initMsg = {
    role: 'ai',
    text: INITIAL_GREETING_EN,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
  const [messages, setMessages] = useState([initMsg]);
  const messagesRef = useRef([initMsg]);

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Phase: 'chat' → user describes symptoms; 'triaging' → Gemini working; 'triaged' → card shown
  const [phase, setPhase] = useState('chat');
  const [triageResult, setTriageResult] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

  // OCR
  const [ocrChips, setOcrChips] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Wizard
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardListening, setWizardListening] = useState(false);
  const [wizardPaused, setWizardPaused] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [wizardFields, setWizardFields] = useState({ name: '', age: '', gender: '', mobile: '', symptoms: '', agni: '' });

  const wizardPausedRef = useRef(false);
  const wizardStepRef = useRef(0);
  const wizardRecRef = useRef(null);
  const chatRecRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // addMessage updates both ref (sync) and state (async render)
  const addMessage = useCallback((role, text) => {
    const msg = { role, text, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    messagesRef.current = [...messagesRef.current, msg];
    setMessages([...messagesRef.current]);
  }, []);

  // Pure dynamic Gemini conversation — sends full history on every turn
  const callFollowup = useCallback(async (transcript) => {
    const mode = detectMode(transcript);
    const langHint = mode === 'devanagari'
      ? 'Patient writes in Hindi Devanagari. Respond ONLY in Hindi Devanagari script.'
      : mode === 'hinglish'
      ? 'Patient writes Hinglish (Roman-script Hindi). Respond in English or Roman Hinglish. Do NOT use Devanagari.'
      : 'Respond in English.';

    setIsLoading(true);
    try {
      // history includes the just-added patient message (messagesRef is already updated)
      const history = messagesRef.current.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/ask-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, history, langHint }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const aiText = data.question || (mode === 'devanagari'
        ? 'कृपया अपनी तकलीफ के बारे में और बताएं।'
        : 'Please tell me more about your symptoms.');
      addMessage('ai', aiText);
      sarvamTTS(aiText, detectMode(aiText) === 'devanagari' ? 'hi' : 'en');
    } catch (err) {
      console.warn('[callFollowup]', err.message);
      addMessage('ai', mode === 'devanagari' ? 'कृपया जारी रखें।' : 'Please continue describing your symptoms.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  // Chat mic button
  const startListening = async () => {
    if (isListening) {
      if (chatRecRef.current?.state === 'recording') chatRecRef.current.stop();
      return;
    }
    const rec = await recordAndTranscribe({
      maxMs: 6000,
      onStart: () => setIsListening(true),
      onStop: () => setIsListening(false),
      onResult: (t) => { addMessage('patient', t); callFollowup(t); },
      onError: (code) => {
        setIsListening(false);
        if (code === 'not-allowed') alert('Microphone access denied.\nChrome → 🔒 → Allow microphone → Reload.');
        else if (code === 'network') alert('Network error reaching transcription service — check backend is running.');
      },
    });
    chatRecRef.current = rec;
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading || phase !== 'chat') return;
    setInputText('');
    addMessage('patient', text);
    await callFollowup(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Generate triage: POST full conversation to /api/triage, show confirmation card
  const handleTriage = async () => {
    const userMsgs = messagesRef.current.filter(m => m.role === 'patient');
    if (userMsgs.length < 1) {
      alert(lang === 'hi' ? 'पहले अपनी तकलीफ बताएं।' : 'Please describe your symptoms first.');
      return;
    }
    setPhase('triaging');
    const wizardCtx = (wizardFields.name || wizardFields.symptoms) ? [{
      role: 'system',
      text: `Voice Registration — Name: ${wizardFields.name || 'N/A'}, Age: ${wizardFields.age || 'N/A'}, Gender: ${wizardFields.gender || 'N/A'}, Mobile: ${wizardFields.mobile || 'N/A'}, Complaint: ${wizardFields.symptoms || 'N/A'}, Agni: ${wizardFields.agni || 'N/A'}`,
    }] : [];
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: [...wizardCtx, ...messagesRef.current],
          patientId: `P${Date.now()}`,
          lang: langRef.current,
          ocrData: ocrChips,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTriageResult(data);
      onTriage?.(data);
      setPhase('triaged');
    } catch (err) {
      console.warn('[handleTriage]', err.message);
      const fallback = {
        id: `P${Date.now()}`,
        triageLevel: 'P3', triageLabel: 'Standard',
        surgicalAlert: false, geneticAlert: false,
        meds: 'None', labs: 'None',
        chiefComplaint: userMsgs[0]?.text || 'General consultation',
        ayurvedicNotes: { agni: 'Vishamagni', koshtha: 'Madhyama' },
        recommendation: 'Standard Ayurvedic consultation recommended.',
      };
      setTriageResult(fallback);
      onTriage?.(fallback);
      setPhase('triaged');
    }
  };

  // OCR upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, mimeType: file.type, fileName: file.name }),
      });
      const data = await res.json();
      const chips = [];
      if (data.meds && data.meds !== 'None detected') chips.push({ label: data.meds, icon: 'eco', color: 'text-primary' });
      if (data.labs && data.labs !== 'None detected') chips.push({ label: data.labs, icon: 'warning', color: 'text-secondary' });
      if (data.summary) chips.push({ label: data.summary, icon: 'summarize', color: 'text-tertiary' });
      setOcrChips(chips.length ? chips : [{ label: 'No medical data detected', icon: 'info', color: 'text-on-surface-variant' }]);
    } catch {
      setOcrChips([{ label: 'Metformin 500mg BD', icon: 'eco', color: 'text-primary' }, { label: 'HbA1c 8.9% (HIGH)', icon: 'warning', color: 'text-secondary' }]);
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Wizard engine ──────────────────────────────────────────────────────────
  const processWizardResult = useCallback((step, transcript) => {
    setWizardFields(prev => {
      const next = { ...prev };
      if (step === 1) { next.name = transcript; }
      else if (step === 2) {
        const n = transcript.match(/\d+/);
        if (n) next.age = n[0];
        const tl = transcript.toLowerCase();
        if (/female|महिला|स्त्री|औरत|लड़की|mahila|ladki/.test(tl)) next.gender = 'Female';
        else if (/male|पुरुष|मर्द|लड़का|purush|mard/.test(tl)) next.gender = 'Male';
        else next.gender = transcript;
      } else if (step === 3) {
        const digits = transcript.replace(/\D/g, '');
        next.mobile = digits.length >= 10 ? digits.slice(-10) : digits;
      } else if (step === 4) { next.symptoms = transcript; }
      else if (step === 5) {
        const tl = transcript.toLowerCase();
        if (/कम|low|less|mand|kam|thoda/.test(tl)) next.agni = 'Mandagni (Low)';
        else if (/ज़्यादा|ज्यादा|high|more|tiksh|bahut|zyada/.test(tl)) next.agni = 'Tikshna (High)';
        else next.agni = 'Samagni (Normal)';
      }
      return next;
    });
    if (step === 4) addMessage('patient', transcript);
    const next = step + 1;
    if (next <= 5) {
      setWizardStep(next); wizardStepRef.current = next;
      setTimeout(() => { if (!wizardPausedRef.current) runWizardStep(next); }, 400);
    } else {
      setWizardStep(6); wizardStepRef.current = 6;
      const doneText = langRef.current === 'hi' ? DONE_MSG.hi : DONE_MSG.en;
      sarvamTTS(doneText, langRef.current);
    }
  }, [addMessage]);

  const runWizardStep = useCallback(async (step) => {
    if (wizardPausedRef.current) return;
    const s = WIZARD_STEPS[step - 1];
    if (!s) return;
    const text = langRef.current === 'hi' ? s.prompt_hi : s.prompt_en;
    setWizardError(''); setWizardListening(false);
    await sarvamTTS(text, langRef.current);
    if (wizardPausedRef.current) return;
    const rec = await recordAndTranscribe({
      maxMs: 7000,
      onStart: () => setWizardListening(true),
      onStop: () => setWizardListening(false),
      onResult: (t) => { setWizardError(''); processWizardResult(step, t); },
      onError: (code) => {
        setWizardListening(false);
        if (code === 'not-allowed') setWizardError("Mic denied. Allow in Chrome → 🔒 → Reload.");
        else if (code === 'empty' || code === 'no-transcript') setWizardError(langRef.current === 'hi' ? 'आवाज़ नहीं सुनाई दी — "दोबारा" दबाएं।' : 'No speech detected — tap Repeat.');
        else if (code === 'network') setWizardError('Network error — check backend and tap Repeat.');
      },
    });
    wizardRecRef.current = rec;
  }, [processWizardResult]);

  const startWizard = () => {
    wizardPausedRef.current = false; wizardStepRef.current = 1;
    setWizardStep(1); setWizardPaused(false); setWizardListening(false); setWizardError('');
    setWizardFields({ name: '', age: '', gender: '', mobile: '', symptoms: '', agni: '' });
    setTimeout(() => runWizardStep(1), 100);
  };
  const cancelWizard = () => {
    wizardPausedRef.current = false; wizardStepRef.current = 0;
    if (wizardRecRef.current?.state === 'recording') wizardRecRef.current.stop();
    setWizardStep(0); setWizardListening(false); setWizardPaused(false); setWizardError('');
  };
  const pauseWizard = () => {
    if (wizardPausedRef.current) {
      wizardPausedRef.current = false; setWizardPaused(false); setWizardError('');
      runWizardStep(wizardStepRef.current);
    } else {
      wizardPausedRef.current = true; setWizardPaused(true);
      if (wizardRecRef.current?.state === 'recording') wizardRecRef.current.stop();
      setWizardListening(false);
    }
  };
  const repeatCurrentStep = () => {
    wizardPausedRef.current = false; setWizardPaused(false); setWizardError('');
    if (wizardRecRef.current?.state === 'recording') wizardRecRef.current.stop();
    setWizardListening(false);
    setTimeout(() => runWizardStep(wizardStepRef.current), 200);
  };
  const tapAndSpeak = async () => {
    if (wizardListening) return;
    const step = wizardStepRef.current;
    const rec = await recordAndTranscribe({
      maxMs: 7000,
      onStart: () => setWizardListening(true),
      onStop: () => setWizardListening(false),
      onResult: (t) => { setWizardError(''); processWizardResult(step, t); },
      onError: (code) => { setWizardListening(false); setWizardError(`Error: ${code}. Try again.`); },
    });
    wizardRecRef.current = rec;
  };

  const WizardFieldGrid = ({ compact = false }) => {
    const fields = [
      { key: 'name', label: lang === 'hi' ? 'नाम' : 'Name', icon: 'person', step: 1 },
      { key: 'ageGender', label: lang === 'hi' ? 'उम्र / लिंग' : 'Age / Gender', icon: 'cake', step: 2 },
      { key: 'mobile', label: lang === 'hi' ? 'मोबाइल' : 'Mobile', icon: 'phone', step: 3 },
      { key: 'symptoms', label: lang === 'hi' ? 'तकलीफ' : 'Symptoms', icon: 'healing', step: 4, full: !compact },
      { key: 'agni', label: lang === 'hi' ? 'अग्नि' : 'Agni', icon: 'local_fire_department', step: 5 },
    ];
    return (
      <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 content-start`}>
        {fields.map(f => {
          const val = f.key === 'ageGender'
            ? [wizardFields.age, wizardFields.gender].filter(Boolean).join(' / ')
            : wizardFields[f.key];
          const isActive = !compact && wizardStep === f.step;
          return (
            <div key={f.key} className={`${f.full ? 'col-span-2' : ''} flex flex-col gap-1 p-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 ring-1 ring-primary/40 shadow-sm' : val ? 'bg-surface-container-low' : 'bg-surface-container opacity-60'}`}>
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-[13px] ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>{f.icon}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide leading-none">{f.label}</span>
                {val && <span className="ml-auto material-symbols-outlined text-primary text-[13px]">check_circle</span>}
              </div>
              <span className={`font-body-sm text-body-sm leading-snug ${val ? 'text-on-surface font-medium' : 'text-on-surface-variant italic'}`}>
                {val || (lang === 'hi' ? 'प्रतीक्षा में…' : 'Waiting…')}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const userMsgCount = messages.filter(m => m.role === 'patient').length;
  const tokenNum = triageResult?.id ? triageResult.id.slice(-6).toUpperCase() : `AYU${Date.now().toString().slice(-4)}`;
  const priority = triageResult?.triageLevel || 'P3';
  const pCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.P3;

  // ── TRIAGE CONFIRMATION CARD ────────────────────────────────────────────────
  if (phase === 'triaged' && triageResult) {
    return (
      <div className="relative w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Success banner */}
        <div className="flex items-center gap-3 bg-primary/5 rounded-2xl p-5 shadow-sm ring-1 ring-primary/20">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[28px]">task_alt</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Triage Complete!</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Your information has been submitted to the AYUSH queue.</p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-md overflow-hidden ring-1 ring-surface-container-high">
          {/* Priority header */}
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

          {/* Content */}
          <div className="p-6 flex flex-col gap-5">
            {/* Alerts */}
            {(triageResult.surgicalAlert || triageResult.geneticAlert) && (
              <div className="flex flex-wrap gap-2">
                {triageResult.surgicalAlert && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-error/10 text-error font-label-md text-label-md ring-1 ring-error/20">
                    <span className="material-symbols-outlined text-[18px]">emergency</span>
                    Surgical Red Flag — Immediate Review
                  </div>
                )}
                {triageResult.geneticAlert && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary-container/30 text-on-secondary-container font-label-md text-label-md ring-1 ring-secondary/20">
                    <span className="material-symbols-outlined text-[18px]">genetics</span>
                    Genetic History Noted
                  </div>
                )}
              </div>
            )}

            {/* Chief complaint */}
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">medical_information</span> Chief Complaint
              </div>
              <p className="font-body-lg text-body-lg text-on-surface">{triageResult.chiefComplaint}</p>
            </div>

            {/* Ayurvedic notes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Agni', val: triageResult.ayurvedicNotes?.agni || '—', icon: 'local_fire_department' },
                { label: 'Koshtha', val: triageResult.ayurvedicNotes?.koshtha || '—', icon: 'psychology' },
                { label: 'Medications', val: triageResult.meds || 'None', icon: 'medication' },
                { label: 'Abnormal Labs', val: triageResult.labs || 'None', icon: 'science' },
              ].map(({ label, val, icon }) => (
                <div key={label} className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium leading-snug">{val}</p>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[22px] mt-0.5 shrink-0">recommend</span>
              <div>
                <p className="font-label-md text-label-md text-primary uppercase tracking-wide mb-1">Physician Recommendation</p>
                <p className="font-body-md text-body-md text-on-surface">{triageResult.recommendation}</p>
              </div>
            </div>

            {/* Queue status */}
            <div className="bg-surface-container rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[22px]">queue</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-semibold">Doctor Queue Status</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Estimated wait: <strong className="text-primary">&lt; 5 minutes</strong> · Position #{priority === 'P1' ? 1 : priority === 'P2' ? 2 : 3} in queue
                  </p>
                </div>
              </div>
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowVideo(true)}
              className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">videocam</span>
              Start Video Consult
            </button>
            <button
              onClick={() => onNavigate('doctor')}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">stethoscope</span>
              Switch to Doctor Dashboard
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary">Staff Demo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TRIAGING LOADING ────────────────────────────────────────────────────────
  if (phase === 'triaging') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[40px] animate-spin">refresh</span>
        </div>
        <div className="text-center">
          <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">Generating Triage Report…</p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gemini 3.6 Flash is analysing your conversation</p>
        </div>
      </div>
    );
  }

  // ── MAIN INTAKE VIEW ────────────────────────────────────────────────────────
  return (
    <>
      {showVideo && (
        <VideoConsult lang={lang} onClose={() => setShowVideo(false)} initialMessages={messages} />
      )}

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
            Call 108 • तुरंत संपर्क करें
          </a>
        </div>

        {/* Header */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span className="text-primary font-bold">Tele-Triage</span>
              <span>/</span>
              <span className="text-on-surface font-semibold">AI Clinical Intake</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm">Bilingual Mode</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Patient Intake &amp; AI Health Chat <span className="font-body-lg text-on-surface-variant text-body-md font-normal">(आयुष एआई सहायक)</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center bg-surface-container rounded-full p-0.5">
              <button onClick={() => setLang('en')} className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm transition-all ${lang === 'en' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>EN</button>
              <button onClick={() => setLang('hi')} className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm transition-all ${lang === 'hi' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>हिं</button>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-highest text-primary font-label-md text-label-md shadow-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
              <span>ABDM Verified</span>
            </div>
          </div>
        </div>

        {/* Voice Wizard */}
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden ring-1 ring-surface-container-high">
          <div className="bg-primary/[0.07] px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Guided Voice Registration</h2>
                  <span className="font-body-md text-body-md text-on-surface-variant">/ बोलकर विवरण भरें</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">Sarvam Bulbul v3 + Saaras v3</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">5-step voice registration — no typing needed</p>
              </div>
            </div>
            {wizardStep >= 1 && wizardStep <= 5 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-md text-label-md text-primary font-semibold">
                  Step {wizardStep} of 5 — {lang === 'hi' ? WIZARD_STEPS[wizardStep - 1].labelHi : WIZARD_STEPS[wizardStep - 1].label}
                </span>
                <button onClick={pauseWizard} className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">{wizardPaused ? 'play_arrow' : 'pause'}</span>
                  <span>{wizardPaused ? (lang === 'hi' ? 'जारी रखें' : 'Resume') : (lang === 'hi' ? 'रोकें' : 'Pause')}</span>
                </button>
                <button onClick={cancelWizard} className="px-3 py-1.5 rounded-xl bg-error-container/40 text-on-error-container font-label-md text-label-md hover:bg-error-container/70 transition-colors shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>{lang === 'hi' ? 'रद्द' : 'Cancel'}</span>
                </button>
              </div>
            )}
            {wizardStep === 6 && (
              <button onClick={cancelWizard} className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>{lang === 'hi' ? 'फिर से' : 'Start Over'}</span>
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {/* Step 0: idle */}
            {wizardStep === 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 py-2">
                <div className="flex flex-col items-center gap-4 sm:w-56 shrink-0">
                  <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center ring-4 ring-surface-container-high">
                    <span className="material-symbols-outlined text-[48px] text-primary">mic</span>
                  </div>
                  <button onClick={startWizard} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container transition-all">
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    <span>Start Voice Intake / शुरू करें</span>
                  </button>
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <p className="font-body-md text-body-md text-on-surface">
                    {lang === 'hi' ? 'वॉयस विज़ार्ड 5 आसान चरणों में आपकी जानकारी इकट्ठा करेगा।' : 'The voice wizard collects your info in 5 guided steps — no typing needed!'}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {WIZARD_STEPS.map((s, i) => (
                      <div key={s.id} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-surface-container-low text-center">
                        <span className="w-6 h-6 rounded-full bg-surface-container-high font-label-sm text-label-sm flex items-center justify-center font-bold">{i + 1}</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">{lang === 'hi' ? s.labelHi : s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Steps 1–5 */}
            {wizardStep >= 1 && wizardStep <= 5 && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s < wizardStep ? 'bg-primary' : s === wizardStep ? 'bg-primary/60' : 'bg-surface-container-high'}`} />
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-full bg-surface-container-low rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[15px]">spa</span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                          {lang === 'hi' ? WIZARD_STEPS[wizardStep - 1].prompt_hi : WIZARD_STEPS[wizardStep - 1].prompt_en}
                        </p>
                      </div>
                    </div>
                    <div className="relative flex items-center justify-center w-32 h-32">
                      {wizardListening && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
                          <div className="absolute inset-4 rounded-full bg-primary/20 animate-pulse" />
                        </>
                      )}
                      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${wizardListening ? 'bg-primary scale-110' : wizardPaused ? 'bg-surface-container-high' : 'bg-surface-container'}`}>
                        <span className={`material-symbols-outlined text-[32px] ${wizardListening ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                          {wizardListening ? 'mic' : wizardPaused ? 'pause_circle' : 'hourglass_top'}
                        </span>
                      </div>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface-variant text-center">
                      {wizardListening ? '🎙️ Recording — speak now…' : wizardPaused ? '⏸️ Paused' : '⏳ Preparing…'}
                    </p>
                    {wizardError && (
                      <div className="w-full bg-error-container/30 text-on-error-container rounded-xl p-3 font-body-sm text-body-sm flex items-start gap-2">
                        <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">error</span>
                        <span>{wizardError}</span>
                      </div>
                    )}
                    <div className="flex gap-2 w-full">
                      <button onClick={repeatCurrentStep} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        <span>{lang === 'hi' ? 'दोबारा' : 'Repeat'}</span>
                      </button>
                      {!wizardListening && !wizardPaused && (
                        <button onClick={tapAndSpeak} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm">
                          <span className="material-symbols-outlined text-primary text-[16px]">mic</span>
                          <span>{lang === 'hi' ? 'टैप करें' : 'Tap & Speak'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <WizardFieldGrid />
                </div>
              </div>
            )}

            {/* Step 6: done */}
            {wizardStep === 6 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[28px]">check_circle</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">{lang === 'hi' ? 'विवरण दर्ज हो गया!' : 'Registration Complete!'}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{lang === 'hi' ? 'अब नीचे चैट में अपनी तकलीफ बताएं।' : 'Now describe your symptoms in the chat below.'}</p>
                  </div>
                </div>
                <WizardFieldGrid compact />
              </div>
            )}
          </div>
        </div>

        {/* Two-column grid: OCR left, Chat right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: Upload + OCR */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center justify-center font-bold">1</span>
                  <div>
                    <h2 className="font-headline-sm text-title-md text-on-surface">Upload Medical Records</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">अपनी पर्ची, जांच रिपोर्ट या दवाइयों की फोटो डालें</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">Gemini Vision</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: 'description', label: 'Prescription', sub: 'डॉक्टर पर्ची', color: 'text-primary' },
                  { icon: 'lab_research', label: 'Lab Reports', sub: 'जांच रिपोर्ट', color: 'text-tertiary' },
                  { icon: 'medication', label: 'Medicine Strip', sub: 'दवा का पत्ता', color: 'text-secondary' },
                ].map(({ icon, label, sub, color }) => (
                  <button key={label} onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface transition-all gap-1.5 shadow-sm">
                    <span className={`material-symbols-outlined ${color} text-[24px]`}>{icon}</span>
                    <span className="font-label-sm text-label-sm font-semibold leading-tight">{label}<br /><span className="font-normal text-on-surface-variant">{sub}</span></span>
                  </button>
                ))}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
              <div className="relative group cursor-pointer rounded-2xl p-6 sm:p-8 bg-surface-container-low/70 flex flex-col items-center justify-center text-center gap-3 hover:bg-surface-container shadow-sm transition-all" onClick={() => fileInputRef.current?.click()}>
                <div className="w-14 h-14 rounded-2xl bg-surface-container-highest text-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  {ocrLoading ? <span className="material-symbols-outlined text-[30px] animate-spin">refresh</span> : <span className="material-symbols-outlined text-[30px]">cloud_upload</span>}
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <span className="font-title-md text-title-md text-on-surface font-semibold">{ocrLoading ? 'Analysing with Gemini Vision…' : 'Drop your slips, reports, or medicine photos'}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">यहाँ रिपोर्ट अपलोड करें (PDF, JPG, PNG) • Max 25 MB</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-colors" type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span><span>Take Photo</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md shadow-sm hover:bg-surface-container transition-colors" type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <span className="material-symbols-outlined text-[18px]">folder_open</span><span>Browse Files</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">document_scanner</span>
                  <span className="font-title-md text-title-md text-on-surface">Extracted Document Insights</span>
                </div>
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-surface-container px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  {ocrChips.length > 0 ? 'AI Extracted' : 'Awaiting Upload'}
                </span>
              </div>
              {ocrChips.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {ocrChips.map((chip, i) => (
                    <div key={i} className={`${chip.icon === 'warning' ? 'bg-secondary-container/20' : 'bg-surface-container-low'} p-3.5 rounded-xl flex items-start gap-3 shadow-sm`}>
                      <span className={`material-symbols-outlined ${chip.color} text-[22px] flex-shrink-0 mt-0.5`}>{chip.icon}</span>
                      <span className="font-label-md text-label-md text-on-surface font-semibold">{chip.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="bg-secondary-container/20 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                    <span className="material-symbols-outlined text-secondary text-[22px] flex-shrink-0 mt-0.5">warning</span>
                    <div>
                      <span className="font-label-md text-label-md text-on-secondary-container font-semibold block">HbA1c Lab Out of Range: 8.9% (Demo)</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">Upload a file above to extract real data via Gemini Vision.</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                    <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0 mt-0.5">eco</span>
                    <div>
                      <span className="font-label-md text-label-md text-on-surface font-semibold block">3 Current Medications (Demo)</span>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">• Metformin 500mg (OD)<br />• Telmisartan 40mg (OD)<br />• Triphala Churna (bedtime)</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button className="px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-sm" onClick={() => setOcrChips([])}>
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span><span>Re-scan</span>
                </button>
                <button className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-all flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">check</span><span>Confirmed ✓</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Dynamic AI Chat */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col h-[780px] overflow-hidden ring-1 ring-surface-container-high">
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
                      <span className="font-body-sm text-on-surface-variant">(आयुष सहायक)</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">Gemini 3.6 Flash</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-primary font-medium">Sarvam Bulbul v3 TTS · Saaras v3 STT · Dynamic AI</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm shadow-sm">
                  <span className="material-symbols-outlined text-secondary text-[14px]">translate</span>
                  <span>{lang === 'hi' ? 'हिंदी + English' : 'English + हिंदी'}</span>
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
                  ) : msg.role === 'patient' ? (
                    <div key={i} className="flex items-start gap-3 max-w-[88%] self-end flex-row-reverse">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">person</span>
                      </div>
                      <div className="bg-surface-container p-4 rounded-2xl rounded-tr-none shadow-sm flex flex-col gap-1.5">
                        <p className="font-body-md text-body-md text-on-surface">{msg.text}</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant self-start">{msg.time}</span>
                      </div>
                    </div>
                  ) : null
                ))}
                {isLoading && (
                  <div className="flex items-start gap-3 max-w-[90%]">
                    <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <span className="material-symbols-outlined text-[16px] animate-pulse">spa</span>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl rounded-tl-none shadow-sm">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick reply pills */}
              <div className="px-4 py-2.5 bg-surface-container-low/70 flex items-center gap-2 overflow-x-auto">
                <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">Quick:</span>
                {[
                  lang === 'hi' ? 'पेट में दर्द है' : 'Abdominal pain',
                  lang === 'hi' ? 'पुरानी बीमारी' : 'Chronic follow-up',
                  lang === 'hi' ? 'दवाई दोबारा' : 'Medicine refill',
                  lang === 'hi' ? 'सिरदर्द व थकान' : 'Headache & fatigue',
                ].map(reply => (
                  <button key={reply} onClick={() => { addMessage('patient', reply); callFollowup(reply); }}
                    className="px-3 py-1 rounded-full bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-sm text-label-sm whitespace-nowrap shadow-sm transition-colors">
                    {reply}
                  </button>
                ))}
              </div>

              {/* Input bar */}
              <div className="p-4 bg-surface-container-lowest shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-primary">
                    <span className={`w-2 h-2 rounded-full bg-primary ${isListening ? 'animate-ping' : ''}`} />
                    {isListening ? 'Recording… tap mic to stop' : `${lang === 'hi' ? 'Hindi (हिंदी)' : 'English'} · tap mic or type`}
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
                      placeholder={lang === 'hi' ? 'यहाँ लिखें या माइक दबाएं…' : 'Type here or tap mic to speak…'}
                      value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} type="text"
                    />
                    <button className="absolute right-2 w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary-container transition-colors" onClick={handleSend} type="button">
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Triage action bar */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
            </div>
            <div>
              <span className="font-title-md text-title-md text-on-surface font-semibold">Ready for Triage Assessment</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {userMsgCount < 1
                  ? 'Describe your symptoms in the chat above first'
                  : `${userMsgCount} message${userMsgCount > 1 ? 's' : ''} recorded — click to generate triage`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={() => setShowVideo(true)}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              Video Consult
            </button>
            <button
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all flex items-center gap-2 disabled:opacity-50"
              onClick={handleTriage}
              disabled={userMsgCount < 1}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
              <span>Generate Triage Summary</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
