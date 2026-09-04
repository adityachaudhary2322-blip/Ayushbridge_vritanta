const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SARVAM_KEY = process.env.SARVAM_API_KEY;

if (!GEMINI_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set — AI endpoints will use static fallbacks');
} else {
  console.log(`✓  GEMINI_API_KEY loaded (${GEMINI_KEY.slice(0, 6)}...)`);
}
if (!SARVAM_KEY) {
  console.warn('⚠️  SARVAM_API_KEY not set — TTS/STT endpoints will return errors');
} else {
  console.log(`✓  SARVAM_API_KEY loaded (${SARVAM_KEY.slice(0, 6)}...)`);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_KEY}`;
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const globalPatients = [];

// ── Gemini helper ─────────────────────────────────────────────────────────────
async function gemini(systemPrompt, userText, jsonMode = false) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    ...(jsonMode && { generationConfig: { responseMimeType: 'application/json' } })
  };
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const FOLLOWUP_SYSTEM = `You are an empathetic Ayurvedic intake assistant in India.
Respond strictly in the patient's language (Hindi or English, match their input).
Ask ONE short, high-yield follow-up question probing their symptoms and Agni/Koshtha status.
Keep your response to 1-2 spoken sentences maximum. Be warm and reassuring.`;

const TRIAGE_SYSTEM = `You are an expert AYUSH triage AI assistant in India.
Analyze the patient conversation and return a JSON object with these exact fields:
{
  "triageLevel": "P1|P2|P3|P4",
  "triageLabel": "Surgical Emergency|Urgent|Standard|Routine",
  "surgicalAlert": true|false,
  "geneticAlert": true|false,
  "meds": "comma-separated list of medications mentioned or 'None'",
  "labs": "comma-separated abnormal lab values mentioned or 'None'",
  "chiefComplaint": "brief 1-sentence summary of the main complaint",
  "ayurvedicNotes": {
    "agni": "patient's digestive fire assessment or 'Vishamagni'",
    "koshtha": "bowel habit type or 'Madhyama'"
  },
  "recommendation": "2-sentence clinical recommendation for the AYUSH physician"
}
P1 = acute surgical/cardiac emergency (flag surgicalAlert=true)
P2 = urgent, severe symptoms needing same-day review
P3 = chronic/moderate, standard consult
P4 = wellness/preventive/routine
Flag geneticAlert=true if family history of hereditary conditions is mentioned.`;

function isHindiInput(transcript, context) {
  if (context?.lang === 'hi') return true;
  return /[ऀ-ॿ]/.test(transcript);
}

// ── POST /api/sarvam-tts ──────────────────────────────────────────────────────
app.post('/api/sarvam-tts', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!SARVAM_KEY) return res.status(503).json({ error: 'SARVAM_API_KEY not configured' });

  try {
    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        language_code: lang === 'hi' ? 'hi-IN' : 'en-IN',
        model: 'bulbul:v3',
        speaker: 'shubh',
        pace: 0.95
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam TTS ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const audioBase64 = data.audios?.[0];
    if (!audioBase64) throw new Error('No audio returned from Sarvam TTS');

    res.json({ success: true, audio: `data:audio/wav;base64,${audioBase64}` });
  } catch (err) {
    console.error('Sarvam TTS error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/sarvam-stt ──────────────────────────────────────────────────────
app.post('/api/sarvam-stt', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio file is required' });
  if (!SARVAM_KEY) return res.status(503).json({ error: 'SARVAM_API_KEY not configured' });

  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    formData.append('language_code', 'unknown');

    const response = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam STT ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const transcript = data.transcript?.trim() || '';
    if (!transcript) throw new Error('Empty transcript from Sarvam STT');

    res.json({ success: true, transcript });
  } catch (err) {
    console.error('Sarvam STT error:', err.message);
    res.status(500).json({ success: false, error: err.message, transcript: '' });
  }
});

// ── POST /api/ask-followup ────────────────────────────────────────────────────
app.post('/api/ask-followup', async (req, res) => {
  const { transcript, context, langHint: clientLangHint } = req.body;
  if (!transcript) return res.json({ question: 'Please describe your symptoms.' });

  const hindi = isHindiInput(transcript, context);

  try {
    const langHint = clientLangHint || (hindi
      ? 'You MUST respond in Hindi (Devanagari script).'
      : 'You MUST respond in English.');
    const contextStr = context ? `\n\nContext: ${JSON.stringify(context)}` : '';
    const userInput = `${transcript}${contextStr}\n\n${langHint}`;
    const question = await gemini(FOLLOWUP_SYSTEM, userInput);
    if (!question.trim()) throw new Error('Empty response from Gemini');
    res.json({ question: question.trim() });
  } catch (err) {
    console.error('ask-followup error:', err.message);
    const fallback = hindi
      ? 'कृपया बताएं यह तकलीफ कब से है और क्या पेट में भारीपन या दर्द है?'
      : 'Could you describe how long you have had these symptoms and your appetite?';
    res.json({ question: fallback });
  }
});

// ── POST /api/triage ──────────────────────────────────────────────────────────
app.post('/api/triage', async (req, res) => {
  const { conversation, patientId, lang } = req.body;
  const conversationText = Array.isArray(conversation)
    ? conversation.map(m => `${m.role}: ${m.text}`).join('\n')
    : String(conversation || '');

  try {
    const raw = await gemini(TRIAGE_SYSTEM, conversationText, true);
    const parsed = JSON.parse(raw);
    const patient = {
      id: patientId || `P${Date.now()}`,
      timestamp: new Date().toISOString(),
      lang: lang || 'en',
      conversation: conversationText,
      ...parsed
    };
    globalPatients.unshift(patient);
    res.json(patient);
  } catch (err) {
    console.error('triage error:', err.message);
    const fallback = {
      id: patientId || `P${Date.now()}`,
      timestamp: new Date().toISOString(),
      triageLevel: 'P3',
      triageLabel: 'Standard',
      surgicalAlert: false,
      geneticAlert: false,
      meds: 'None',
      labs: 'None',
      chiefComplaint: 'General consultation',
      ayurvedicNotes: { agni: 'Vishamagni', koshtha: 'Madhyama' },
      recommendation: 'Patient requires standard Ayurvedic consultation. Physician review advised.'
    };
    globalPatients.unshift(fallback);
    res.json(fallback);
  }
});

// ── POST /api/ocr — Gemini Vision ────────────────────────────────────────────
app.post('/api/ocr', async (req, res) => {
  const { fileData, mimeType } = req.body;
  if (!fileData) {
    return res.json({ meds: 'Metformin 500mg BD', labs: 'HbA1c 8.9% (HIGH)', summary: 'Demo data (no file uploaded)' });
  }

  const ocrPrompt = `You are a medical OCR assistant. Carefully analyze this medical document image.
Extract ALL medications with dosages and ALL lab test values shown.
Return ONLY a valid JSON object with these exact three fields:
{
  "meds": "comma-separated medications with doses, or 'None detected'",
  "labs": "comma-separated lab values with units and ranges, or 'None detected'",
  "summary": "one-sentence description of what type of document this is"
}`;

  try {
    const body = {
      contents: [{
        parts: [
          { text: ocrPrompt },
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: fileData } }
        ]
      }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Gemini OCR ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    res.json({
      meds: parsed.meds || 'None detected',
      labs: parsed.labs || 'None detected',
      summary: parsed.summary || 'Medical document'
    });
  } catch (err) {
    console.error('OCR error:', err.message);
    res.json({ meds: 'Metformin 500mg BD', labs: 'HbA1c 8.9% (HIGH)', summary: 'OCR failed — showing demo data' });
  }
});

// ── POST /api/zoom/create ─────────────────────────────────────────────────────
app.post('/api/zoom/create', async (req, res) => {
  const { topic, patientName } = req.body;
  try {
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: process.env.ZOOM_ACCOUNT_ID
      })
    });
    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json();

    const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic || `AYUSH Triage — ${patientName || 'Patient'}`,
        type: 1,
        settings: { host_video: true, participant_video: true, join_before_host: true }
      })
    });
    if (!meetingRes.ok) throw new Error(`Meeting creation failed: ${meetingRes.status}`);
    const meeting = await meetingRes.json();
    res.json({ joinUrl: meeting.join_url, meetingId: meeting.id });
  } catch (err) {
    console.error('Zoom error:', err.message);
    res.json({
      joinUrl: 'https://zoom.us/j/00000000000?pwd=fallback',
      meetingId: 'fallback-demo',
      note: 'Using fallback demo URL'
    });
  }
});

// ── GET /api/patients ─────────────────────────────────────────────────────────
app.get('/api/patients', (req, res) => {
  res.json(globalPatients);
});

app.listen(PORT, () => {
  console.log(`AYUSH backend running on http://localhost:${PORT}`);
});
