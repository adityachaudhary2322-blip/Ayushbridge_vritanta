import { useState, useRef, useEffect, useCallback } from 'react';
import { sarvamTTS, recordAndTranscribe, detectMode, extractSlots } from '../utils/sarvam';

const GREETING_EN = "Namaste! I'm AYUSH Vaidya, your AI doctor assistant. I'll ask you a few questions about your health. Please speak clearly after I finish each question.";
const GREETING_HI = "नमस्ते! मैं आयुष वैद्य हूँ। मैं आपकी तकलीफ के बारे में कुछ सवाल पूछूँगा। कृपया हर सवाल के बाद बोलें।";

function detectLangHint(text) {
  const mode = detectMode(text);
  if (mode === 'devanagari') return 'Patient speaks Hindi Devanagari. Respond ONLY in Hindi Devanagari.';
  if (mode === 'hinglish') return 'Patient speaks Hinglish. Respond in English or Roman Hinglish, NOT Devanagari.';
  return 'Respond in English.';
}

const PRIORITY_COLORS = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-blue-600 text-white',
  P4: 'bg-green-600 text-white',
};

export default function VideoConsult({ onClose, initialMessages = [], lang = 'en' }) {
  const [status, setStatus] = useState('init');
  const [messages, setMessages] = useState([]);
  const [slots, setSlots] = useState({});
  const [subtitle, setSubtitle] = useState('Initialising…');
  const [webcamError, setWebcamError] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [isTriaging, setIsTriaging] = useState(false);

  const videoRef = useRef(null);
  const isActiveRef = useRef(true);
  const messagesRef = useRef([]);
  const streamRef = useRef(null);

  const addMsg = useCallback((role, text) => {
    const msg = { role, text };
    messagesRef.current = [...messagesRef.current, msg];
    setMessages([...messagesRef.current]);
    setSlots(extractSlots(messagesRef.current));
  }, []);

  const speakAndCaption = async (text) => {
    if (!isActiveRef.current) return;
    setStatus('speaking');
    setSubtitle(text);
    await sarvamTTS(text, detectMode(text) === 'devanagari' ? 'hi' : 'en');
  };

  const listenOnce = () => new Promise((resolve) => {
    if (!isActiveRef.current) { resolve(null); return; }
    setStatus('listening');
    setSubtitle(lang === 'hi' ? 'बोलें…' : 'Listening…');
    recordAndTranscribe({
      maxMs: 8000,
      onStart: () => {},
      onStop: () => {},
      onResult: (t) => resolve(t),
      onError: (code) => {
        if (code === 'empty' || code === 'no-transcript') resolve(null);
        else resolve(null);
      },
    });
  });

  const callGemini = async (transcript) => {
    setStatus('thinking');
    setSubtitle(lang === 'hi' ? 'सोच रहे हैं…' : 'Thinking…');
    try {
      const history = messagesRef.current.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/ask-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, history, langHint: detectLangHint(transcript) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.question || (lang === 'hi' ? 'कृपया और बताएं।' : 'Please tell me more.');
    } catch {
      return lang === 'hi' ? 'कृपया दोबारा बताएं।' : 'Could you repeat that?';
    }
  };

  // Conversation loop
  useEffect(() => {
    isActiveRef.current = true;

    // Start webcam (video only — audio captured separately in recordAndTranscribe)
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => {
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; }
      })
      .catch(() => setWebcamError(true));

    const greeting = lang === 'hi' ? GREETING_HI : GREETING_EN;
    addMsg('ai', greeting);

    (async () => {
      await speakAndCaption(greeting);

      while (isActiveRef.current) {
        const transcript = await listenOnce();
        if (!isActiveRef.current) break;

        if (transcript?.trim()) {
          addMsg('user', transcript);
          const aiReply = await callGemini(transcript);
          if (!isActiveRef.current) break;
          addMsg('ai', aiReply);
          await speakAndCaption(aiReply);
        } else {
          // No speech — ask again
          const nudge = lang === 'hi' ? 'कृपया बोलें।' : "I didn't catch that — please speak.";
          await speakAndCaption(nudge);
        }
      }
    })();

    return () => {
      isActiveRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = async () => {
    isActiveRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStatus('ended');

    if (messagesRef.current.filter(m => m.role === 'user').length >= 1) {
      setIsTriaging(true);
      try {
        const res = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation: messagesRef.current,
            patientId: `PV${Date.now()}`,
            lang,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTriageResult(data.record || data);
        }
      } catch {}
      setIsTriaging(false);
    }
  };

  const slotEntries = Object.entries(slots);

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-5xl bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="bg-primary/[0.08] px-5 py-3.5 flex items-center justify-between border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[20px]">medical_services</span>
            </div>
            <div>
              <h2 className="font-title-md text-title-md text-on-surface font-semibold">AYUSH Video Consult</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Sarvam AI · Bulbul v3 TTS · Saaras v3 STT</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm shadow-sm ${
              status === 'speaking' ? 'bg-primary/10 text-primary' :
              status === 'listening' ? 'bg-tertiary-container/40 text-on-tertiary-container' :
              status === 'thinking' ? 'bg-secondary-container/30 text-on-secondary-container' :
              'bg-surface-container text-on-surface-variant'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === 'speaking' ? 'bg-primary animate-pulse' :
                status === 'listening' ? 'bg-tertiary animate-ping' :
                status === 'thinking' ? 'bg-secondary animate-pulse' :
                'bg-surface-container-highest'
              }`} />
              {status === 'speaking' ? 'AI Speaking…' :
               status === 'listening' ? 'Listening…' :
               status === 'thinking' ? 'Processing…' :
               status === 'ended' ? 'Ended' : 'Connecting…'}
            </span>
            <button
              onClick={handleEnd}
              disabled={status === 'ended'}
              className="px-4 py-2 rounded-xl bg-error/10 text-error border border-error/20 font-label-md text-label-md hover:bg-error/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">call_end</span>
              End
            </button>
            {status === 'ended' && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </button>
            )}
          </div>
        </div>

        {/* Slot chips */}
        {slotEntries.length > 0 && (
          <div className="px-5 py-2.5 bg-surface-container-low flex items-center gap-2 overflow-x-auto border-b border-surface-container-high">
            <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">Detected:</span>
            {slotEntries.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm whitespace-nowrap shadow-sm">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-0 overflow-hidden min-h-0">

          {/* Left: Patient webcam */}
          <div className="relative bg-black flex items-center justify-center min-h-[240px]">
            {webcamError ? (
              <div className="flex flex-col items-center gap-3 text-white/60 p-6">
                <span className="material-symbols-outlined text-[48px]">videocam_off</span>
                <p className="font-body-sm text-body-sm text-center">Camera unavailable<br /><span className="text-white/40">Allow camera access for video</span></p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay playsInline muted
                className="w-full h-full object-cover max-h-[380px]"
              />
            )}
            <div className="absolute bottom-3 left-3">
              <span className="px-2.5 py-1 rounded-full bg-black/60 text-white/90 font-label-sm text-label-sm backdrop-blur-sm">
                Patient Camera
              </span>
            </div>
            {status === 'listening' && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/80 text-white font-label-sm text-label-sm backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Recording
              </div>
            )}
          </div>

          {/* Right: AI Vaidya */}
          <div className="flex flex-col bg-primary/[0.04] border-l border-surface-container-high">
            {/* Avatar */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 min-h-[200px]">
              <div className="relative flex items-center justify-center">
                {status === 'speaking' && (
                  <>
                    <div className="absolute w-36 h-36 rounded-full bg-primary/10 animate-ping" />
                    <div className="absolute w-28 h-28 rounded-full bg-primary/15 animate-pulse" />
                  </>
                )}
                {status === 'listening' && (
                  <div className="absolute w-28 h-28 rounded-full bg-tertiary/15 animate-pulse" />
                )}
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                  status === 'speaking' ? 'bg-primary scale-105' :
                  status === 'listening' ? 'bg-tertiary/80 scale-100' :
                  status === 'thinking' ? 'bg-secondary/60 scale-95' :
                  'bg-surface-container-high'
                }`}>
                  <span className={`material-symbols-outlined text-[40px] ${
                    status === 'speaking' || status === 'listening' || status === 'thinking'
                      ? 'text-white'
                      : 'text-on-surface-variant'
                  }`}>
                    {status === 'speaking' ? 'record_voice_over' :
                     status === 'listening' ? 'hearing' :
                     status === 'thinking' ? 'psychology' : 'spa'}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="font-title-md text-title-md text-on-surface font-semibold">AYUSH Vaidya</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">AI Clinical Assistant</p>
              </div>
            </div>

            {/* Live subtitles */}
            <div className="mx-4 mb-4 p-4 bg-surface-container-low rounded-2xl shadow-sm min-h-[80px] flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary-container text-on-primary-container">
                <span className="material-symbols-outlined text-[14px]">
                  {status === 'listening' ? 'person' : 'spa'}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                {subtitle || '…'}
              </p>
            </div>
          </div>
        </div>

        {/* Conversation log */}
        {messages.length > 1 && (
          <div className="border-t border-surface-container-high px-5 py-3 max-h-[120px] overflow-y-auto flex flex-col gap-1.5 bg-surface/40">
            {messages.slice(-4).map((m, i) => (
              <div key={i} className={`flex items-start gap-2 text-[13px] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className={`font-label-sm px-1.5 py-0.5 rounded-full shrink-0 ${m.role === 'ai' ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {m.role === 'ai' ? 'Vaidya' : 'You'}
                </span>
                <p className={`font-body-sm text-on-surface leading-snug ${m.role === 'user' ? 'text-right' : ''}`}>{m.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Triage result (after end) */}
        {status === 'ended' && (
          <div className="border-t border-surface-container-high p-5 bg-surface-container-low">
            {isTriaging ? (
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-primary text-[20px]">refresh</span>
                <span className="font-body-md text-body-md">Generating triage summary…</span>
              </div>
            ) : triageResult ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-lg text-label-lg font-bold shadow-sm ${PRIORITY_COLORS[triageResult.triageLevel] || PRIORITY_COLORS.P3}`}>
                    {triageResult.triageLevel} — {triageResult.triageLabel}
                  </span>
                  {triageResult.surgicalAlert && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error/10 text-error font-label-sm text-label-sm">
                      <span className="material-symbols-outlined text-[14px]">warning</span> Red Flag
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-body-md text-body-md text-on-surface">{triageResult.chiefComplaint}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{triageResult.recommendation}</p>
                </div>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">done</span>
                  View Summary
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-body-md text-body-md text-on-surface-variant">Consultation ended.</p>
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
