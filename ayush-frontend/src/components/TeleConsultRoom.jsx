import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sarvamTTS, recordUntilSilence, stopSarvamAudio } from '../utils/sarvam';

const STAGES = ['name', 'ageGender', 'complaint', 'agni', 'sleep', 'energy', 'history'];

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
  complaint: { en: 'Chief Complaint', hi: 'मुख्य तकलीफ' }, agni: { en: 'Agni & Koshtha', hi: 'अग्नि व कोष्ठ' },
  sleep: { en: 'Sleep & Stress', hi: 'निद्रा व मानस' }, energy: { en: 'Energy & Vitality', hi: 'बल व ऊर्जा' },
  history: { en: 'Chronic History', hi: 'पुरानी बीमारी' },
};
const IVR_PROMPT = 'नमस्ते! हिंदी के लिए 1 दबाएं या बोलें। For English, press or say 2.';

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
  const [stage, setStage] = useState('name');
  const [fields, setFields] = useState({ name: '', age: '', gender: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });
  const [triageResult, setTriageResult] = useState(null);
  const [webcamError, setWebcamError] = useState(false);
  const [audioOutputMode, setAudioOutputMode] = useState('speaker'); // 'speaker' | 'earpiece'

  const recRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const langRef = useRef('en');
  const langChosenRef = useRef(false);
  const stageRef = useRef('name');
  const fieldsRef = useRef({ name: '', age: '', gender: '', complaint: '', agni: '', koshtha: '', sleep_stress: '', energy_lifestyle: '', chronic_history: '' });

  // Audio-singleton + StrictMode guards
  const activeAudioRef = useRef(null);
  const isMountedRef = useRef(false);
  const runIdRef = useRef(0);
  const audioOutputModeRef = useRef('speaker');
  const earpieceSinkRef = useRef(null);

  const alive = (run) => isMountedRef.current && runIdRef.current === run;

  const netErr = () => setError(langRef.current === 'hi'
    ? 'नेटवर्क समस्या — कृपया जांचें कि सर्वर चल रहा है।'
    : 'Network issue — verify the server is running.');

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

  const listenOnce = ({ silenceMs = 1500, maxMs = 8000, langCode } = {}) => new Promise((resolve) => {
    setBotStatus('listening');
    setTranscript('');
    recordUntilSilence({
      silenceMs, maxMs, langCode,
      onStop: () => setBotStatus('thinking'),
      onResult: (t) => { setTranscript(t); resolve(t); },
      onError: (code) => {
        if (code === 'not-allowed') setError(langRef.current === 'hi' ? 'माइक्रोफ़ोन की अनुमति चाहिए।' : 'Microphone permission needed.');
        else if (code === 'network') netErr();
        resolve(null);
      },
    }).then((rec) => { recRef.current = rec; });
  });

  // IVR voice detection OR the on-screen buttons
  const chooseLang = (l) => {
    if (langChosenRef.current) return;
    langChosenRef.current = true;
    langRef.current = l;
    setLang(l);
    stopRec(); // cancel any in-progress voice detection for this step
    setBotStatus('idle');
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
          lang: langRef.current, room,
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

  const runIVR = async (run) => {
    setPhase('ivr');
    await speak(IVR_PROMPT, 'hi');
    let tries = 0;
    while (!langChosenRef.current && tries < 2 && alive(run)) {
      const t = await listenOnce({ langCode: 'unknown', maxMs: 7000 });
      if (langChosenRef.current) break;
      const l = t && detectLangChoice(t);
      if (l) { chooseLang(l); break; }
      tries++;
      if (!langChosenRef.current && tries < 2 && alive(run)) {
        await speak('कृपया 1 या 2 कहें। Please say 1 or 2.', 'hi');
      }
    }
    if (!langChosenRef.current) chooseLang('hi'); // sensible default
  };

  const runInterview = async (run) => {
    setPhase('interview');
    const code = langRef.current === 'hi' ? 'hi-IN' : 'en-IN';
    for (const stageKey of STAGES) {
      if (!alive(run)) return;
      stageRef.current = stageKey; setStage(stageKey);
      let got = null, tries = 0;
      while (got == null && tries < 2 && alive(run)) {
        await speak(tries === 0 ? Q[stageKey][langRef.current] : REPROMPT[langRef.current]);
        if (!alive(run)) return;
        got = await listenOnce({ langCode: code });
        tries++;
      }
      if (got) storeAnswer(stageKey, got);
    }
    if (alive(run)) await submitTriage();
  };

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
    await runIVR(run);
    if (!alive(run)) return;
    await runInterview(run);
  };

  const endCall = () => {
    isMountedRef.current = false;
    stopSarvamAudio();
    stopRec();
    stopWebcam();
    navigate('/');
  };

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

        {error && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white rounded-xl px-4 py-2 font-body-sm text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">wifi_off</span>{error}
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
