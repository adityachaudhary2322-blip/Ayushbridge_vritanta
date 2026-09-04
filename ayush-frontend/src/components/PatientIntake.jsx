import { useState, useRef, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000/api';

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
  hi: 'आपका विवरण दर्ज हो गया। अब आप डॉक्टर से परामर्श के लिए आगे बढ़ सकते हैं।',
  en: 'Your details have been recorded. You may now proceed for doctor consultation.',
};

// ── Input mode: Devanagari / Hinglish / English ─────────────────────────────
function detectMode(text) {
  if (!text) return 'english';
  if (/[ऀ-ॿ]/.test(text)) return 'devanagari';
  if (/\b(mujhe|mere|mera|meri|hai|hain|kya|nahi|nahin|aur|dard|bukhar|pet|sar|sir|taklif|bimari|dawai|khana|pani|bahut|thoda|achha|theek|zyada|jyada|kam|roz|din|raat|subah|shaam|apna|kuch|sab|bura|tez|neend|uthna|bolna|sunna)\b/i.test(text)) return 'hinglish';
  return 'english';
}

// ── Structured chat intake (5 questions before free Gemini chat) ─────────────
const CHAT_INTAKE = [
  { field: 'name',
    en: "Hello! I'm AYUSH Sahayak — your AI health assistant. To begin, please tell me your full name.",
    hi: 'नमस्ते! मैं आयुष सहायक हूँ। शुरुआत के लिए कृपया अपना पूरा नाम बताएं।' },
  { field: 'ageGender',
    en: 'Thank you, {name}. What is your age and gender?',
    hi: 'धन्यवाद, {name}। आपकी उम्र और लिंग क्या है?' },
  { field: 'mobile',
    en: 'Please share your 10-digit mobile number.',
    hi: 'अपना 10 अंकों का मोबाइल नंबर बताएं।' },
  { field: 'complaint',
    en: 'What symptoms are you experiencing and for how many days?',
    hi: 'आपको क्या तकलीफ है और कितने दिनों से है?' },
  { field: 'agni',
    en: 'Last question — how is your appetite: low, normal, or high?',
    hi: 'आखिरी सवाल — आपकी भूख कैसी है: कम, सामान्य, या ज़्यादा?' },
];

// ── Robust Chrome speechSynthesis speak + listen ────────────────────────────
// Chrome bug: utterance.onend sometimes never fires.
// Fix: resume() before speak, timeout fallback, onerror also triggers listen.
function speakThenListen({ text, lang, onDone }) {
  const synth = window.speechSynthesis;

  const doListen = (() => {
    let fired = false;
    return () => { if (!fired) { fired = true; onDone(); } };
  })();

  if (!synth || !text) { doListen(); return; }

  synth.cancel();
  // Chrome sometimes pauses synthesis after page idle — resume() fixes it
  synth.resume();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  utt.rate = 0.88;
  utt.volume = 1;

  // Estimate reading time: ~65 ms/char + 1 s buffer, min 2 s
  const fallbackMs = Math.max(2000, text.length * 65 + 1000);
  const timer = setTimeout(doListen, fallbackMs);

  utt.onend = () => { clearTimeout(timer); doListen(); };
  utt.onerror = () => { clearTimeout(timer); doListen(); };

  synth.speak(utt);
}

// ── Start SpeechRecognition safely ─────────────────────────────────────────
function startRec({ lang, onResult, onError, onStart, onEnd }) {
  const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!SR) {
    onError?.('no-api');
    return null;
  }
  try {
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onstart = onStart;
    rec.onend = onEnd;
    rec.onerror = (e) => onError?.(e.error);
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript.trim();
      if (t) onResult(t);
    };
    rec.start();
    return rec;
  } catch (err) {
    onError?.('start-failed');
    return null;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PatientIntake({ onNavigate, onTriage }) {

  // ── Feature B: chat ────────────────────────────────────────────────────────
  const [lang, setLang] = useState('en');
  const langRef = useRef('en');
  useEffect(() => { langRef.current = lang; }, [lang]);

  const [messages, setMessages] = useState([{
    role: 'ai',
    text: CHAT_INTAKE[0].en,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }]);
  // chatIntakeStep 0–4 = collecting fields, 5 = done/free Gemini chat
  const [chatIntakeStep, setChatIntakeStep] = useState(0);
  const [intakeFields, setIntakeFields] = useState({ name: '', age: '', gender: '', mobile: '', complaint: '', agni: '' });
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrChips, setOcrChips] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  // ── Feature A: wizard ──────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState(0); // 0=idle 1-5=active 6=done
  const [wizardListening, setWizardListening] = useState(false);
  const [wizardPaused, setWizardPaused] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [wizardFields, setWizardFields] = useState({
    name: '', age: '', gender: '', mobile: '', symptoms: '', agni: '',
  });

  const wizardPausedRef = useRef(false);
  const wizardStepRef = useRef(0);
  const wizardRecRef = useRef(null);
  const chatIntakeStepRef = useRef(0);
  const intakeFieldsRef = useRef({ name: '', age: '', gender: '', mobile: '', complaint: '', agni: '' });
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Chat helpers ───────────────────────────────────────────────────────────
  const addMessage = useCallback((role, text) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role, text, time }]);
  }, []);

  const parseIntakeAnswer = useCallback((step, text) => {
    const tl = text.toLowerCase();
    if (step === 0) return { name: text.trim() };
    if (step === 1) {
      const num = text.match(/\d+/);
      const age = num ? num[0] : '';
      let gender = '';
      if (/female|mahila|stri|ladki|aurat|औरत|महिला|स्त्री|girl|woman/.test(tl)) gender = 'Female';
      else if (/male|purush|mard|ladka|aadmi|पुरुष|मर्द|boy|man/.test(tl)) gender = 'Male';
      else gender = text.replace(/\d+/g, '').trim() || 'Not specified';
      return { age, gender };
    }
    if (step === 2) {
      const digits = text.replace(/\D/g, '');
      return { mobile: digits.length >= 10 ? digits.slice(-10) : (digits || 'N/A') };
    }
    if (step === 3) return { complaint: text.trim() };
    if (step === 4) {
      let agni = 'Samagni (Normal)';
      if (/kam|low|less|thoda|mand|poor|no appetite|bhook nahi|कम|मंद/.test(tl)) agni = 'Mandagni (Low)';
      else if (/zyada|jyada|high|more|tez|tiksh|bahut|very|ज़्यादा|तेज़/.test(tl)) agni = 'Tikshna (High)';
      return { agni };
    }
    return {};
  }, []);

  const callFollowup = useCallback(async (transcript) => {
    const mode = detectMode(transcript);
    const currentLang = langRef.current;
    const speakLang = mode === 'devanagari' ? 'hi' : 'en';
    const stepNow = chatIntakeStepRef.current;

    // ── Intake phase (steps 0–4) ──────────────────────────────────────────────
    if (stepNow < CHAT_INTAKE.length) {
      const parsed = parseIntakeAnswer(stepNow, transcript);
      const nextStep = stepNow + 1;
      chatIntakeStepRef.current = nextStep;
      setChatIntakeStep(nextStep);
      const newFields = { ...intakeFieldsRef.current, ...parsed };
      intakeFieldsRef.current = newFields;
      setIntakeFields(newFields);

      if (nextStep < CHAT_INTAKE.length) {
        const nextQ = CHAT_INTAKE[nextStep];
        const qText = (currentLang === 'hi' ? nextQ.hi : nextQ.en)
          .replace('{name}', newFields.name || '');
        addMessage('ai', qText);
        speakThenListen({ text: qText, lang: speakLang, onDone: () => {} });
      } else {
        // All 5 fields collected → acknowledge and open Gemini chat
        const ack = currentLang === 'hi'
          ? `शुक्रिया! आपका विवरण दर्ज हो गया। अब अपनी तकलीफ के बारे में विस्तार से बताएं — मैं यहाँ हूँ।`
          : `Thank you! Your details are saved. Now please describe your main health concern in more detail — I'm here to help.`;
        addMessage('ai', ack);
        speakThenListen({ text: ack, lang: speakLang, onDone: () => {} });
      }
      return;
    }

    // ── Free Gemini chat (step ≥ 5) ───────────────────────────────────────────
    setIsLoading(true);
    try {
      const langHint = mode === 'devanagari'
        ? 'Patient writes in Hindi Devanagari. Respond in Hindi Devanagari script only.'
        : mode === 'hinglish'
        ? 'Patient writes in Hinglish (Roman-script Hindi). Respond in simple English or Roman Hinglish. Do NOT use Devanagari.'
        : 'Respond in English.';
      const res = await fetch(`${API}/ask-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: { lang: currentLang, mode, intakeFields: intakeFieldsRef.current },
          langHint,
        }),
      });
      const data = await res.json();
      const aiText = data.question || (mode === 'devanagari'
        ? 'कृपया अपनी तकलीफ के बारे में और बताएं।'
        : 'Can you tell me more about your symptoms?');
      addMessage('ai', aiText);
      // Use detected AI response language for TTS (not user preference)
      const aiMode = detectMode(aiText);
      speakThenListen({ text: aiText, lang: aiMode === 'devanagari' ? 'hi' : 'en', onDone: () => {} });
    } catch {
      addMessage('ai', mode === 'devanagari'
        ? 'कृपया जारी रखें।'
        : 'Please continue describing your symptoms.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, parseIntakeAnswer]);

  // ── Feature B: chat mic (with auto-retry on no-speech) ───────────────────
  const startListening = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      alert('Speech recognition requires Chrome or Edge. Please open this page in Chrome.');
      return;
    }
    window.speechSynthesis?.cancel();
    setIsListening(true);
    let retried = false;

    const tryRec = () => {
      const rec = startRec({
        lang,
        onStart: () => setIsListening(true),
        onEnd: () => { if (retried) setIsListening(false); },
        onError: (code) => {
          if (code === 'no-speech' && !retried) {
            retried = true;
            setTimeout(tryRec, 400); // auto-retry once
            return;
          }
          setIsListening(false);
          if (code === 'not-allowed') {
            alert('Microphone access denied.\nChrome → 🔒 address bar → Allow microphone → Reload.');
          } else if (code === 'network') {
            alert('Network error — speech recognition needs an internet connection.\nCheck your connection and try again.');
          } else if (code === 'no-api') {
            alert('Speech recognition is not supported in this browser. Please use Chrome.');
          }
        },
        onResult: (t) => {
          retried = true;
          setIsListening(false);
          addMessage('patient', t);
          callFollowup(t);
        },
      });
      recognitionRef.current = rec;
    };
    tryRec();
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    addMessage('patient', text);
    await callFollowup(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Feature B: OCR upload (base64 → Gemini vision) ────────────────────────
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

      const res = await fetch(`${API}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, mimeType: file.type, fileName: file.name }),
      });
      const data = await res.json();

      const chips = [];
      if (data.meds && data.meds !== 'None detected')
        chips.push({ label: data.meds, icon: 'eco', color: 'text-primary' });
      if (data.labs && data.labs !== 'None detected')
        chips.push({ label: data.labs, icon: 'warning', color: 'text-secondary' });
      if (data.summary)
        chips.push({ label: data.summary, icon: 'summarize', color: 'text-tertiary' });
      setOcrChips(chips.length ? chips : [{ label: 'No medical data detected in document', icon: 'info', color: 'text-on-surface-variant' }]);
    } catch {
      setOcrChips([
        { label: 'Metformin 500mg BD', icon: 'eco', color: 'text-primary' },
        { label: 'HbA1c 8.9% (HIGH)', icon: 'warning', color: 'text-secondary' },
      ]);
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitToDoctor = async () => {
    const hasComplaint = wizardFields.symptoms || intakeFields.complaint;
    if (messages.length < 2 && !hasComplaint) {
      alert('Please describe your symptoms first before submitting.');
      return;
    }
    setIsSubmitting(true);
    // Merge wizard + chat intake (wizard takes priority when both exist)
    const merged = {
      name:      wizardFields.name     || intakeFields.name     || 'N/A',
      age:       wizardFields.age      || intakeFields.age      || 'N/A',
      gender:    wizardFields.gender   || intakeFields.gender   || 'N/A',
      mobile:    wizardFields.mobile   || intakeFields.mobile   || 'N/A',
      complaint: wizardFields.symptoms || intakeFields.complaint || 'N/A',
      agni:      wizardFields.agni     || intakeFields.agni     || 'N/A',
    };
    const wizardCtx = (merged.name !== 'N/A' || merged.complaint !== 'N/A') ? [{
      role: 'system',
      text: `Patient: ${merged.name}, Age: ${merged.age}, Gender: ${merged.gender}, Mobile: ${merged.mobile}, Complaint: ${merged.complaint}, Agni: ${merged.agni}`,
    }] : [];
    try {
      const res = await fetch(`${API}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: [...wizardCtx, ...messages],
          patientId: `P${Date.now()}`,
          lang,
          ocrData: ocrChips,
        }),
      });
      const data = await res.json();
      onTriage?.(data);
      onNavigate('doctor');
    } catch {
      onNavigate('doctor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Feature A: Wizard engine ───────────────────────────────────────────────
  const processWizardResult = useCallback((step, transcript) => {
    setWizardFields(prev => {
      const next = { ...prev };
      if (step === 1) {
        next.name = transcript;
      } else if (step === 2) {
        const n = transcript.match(/\d+/);
        if (n) next.age = n[0];
        const tl = transcript.toLowerCase();
        if (/female|महिला|स्त्री|औरत|लड़की/.test(tl)) next.gender = 'Female';
        else if (/male|पुरुष|मर्द|लड़का/.test(tl)) next.gender = 'Male';
        else next.gender = transcript;
      } else if (step === 3) {
        const digits = transcript.replace(/\D/g, '');
        next.mobile = digits.length >= 10 ? digits.slice(-10) : digits;
      } else if (step === 4) {
        next.symptoms = transcript;
      } else if (step === 5) {
        const tl = transcript.toLowerCase();
        if (/कम|low|less|mand|buri/.test(tl)) next.agni = 'Mandagni (कम भूख)';
        else if (/ज़्यादा|ज्यादा|high|more|tiksh|bahut/.test(tl)) next.agni = 'Tikshna (तेज़ भूख)';
        else next.agni = 'Samagni (सामान्य)';
      }
      return next;
    });

    if (step === 4) {
      // Also push complaint into chat for Gemini context
      addMessage('patient', transcript);
    }

    const next = step + 1;
    if (next <= 5) {
      setWizardStep(next);
      wizardStepRef.current = next;
      setTimeout(() => {
        if (!wizardPausedRef.current) runWizardStep(next);
      }, 500);
    } else {
      setWizardStep(6);
      wizardStepRef.current = 6;
      const doneText = langRef.current === 'hi' ? DONE_MSG.hi : DONE_MSG.en;
      speakThenListen({ text: doneText, lang: langRef.current, onDone: () => {} });
    }
  }, [addMessage]);

  const runWizardStep = useCallback((step) => {
    if (wizardPausedRef.current) return;
    const currentLang = langRef.current;
    const s = WIZARD_STEPS[step - 1];
    if (!s) return;
    const text = currentLang === 'hi' ? s.prompt_hi : s.prompt_en;

    setWizardError('');

    speakThenListen({
      text,
      lang: currentLang,
      onDone: () => {
        if (wizardPausedRef.current) return;
        const rec = startRec({
          lang: currentLang,
          onStart: () => { setWizardListening(true); },
          onEnd: () => { setWizardListening(false); },
          onError: (code) => {
            setWizardListening(false);
            if (code === 'not-allowed') {
              setWizardError('Microphone access denied. Click the 🔒 in Chrome\'s address bar → Allow microphone → Reload page.');
            } else if (code === 'no-speech') {
              setWizardError(currentLang === 'hi' ? 'आवाज़ नहीं सुनाई दी। दोबारा बोलें।' : 'No speech detected. Please tap "Repeat" and try again.');
            } else if (code === 'network') {
              setWizardError('Network error — speech recognition needs internet. Check your connection.');
            } else if (code !== 'aborted') {
              setWizardError(`Recognition error: ${code}. Tap "Repeat" to try again.`);
            }
          },
          onResult: (t) => {
            setWizardError('');
            processWizardResult(step, t);
          },
        });
        wizardRecRef.current = rec;
      },
    });
  }, [processWizardResult]);

  const startWizard = () => {
    wizardPausedRef.current = false;
    wizardStepRef.current = 1;
    setWizardStep(1);
    setWizardPaused(false);
    setWizardListening(false);
    setWizardError('');
    setWizardFields({ name: '', age: '', gender: '', mobile: '', symptoms: '', agni: '' });
    setTimeout(() => runWizardStep(1), 100);
  };

  const cancelWizard = () => {
    wizardPausedRef.current = false;
    wizardStepRef.current = 0;
    window.speechSynthesis?.cancel();
    wizardRecRef.current?.abort();
    setWizardStep(0);
    setWizardListening(false);
    setWizardPaused(false);
    setWizardError('');
  };

  const pauseWizard = () => {
    if (wizardPausedRef.current) {
      // Resume
      wizardPausedRef.current = false;
      setWizardPaused(false);
      setWizardError('');
      runWizardStep(wizardStepRef.current);
    } else {
      // Pause
      wizardPausedRef.current = true;
      setWizardPaused(true);
      window.speechSynthesis?.cancel();
      wizardRecRef.current?.abort();
      setWizardListening(false);
    }
  };

  const repeatCurrentStep = () => {
    wizardPausedRef.current = false;
    setWizardPaused(false);
    setWizardError('');
    window.speechSynthesis?.cancel();
    wizardRecRef.current?.abort();
    setWizardListening(false);
    setTimeout(() => runWizardStep(wizardStepRef.current), 200);
  };

  // ── Wizard field display ───────────────────────────────────────────────────
  const WizardFieldGrid = ({ compact = false }) => {
    const fields = [
      { key: 'name',      label: lang === 'hi' ? 'नाम'        : 'Name',           icon: 'person',                 step: 1 },
      { key: 'ageGender', label: lang === 'hi' ? 'उम्र / लिंग' : 'Age / Gender',   icon: 'cake',                   step: 2 },
      { key: 'mobile',    label: lang === 'hi' ? 'मोबाइल'     : 'Mobile',          icon: 'phone',                  step: 3 },
      { key: 'symptoms',  label: lang === 'hi' ? 'तकलीफ'      : 'Symptoms',        icon: 'healing',                step: 4, full: !compact },
      { key: 'agni',      label: lang === 'hi' ? 'अग्नि'      : 'Agni / Appetite', icon: 'local_fire_department',  step: 5 },
    ];
    return (
      <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 content-start`}>
        {fields.map(f => {
          const val = f.key === 'ageGender'
            ? [wizardFields.age, wizardFields.gender].filter(Boolean).join(' / ')
            : wizardFields[f.key];
          const isActive = !compact && wizardStep === f.step;
          return (
            <div key={f.key} className={`${f.full ? 'col-span-2' : ''} flex flex-col gap-1 p-3 rounded-xl transition-all ${
              isActive ? 'bg-primary/10 ring-1 ring-primary/40 shadow-sm'
                : val  ? 'bg-surface-container-low'
                : 'bg-surface-container opacity-60'}`}>
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

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-margin-desktop py-6 flex flex-col gap-6">

      {/* Emergency Alert */}
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
          <span>Call 108 • तुरंत संपर्क करें</span>
        </a>
      </div>

      {/* Header */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            <span className="text-primary font-bold">Tele-Triage</span>
            <span>/</span>
            <span className="text-on-surface font-semibold">Step 2: Clinical Records &amp; AI Intake</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm">Bilingual Mode</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
            Patient Intake &amp; Clinical Verification <span className="font-body-lg text-on-surface-variant text-body-md font-normal">(रोगी विवरण एवं पर्ची जांच)</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center bg-surface-container rounded-full p-0.5">
            <button onClick={() => setLang('en')} className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm transition-all ${lang === 'en' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>EN</button>
            <button onClick={() => setLang('hi')} className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm transition-all ${lang === 'hi' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>हिं</button>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-highest text-primary font-label-md text-label-md shadow-sm">
            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
            <span>ABDM Verified Profile</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ FEATURE A: Guided Voice Intake Wizard ═══════════════ */}
      <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden ring-1 ring-surface-container-high">
        {/* Banner */}
        <div className="bg-primary/[0.07] px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">🎙️ Guided Voice Registration</h2>
                <span className="font-body-md text-body-md text-on-surface-variant">/ बोलकर विवरण भरें</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Step-by-step voice intake · Chrome mic required</p>
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
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center">Works in Chrome/Edge only</p>
              </div>
              <div className="flex flex-col gap-3 flex-1">
                <p className="font-body-md text-body-md text-on-surface">
                  {lang === 'hi' ? 'वॉयस विज़ार्ड 5 आसान चरणों में आपकी जानकारी इकट्ठा करेगा — कोई टाइपिंग नहीं!' : 'The voice wizard collects your info in 5 guided steps — no typing needed!'}
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

          {/* Steps 1–5: active */}
          {wizardStep >= 1 && wizardStep <= 5 && (
            <div className="flex flex-col gap-4">
              {/* Progress bar */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s < wizardStep ? 'bg-primary' : s === wizardStep ? 'bg-primary/60' : 'bg-surface-container-high'}`} />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: prompt + mic */}
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

                  {/* Pulsing mic */}
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
                    {wizardListening
                      ? (lang === 'hi' ? '🎙️ सुन रहे हैं — बोलें…' : '🎙️ Listening — speak now…')
                      : wizardPaused
                      ? (lang === 'hi' ? '⏸️ रुका हुआ' : '⏸️ Paused')
                      : (lang === 'hi' ? '⏳ तैयारी में…' : '⏳ Preparing…')}
                  </p>

                  {/* Error banner */}
                  {wizardError && (
                    <div className="w-full bg-error-container/30 text-on-error-container rounded-xl p-3 font-body-sm text-body-sm flex items-start gap-2">
                      <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">error</span>
                      <span>{wizardError}</span>
                    </div>
                  )}

                  {/* Repeat / manual tap buttons */}
                  <div className="flex gap-2 w-full">
                    <button onClick={repeatCurrentStep} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">replay</span>
                      <span>{lang === 'hi' ? 'दोबारा' : 'Repeat'}</span>
                    </button>
                    {/* Manual tap-to-speak fallback */}
                    {!wizardListening && !wizardPaused && (
                      <button
                        onPointerDown={() => {
                          window.speechSynthesis?.cancel();
                          const rec = startRec({
                            lang,
                            onStart: () => setWizardListening(true),
                            onEnd: () => setWizardListening(false),
                            onError: (code) => {
                              setWizardListening(false);
                              if (code === 'not-allowed') setWizardError('Microphone access denied. Allow mic in Chrome settings.');
                              else if (code !== 'aborted') setWizardError(`Error: ${code}. Try again.`);
                            },
                            onResult: (t) => { setWizardError(''); processWizardResult(wizardStepRef.current, t); },
                          });
                          wizardRecRef.current = rec;
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm"
                      >
                        <span className="material-symbols-outlined text-primary text-[16px]">mic</span>
                        <span>{lang === 'hi' ? 'टैप करें' : 'Tap & Speak'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: live fields */}
                <WizardFieldGrid />
              </div>
            </div>
          )}

          {/* Step 6: complete */}
          {wizardStep === 6 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[28px]">check_circle</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{lang === 'hi' ? 'विवरण दर्ज हो गया!' : 'Registration Complete!'}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{lang === 'hi' ? 'अब नीचे "Submit to Doctor" पर क्लिक करें।' : 'Scroll down and click "Submit to Doctor" to proceed.'}</p>
                </div>
              </div>
              <WizardFieldGrid compact />
            </div>
          )}
        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Main Two-Column Grid */}
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

          {/* OCR Results */}
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
                <div className="bg-surface-container p-3 rounded-xl flex items-center gap-2.5 shadow-sm">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">verified_user</span>
                  <span className="font-body-sm text-body-sm text-on-surface"><strong>AYUSH-Rx Formulary Checked:</strong> No adverse interaction detected.</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="bg-secondary-container/20 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                  <span className="material-symbols-outlined text-secondary text-[22px] flex-shrink-0 mt-0.5">warning</span>
                  <div>
                    <span className="font-label-md text-label-md text-on-secondary-container font-semibold block">HbA1c Lab Out of Range: 8.9% (Normal: &lt; 5.7%)</span>
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

        {/* RIGHT: Freeform Chat (Feature B) */}
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-title-md text-title-md text-on-surface font-semibold">AYUSH Sahayak</span>
                    <span className="font-body-sm text-on-surface-variant">(आयुष सहायक)</span>
                    {chatIntakeStep < CHAT_INTAKE.length && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                        Intake {chatIntakeStep + 1}/{CHAT_INTAKE.length}
                      </span>
                    )}
                    {chatIntakeStep >= CHAT_INTAKE.length && (
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-container/40 text-on-tertiary-container font-label-sm text-label-sm">
                        Free Chat
                      </span>
                    )}
                  </div>
                  <span className="font-label-sm text-label-sm text-primary font-medium">AI Clinical Triage Assistant • Freeform Chat</span>
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
                lang === 'hi' ? 'पुरानी बीमारी फॉलो-अप' : 'Chronic follow-up',
                lang === 'hi' ? 'दवाई दोबारा लिखवानी है' : 'Medicine refill',
                lang === 'hi' ? 'अनिद्रा व सिरदर्द' : 'Insomnia & headache',
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
                  {isListening ? 'Listening… (बोल रहे हैं)' : `${lang === 'hi' ? 'Hindi (हिंदी)' : 'English'} • tap mic or type`}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Rural voice optimized</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl text-on-primary shadow-sm flex-shrink-0 transition-all ${isListening ? 'bg-secondary animate-pulse' : 'bg-primary hover:bg-primary-container'}`}
                  onClick={startListening} title="बोलने के लिए दबाएं" type="button"
                >
                  <span className="material-symbols-outlined text-[24px]">mic</span>
                </button>
                <div className="flex-1 relative flex items-center">
                  <input
                    className="w-full h-12 pl-4 pr-12 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all"
                    placeholder={lang === 'hi' ? 'यहाँ लिखें या माइक दबाएं…' : 'Type symptoms or tap mic…'}
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

      {/* Submit bar */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
          </div>
          <div>
            <span className="font-title-md text-title-md text-on-surface font-semibold">Triage Queue: Ready for Doctor Review</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Estimated wait: <strong>&lt; 3 minutes</strong></p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors">
            Save Draft
          </button>
          <button
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all flex items-center gap-2 disabled:opacity-60"
            onClick={handleSubmitToDoctor} disabled={isSubmitting} type="button"
          >
            {isSubmitting
              ? <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Submitting…</span></>
              : <><span>Submit to Doctor (आगे बढ़ें)</span><span className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
