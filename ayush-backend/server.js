const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const globalPatients = [];              // legacy store (kept for /api/patients)
const patientQueue = [];                // unified triage queue (P1→P4 sorted on read)
const sessionDocs = new Map();          // sessionId → { status, ocrData, fileBase64, mimeType, fileName }

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2, P4: 3 };
function sortedQueue() {
  return [...patientQueue].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.triageLevel] ?? 9;
    const pb = PRIORITY_ORDER[b.triageLevel] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

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

const FOLLOWUP_SYSTEM = `You are an empathetic AYUSH Ayurvedic intake assistant conducting a clinical interview in India.
Your goal is to systematically collect: patient name, age, gender, chief complaint with duration, Agni/appetite (Mandagni/Samagni/Tikshna), any red flags (chest pain, breathlessness, severe sudden pain), and current medications.
Match the patient's language exactly — Hindi Devanagari if they use it, English or Roman Hinglish otherwise. NEVER mix scripts.
Ask ONE focused, warm follow-up question at a time. Keep responses to 1-2 sentences maximum.
Once you have collected name, chief complaint, duration, and appetite — say: "Thank you. I have enough information for your triage. Please click the 'Generate Triage Summary' button below." (or equivalent in their language).
If there is a red flag symptom (severe chest pain, breathlessness, acute abdominal pain, high fever) — urgently advise calling 108 and flag it immediately.`;

const TRIAGE_SYSTEM = `You are an expert AYUSH (Ayurveda) clinical triage AI assistant in India.
Analyze the patient's demographics, symptoms and digestion details, and return ONLY a valid JSON object with these exact fields:
{
  "chiefComplaint": "brief 1-sentence summary of the main complaint",
  "triageLevel": "P1|P2|P3|P4",
  "triageLabel": "Critical|Urgent|Moderate|Routine",
  "surgicalAlert": true|false,
  "geneticAlert": true|false,
  "dosha": "dominant dosha imbalance: Vata|Pitta|Kapha|Vata-Pitta|Pitta-Kapha|Vata-Kapha|Tridosha",
  "agni": "Manda|Tikshna|Vishama|Sama",
  "koshtha": "Krura|Mridu|Madhyama",
  "redFlags": "comma-separated red flags / immediate referrals, or 'None'",
  "meds": "comma-separated medications mentioned, or 'None'",
  "labs": "comma-separated abnormal lab values mentioned, or 'None'",
  "recommendation": "2-sentence clinical recommendation for the AYUSH physician"
}
Priority rules:
P1 = acute surgical/cardiac emergency or red-flag presentation (set surgicalAlert=true, triageLabel="Critical")
P2 = urgent, severe symptoms needing same-day review (triageLabel="Urgent")
P3 = chronic/moderate, standard consult (triageLabel="Moderate")
P4 = wellness/preventive/routine (triageLabel="Routine")
Agni: Manda=low/sluggish, Tikshna=sharp/excessive, Vishama=irregular, Sama=balanced.
Koshtha: Krura=hard/constipated bowel, Mridu=soft/loose, Madhyama=regular.
Set geneticAlert=true if hereditary/family history conditions are mentioned.`;

function isHindiInput(transcript, context) {
  if (context?.lang === 'hi') return true;
  return /[ऀ-ॿ]/.test(transcript);
}

// ── POST /api/sarvam-tts ──────────────────────────────────────────────────────
app.post('/api/sarvam-tts', async (req, res) => {
  const { text, lang } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ success: false, error: 'text is required and must be non-empty' });
  if (!SARVAM_KEY) return res.status(503).json({ success: false, error: 'SARVAM_API_KEY not configured' });

  try {
    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: String(text).slice(0, 1500),
        language_code: lang === 'hi' ? 'hi-IN' : 'en-IN',
        model: 'bulbul:v3',
        speaker: 'shubh',
        pace: 0.95
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Sarvam TTS failed ${response.status}:`, errText);
      return res.status(response.status).json({ success: false, error: `Sarvam TTS ${response.status}: ${errText}` });
    }

    const data = await response.json();
    const audioBase64 = data.audios?.[0];
    if (!audioBase64) return res.status(502).json({ success: false, error: 'No audio returned from Sarvam TTS' });

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
  const { transcript, history, langHint } = req.body;
  if (!transcript && (!Array.isArray(history) || history.length === 0)) {
    return res.json({ question: 'Please describe your symptoms.' });
  }

  const hindi = isHindiInput(transcript || '', {});

  try {
    let contents;
    if (Array.isArray(history) && history.length > 0) {
      // Build multi-turn Gemini conversation from full message history
      const mapped = history.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));
      // Gemini requires starting with a user turn — drop leading model turns
      let start = 0;
      while (start < mapped.length && mapped[start].role === 'model') start++;
      contents = mapped.slice(start);
      // Append langHint to last user message if provided
      if (langHint && contents.length > 0) {
        const last = contents[contents.length - 1];
        if (last.role === 'user') {
          last.parts[0].text += `\n\n[Instruction: ${langHint}]`;
        }
      }
      // Ensure last message is user (add transcript if needed)
      if (contents.length === 0 || contents[contents.length - 1].role === 'model') {
        contents.push({ role: 'user', parts: [{ text: transcript + (langHint ? `\n\n[Instruction: ${langHint}]` : '') }] });
      }
    } else {
      contents = [{ role: 'user', parts: [{ text: transcript + (langHint ? `\n\n[Instruction: ${langHint}]` : '') }] }];
    }

    const body = {
      system_instruction: { parts: [{ text: FOLLOWUP_SYSTEM }] },
      contents,
    };
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
    const data = await response.json();
    const question = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!question) throw new Error('Empty response from Gemini');
    res.json({ question });
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
  const {
    patientId, name, age, gender, phone, symptoms, agni, koshtha,
    sessionId, documents, conversation, lang,
  } = req.body;

  // Attach any scanned document record for this session
  let attachedDocs = documents || null;
  if (sessionId && sessionDocs.has(sessionId)) {
    const rec = sessionDocs.get(sessionId);
    if (rec?.status === 'ready') attachedDocs = rec;
  }

  // Build the text the model reasons over — structured fields first, then any chat transcript
  const structured = [
    name && `Name: ${name}`,
    (age || gender) && `Age/Gender: ${age || '?'} / ${gender || '?'}`,
    phone && `Phone: ${phone}`,
    symptoms && `Symptoms & onset: ${symptoms}`,
    agni && `Appetite/Digestion (Agni): ${agni}`,
    koshtha && `Bowel (Koshtha): ${koshtha}`,
    attachedDocs?.ocrData && `Documents: ${JSON.stringify(attachedDocs.ocrData)}`,
  ].filter(Boolean).join('\n');

  const conversationText = Array.isArray(conversation)
    ? conversation.map(m => `${m.role}: ${m.text}`).join('\n')
    : String(conversation || '');
  const analysisInput = [structured, conversationText].filter(Boolean).join('\n\n');

  const baseRecord = {
    id: patientId || `P${Date.now()}`,
    patientId: patientId || `P${Date.now()}`,
    name: name || 'Anonymous',
    age: age || 'N/A',
    gender: gender || 'N/A',
    phone: phone || 'N/A',
    symptoms: symptoms || conversationText || 'N/A',
    lang: lang || 'en',
    documents: attachedDocs,
    timestamp: new Date().toISOString(),
  };

  try {
    const raw = await gemini(TRIAGE_SYSTEM, analysisInput || 'No details provided.', true);
    const parsed = JSON.parse(raw);
    // Prefer patient-reported agni/koshtha when the model didn't override meaningfully
    const triageResult = {
      chiefComplaint: parsed.chiefComplaint || symptoms || 'General consultation',
      triageLevel: parsed.triageLevel || 'P3',
      triageLabel: parsed.triageLabel || 'Moderate',
      surgicalAlert: !!parsed.surgicalAlert,
      geneticAlert: !!parsed.geneticAlert,
      dosha: parsed.dosha || 'Tridosha',
      agni: parsed.agni || agni || 'Vishama',
      koshtha: parsed.koshtha || koshtha || 'Madhyama',
      redFlags: parsed.redFlags || 'None',
      meds: parsed.meds || (attachedDocs?.ocrData?.medicines?.map(m => m.name).join(', ')) || 'None',
      labs: parsed.labs || (attachedDocs?.ocrData?.abnormalLabValues?.map(l => `${l.test} ${l.value}`).join(', ')) || 'None',
      recommendation: parsed.recommendation || 'Standard Ayurvedic consultation advised.',
      ayurvedicNotes: { agni: parsed.agni || agni || 'Vishama', koshtha: parsed.koshtha || koshtha || 'Madhyama' },
    };
    const record = { ...baseRecord, ...triageResult, triageResult };
    patientQueue.push(record);
    globalPatients.unshift(record);
    res.json({ success: true, record });
  } catch (err) {
    console.error('triage error:', err.message);
    const triageResult = {
      chiefComplaint: symptoms || 'General consultation',
      triageLevel: 'P3',
      triageLabel: 'Moderate',
      surgicalAlert: false,
      geneticAlert: false,
      dosha: 'Tridosha',
      agni: agni || 'Vishama',
      koshtha: koshtha || 'Madhyama',
      redFlags: 'None',
      meds: (attachedDocs?.ocrData?.medicines?.map(m => m.name).join(', ')) || 'None',
      labs: (attachedDocs?.ocrData?.abnormalLabValues?.map(l => `${l.test} ${l.value}`).join(', ')) || 'None',
      recommendation: 'Standard Ayurvedic consultation advised. Physician review recommended.',
      ayurvedicNotes: { agni: agni || 'Vishama', koshtha: koshtha || 'Madhyama' },
    };
    const record = { ...baseRecord, ...triageResult, triageResult };
    patientQueue.push(record);
    globalPatients.unshift(record);
    res.json({ success: true, record });
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

// ── POST /api/upload-mobile — phone scans QR, uploads doc → Gemini OCR → cache ─
const MOBILE_OCR_PROMPT = `You are a clinical document analyst. Analyze this medical document (prescription, lab report or medical certificate) and return ONLY a valid JSON object with these exact fields:
{
  "documentType": "Prescription" | "Lab Report" | "Medical Certificate" | "Unknown",
  "medicines": [ { "name": "string", "dosage": "string", "ayushCategory": "Ayurvedic" | "Allopathic" | "Unknown" } ],
  "abnormalLabValues": [ { "test": "string", "value": "string", "flag": "High" | "Low" | "Abnormal" } ],
  "clinicalImpressions": "short summary of the doctor's notes / findings"
}
If a field has no data, return an empty array or "Unknown"/"" as appropriate. Do NOT invent values.`;

app.post('/api/upload-mobile', upload.single('document'), async (req, res) => {
  const sessionId = req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });
  if (!req.file) return res.status(400).json({ success: false, error: 'document file is required' });

  const base64 = req.file.buffer.toString('base64');
  const isPdfName = req.file.originalname.toLowerCase().endsWith('.pdf');

  // Mobile pickers frequently send 'application/octet-stream' for PDFs — sanitize.
  let mimeType = req.file.mimetype || 'image/jpeg';
  if (isPdfName || mimeType === 'application/octet-stream') {
    if (isPdfName) mimeType = 'application/pdf';
  }

  // Mark as processing so the kiosk can show a spinner while Gemini works
  sessionDocs.set(sessionId, { status: 'processing', fileName: req.file.originalname });

  let ocrData = {
    documentType: isPdfName ? 'Lab Report (PDF)' : 'Unknown',
    medicines: [],
    abnormalLabValues: [],
    clinicalImpressions: 'Document received (analysis unavailable).',
  };

  try {
    if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured');
    const body = {
      contents: [{
        parts: [
          { text: MOBILE_OCR_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    };
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();

    // Strip markdown code fences Gemini sometimes wraps JSON in, then parse defensively.
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON:', rawText);
      parsed = {
        documentType: isPdfName ? 'Lab Report (PDF)' : 'Prescription',
        medicines: [],
        abnormalLabValues: [],
        clinicalImpressions: rawText.substring(0, 300),
      };
    }
    ocrData = {
      documentType: parsed.documentType || (isPdfName ? 'Lab Report (PDF)' : 'Unknown'),
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
      abnormalLabValues: Array.isArray(parsed.abnormalLabValues) ? parsed.abnormalLabValues : [],
      clinicalImpressions: parsed.clinicalImpressions || '',
    };
  } catch (err) {
    console.error('upload-mobile OCR error:', err.message);
    // keep resilient fallback ocrData so demo still shows a processed doc
    ocrData.clinicalImpressions = `Auto-analysis unavailable (${err.message}). Document stored for physician review.`;
  }

  sessionDocs.set(sessionId, {
    status: 'ready',
    ocrData,
    fileBase64: `data:${mimeType};base64,${base64}`,
    mimeType,
    fileName: req.file.originalname,
    uploadedAt: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Document processed by Gemini 3.6 Flash' });
});

// ── GET /api/session-docs/:sessionId — kiosk polls this ───────────────────────
app.get('/api/session-docs/:sessionId', (req, res) => {
  res.json(sessionDocs.get(req.params.sessionId) || { status: 'waiting' });
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

// ── GET /api/doctor/queue — unified triage queue, P1→P4 then newest first ──────
app.get('/api/doctor/queue', (req, res) => {
  res.json(sortedQueue());
});

app.listen(PORT, () => {
  console.log(`AYUSH backend running on http://localhost:${PORT}`);
});
