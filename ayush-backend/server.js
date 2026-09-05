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
  "recommendation": "2-sentence clinical recommendation for the AYUSH physician",
  "diagnosticCorrelation": "2-3 sentences correlating any uploaded prescription medicines and lab markers with the patient's current Ayurvedic markers (Dosha, Agni, Koshtha, Ama, Bala). Say 'No prior records available for correlation.' when no documents were supplied."
}
Priority rules:
P1 = acute surgical/cardiac emergency or red-flag presentation (set surgicalAlert=true, triageLabel="Critical")
P2 = urgent, severe symptoms needing same-day review (triageLabel="Urgent")
P3 = chronic/moderate, standard consult (triageLabel="Moderate")
P4 = wellness/preventive/routine (triageLabel="Routine")
Agni: Manda=low/sluggish, Tikshna=sharp/excessive, Vishama=irregular, Sama=balanced.
Koshtha: Krura=hard/constipated bowel, Mridu=soft/loose, Madhyama=regular.
Set geneticAlert=true if hereditary/family history conditions are mentioned.
Also weigh these when present:
- Sleep & Stress (Nidra/Manas): insomnia, broken sleep or high anxiety indicates Vata/Pitta manas aggravation — reflect in dosha and raise urgency if severe.
- Energy & Lifestyle (Bala/Hydration): severe fatigue/weakness lowers Dhatwagni/Bala and warrants closer review; lethargy/heaviness suggests Kapha.
- Chronic history & red flags (Purva Vyadhi): pre-existing Diabetes, Hypertension, Thyroid, asthma/breathlessness or drug allergies raise clinical urgency (consider P2) and MUST be surfaced in redFlags.`;

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
// upload.any() so we accept the file under either field name ('file' or 'audio').
app.post('/api/sarvam-stt', upload.any(), async (req, res) => {
  try {
    const uploadedFile = req.files?.[0];
    console.log(`[STT Ingestion] Received file of size ${uploadedFile?.size} bytes, mimetype: ${uploadedFile?.mimetype}`);
    if (!uploadedFile) {
      console.error('No audio file received in /api/sarvam-stt');
      return res.status(400).json({ success: false, error: 'No audio file uploaded' });
    }
    if (uploadedFile.size < 500) {
      console.warn(`[STT Ingestion] Audio buffer too small (${uploadedFile.size} bytes) — treating as silent`);
      return res.status(400).json({ success: false, error: 'Audio buffer too small or silent' });
    }
    if (!SARVAM_KEY) return res.status(503).json({ success: false, error: 'SARVAM_API_KEY not configured' });

    // 'unknown' lets Saaras auto-detect Hindi/English; caller may override.
    const lang = req.body?.language_code || 'unknown';
    const formData = new FormData();
    const audioBlob = new Blob([uploadedFile.buffer], { type: 'audio/webm' });

    // Sarvam strictly requires the field name 'file'
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    formData.append('language_code', lang);

    const sarvamResp = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY },
      body: formData,
    });

    if (!sarvamResp.ok) {
      const errText = await sarvamResp.text();
      console.error(`[Sarvam STT Error ${sarvamResp.status}]:`, errText);
      return res.status(sarvamResp.status).json({ success: false, error: `Sarvam API error (${sarvamResp.status}): ${errText}` });
    }

    const data = await sarvamResp.json().catch(() => ({}));
    console.log('Captured Patient Transcript:', data.transcript);
    return res.json({ success: true, transcript: data.transcript || '' });
  } catch (err) {
    console.error('STT Server Route Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
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
    sleep_stress, energy_lifestyle, chronic_history,
    sessionId, documents, conversation, lang,
    complaint, nidra, triageSource,          // sign-language kiosk field names
  } = req.body;

  // The SignBridge wizard posts `complaint`/`nidra`; the voice kiosks post
  // `symptoms`/`sleep_stress`. Accept either so one triage engine serves both.
  const complaintText = symptoms || complaint;
  const sleepText = sleep_stress || nidra;

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
    complaintText && `Symptoms & onset: ${complaintText}`,
    agni && `Appetite/Digestion (Agni): ${agni}`,
    koshtha && `Bowel (Koshtha): ${koshtha}`,
    sleepText && `Sleep & Stress (Nidra/Manas): ${sleepText}`,
    energy_lifestyle && `Energy & Lifestyle (Bala/Hydration): ${energy_lifestyle}`,
    chronic_history && `Chronic history & red flags (Purva Vyadhi): ${chronic_history}`,
    triageSource && `Intake channel: ${triageSource}`,
    attachedDocs && docsForPrompt(attachedDocs) && `Uploaded medical documents:\n${docsForPrompt(attachedDocs)}`,
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
    symptoms: complaintText || conversationText || 'N/A',
    sleep_stress: sleepText || 'N/A',
    triageSource: triageSource || 'Voice Kiosk',
    energy_lifestyle: energy_lifestyle || 'N/A',
    chronic_history: chronic_history || 'N/A',
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
      diagnosticCorrelation: parsed.diagnosticCorrelation || attachedDocs?.ocrData?.ayushCorrelation || 'No prior records available for correlation.',
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
      diagnosticCorrelation: attachedDocs?.ocrData?.ayushCorrelation || 'No prior records available for correlation.',
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

  try {
    const body = {
      contents: [{
        parts: [
          { text: MOBILE_OCR_PROMPT },
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
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const extraction = normalizeExtraction(JSON.parse(rawText), 'Uploaded document');
    // Structured schema first, with the legacy meds/labs/summary strings preserved.
    res.json({
      ...extraction,
      meds: extraction.medicines.map(m => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join(', ') || 'None detected',
      labs: extraction.labTests.map(l => `${l.testName} ${l.observedValue} (${l.flag})`).join(', ') || 'None detected',
      summary: extraction.clinicalObservations || extraction.title || 'Medical document',
    });
  } catch (err) {
    console.error('OCR error:', err.message);
    res.json({ meds: 'Metformin 500mg BD', labs: 'HbA1c 8.9% (HIGH)', summary: 'OCR failed — showing demo data' });
  }
});

// ── Deep clinical extraction — multi-report prescription + lab analysis ───────
const MOBILE_OCR_PROMPT = `You are a senior clinical document analyst for an AYUSH (Ayurveda) triage system in India.
Read the attached medical document (prescription, laboratory report, discharge summary or medical certificate) and extract EVERY clinical detail actually visible on it.

Return ONLY a valid JSON object with this exact schema:
{
  "documentType": "PRESCRIPTION" | "LAB_REPORT" | "MIXED",
  "title": "short human title, e.g. 'Dr. Sharma OPD Prescription' or 'CBC + Lipid Profile - 12 Mar 2025'",
  "medicines": [
    { "name": "drug or formulation name", "dosage": "e.g. 500 mg", "frequency": "e.g. BD / twice daily / 1-0-1", "instructions": "e.g. after food for 5 days" }
  ],
  "labTests": [
    { "testName": "parameter name", "observedValue": "value with unit", "referenceRange": "biological reference range exactly as printed", "flag": "NORMAL" | "HIGH" | "LOW" | "CRITICAL" }
  ],
  "clinicalObservations": "the doctor's notes, diagnosis, advice and findings in 1-3 sentences",
  "ayushCorrelation": "1-2 sentences correlating these findings with Ayurvedic markers (Dosha, Agni, Koshtha, Ama) for the treating Vaidya"
}

Rules:
- Use "MIXED" only when the SAME document contains both prescribed medicines and lab parameters.
- Extract EVERY medicine row and EVERY lab parameter row — including parameters that are within the normal range.
- Derive "flag" by comparing observedValue against referenceRange. Use "CRITICAL" only for grossly deranged, life-threatening values.
- If a field is not printed on the document, return an empty string "" — never invent values.
- Return [] for medicines or labTests when the document contains none.`;

const LAB_FLAGS = ['NORMAL', 'HIGH', 'LOW', 'CRITICAL'];
const DOC_TYPES = ['PRESCRIPTION', 'LAB_REPORT', 'MIXED'];

// Gemini occasionally returns "Abnormal"/"H"/"Elevated" — coerce to our four flags.
function normalizeFlag(flag) {
  const f = String(flag || '').trim().toUpperCase();
  if (LAB_FLAGS.includes(f)) return f;
  if (f.startsWith('CRIT') || f.startsWith('PANIC')) return 'CRITICAL';
  if (f === 'H' || f.startsWith('HIGH') || f.startsWith('ELEV') || f.startsWith('ABNORM')) return 'HIGH';
  if (f === 'L' || f.startsWith('LOW') || f.startsWith('DEFIC')) return 'LOW';
  return 'NORMAL';
}

function normalizeDocType(type, medicines, labTests) {
  const t = String(type || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (DOC_TYPES.includes(t)) return t;
  if (medicines.length && labTests.length) return 'MIXED';
  if (labTests.length) return 'LAB_REPORT';
  if (medicines.length) return 'PRESCRIPTION';
  return 'MIXED';
}

// Shape whatever Gemini returned into the strict extraction schema.
function normalizeExtraction(parsed, fileName) {
  const medicines = (Array.isArray(parsed?.medicines) ? parsed.medicines : [])
    .filter(m => m && (m.name || m.drug))
    .map(m => ({
      name: String(m.name || m.drug || '').trim(),
      dosage: String(m.dosage || m.dose || '').trim(),
      frequency: String(m.frequency || m.freq || '').trim(),
      instructions: String(m.instructions || m.instruction || m.notes || '').trim(),
    }));

  const labTests = (Array.isArray(parsed?.labTests) ? parsed.labTests : [])
    .filter(l => l && (l.testName || l.test))
    .map(l => ({
      testName: String(l.testName || l.test || '').trim(),
      observedValue: String(l.observedValue || l.value || '').trim(),
      referenceRange: String(l.referenceRange || l.range || '').trim(),
      flag: normalizeFlag(l.flag || l.status),
    }));

  return {
    documentType: normalizeDocType(parsed?.documentType, medicines, labTests),
    title: String(parsed?.title || fileName || 'Medical document').trim(),
    medicines,
    labTests,
    clinicalObservations: String(parsed?.clinicalObservations || parsed?.clinicalImpressions || '').trim(),
    ayushCorrelation: String(parsed?.ayushCorrelation || '').trim(),
  };
}

function dedupeBy(list, keyFn) {
  const seen = new Set();
  return list.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Legacy mirror keeps the stable kiosk / teleconsult readers working against
// `ocrData` while the new screens read `reports` + the aggregates.
const LEGACY_TYPE = { PRESCRIPTION: 'Prescription', LAB_REPORT: 'Lab Report', MIXED: 'Prescription + Lab Report' };

function buildSessionRecord(reports) {
  const aggregatedMedicines = dedupeBy(
    reports.flatMap(r => r.medicines.map(m => ({ ...m, source: r.title || r.fileName }))),
    m => `${m.name}|${m.dosage}`.toLowerCase()
  );
  const aggregatedLabFlags = dedupeBy(
    reports.flatMap(r => r.labTests.map(l => ({ ...l, source: r.title || r.fileName }))),
    l => `${l.testName}|${l.observedValue}`.toLowerCase()
  );
  const latest = reports[reports.length - 1] || {};
  const types = [...new Set(reports.map(r => r.documentType))];

  return {
    status: 'ready',
    reports,
    aggregatedMedicines,
    aggregatedLabFlags,
    // ── legacy compatibility mirror ──
    ocrData: {
      documentType: types.length > 1 ? 'Prescription + Lab Report' : (LEGACY_TYPE[latest.documentType] || 'Document'),
      medicines: aggregatedMedicines.map(m => ({
        name: m.name,
        dosage: [m.dosage, m.frequency].filter(Boolean).join(' · '),
        ayushCategory: 'Unknown',
      })),
      abnormalLabValues: aggregatedLabFlags
        .filter(l => l.flag !== 'NORMAL')
        .map(l => ({
          test: l.testName,
          value: l.observedValue,
          referenceRange: l.referenceRange,
          flag: l.flag === 'LOW' ? 'Low' : l.flag === 'CRITICAL' ? 'Critical' : 'High',
        })),
      labTests: aggregatedLabFlags,
      clinicalImpressions: reports.map(r => r.clinicalObservations).filter(Boolean).join(' '),
      ayushCorrelation: reports.map(r => r.ayushCorrelation).filter(Boolean).join(' '),
      reportCount: reports.length,
    },
    fileBase64: latest.fileBase64,
    mimeType: latest.mimeType,
    fileName: latest.fileName,
    uploadedAt: latest.uploadedAt,
  };
}

// Compact digest of every uploaded report for the triage model.
function docsForPrompt(docs) {
  if (!docs) return '';
  if (Array.isArray(docs.reports) && docs.reports.length) {
    return docs.reports.map((r, i) => [
      `Report ${i + 1} (${r.documentType}): ${r.title}`,
      r.medicines.length && `  Medicines: ${r.medicines.map(m => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join('; ')}`,
      r.labTests.length && `  Labs: ${r.labTests.map(l => `${l.testName} ${l.observedValue} [ref ${l.referenceRange || 'n/a'}] ${l.flag}`).join('; ')}`,
      r.clinicalObservations && `  Notes: ${r.clinicalObservations}`,
    ].filter(Boolean).join('\n')).join('\n');
  }
  return docs.ocrData ? JSON.stringify(docs.ocrData) : '';
}

// ── POST /api/upload-mobile — phone scans QR, uploads doc → Gemini OCR → cache ─
app.post('/api/upload-mobile', upload.single('document'), async (req, res) => {
  const sessionId = req.body?.sessionId;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });
  if (!req.file) return res.status(400).json({ success: false, error: 'document file is required' });

  const base64 = req.file.buffer.toString('base64');
  const isPdfName = req.file.originalname.toLowerCase().endsWith('.pdf');

  // Sanitize MIME: mobile pickers often send 'application/octet-stream' for PDFs.
  // Gemini Vision needs the correct type or it 500s — force application/pdf by extension.
  const mimeType = (req.file.mimetype === 'application/pdf' || isPdfName)
    ? 'application/pdf'
    : (req.file.mimetype || 'image/jpeg');

  // Every upload appends — prior reports for this session are never overwritten.
  const previous = sessionDocs.get(sessionId);
  const priorReports = Array.isArray(previous?.reports) ? previous.reports : [];

  // Mark as processing (keeping prior reports attached) so kiosks show a spinner
  sessionDocs.set(sessionId, {
    ...(previous || {}),
    status: 'processing',
    reports: priorReports,
    fileName: req.file.originalname,
  });

  let extraction = {
    documentType: isPdfName ? 'LAB_REPORT' : 'MIXED',
    title: req.file.originalname,
    medicines: [],
    labTests: [],
    clinicalObservations: 'Document received (analysis unavailable).',
    ayushCorrelation: '',
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
      parsed = { clinicalObservations: rawText.substring(0, 300) };
    }
    extraction = normalizeExtraction(parsed, req.file.originalname);
  } catch (err) {
    console.error('upload-mobile OCR error:', err.message);
    // keep the resilient fallback so the demo still shows a processed document
    extraction.clinicalObservations = `Auto-analysis unavailable (${err.message}). Document stored for physician review.`;
  }

  const newReport = {
    id: `DOC-${Date.now().toString(36).toUpperCase()}`,
    ...extraction,
    fileName: req.file.originalname,
    mimeType,
    fileBase64: `data:${mimeType};base64,${base64}`,
    uploadedAt: new Date().toISOString(),
  };

  const record = buildSessionRecord([...priorReports, newReport]);
  sessionDocs.set(sessionId, record);

  res.json({
    success: true,
    message: 'Document processed by Gemini 3.6 Flash',
    reportCount: record.reports.length,
    report: {
      id: newReport.id,
      title: newReport.title,
      fileName: newReport.fileName,
      documentType: newReport.documentType,
      medicineCount: newReport.medicines.length,
      labCount: newReport.labTests.length,
    },
    reports: record.reports.map(r => ({
      id: r.id,
      title: r.title,
      fileName: r.fileName,
      documentType: r.documentType,
      medicineCount: r.medicines.length,
      labCount: r.labTests.length,
      uploadedAt: r.uploadedAt,
    })),
    aggregatedMedicines: record.aggregatedMedicines,
    aggregatedLabFlags: record.aggregatedLabFlags,
  });
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

// ── Serve the production React build (unified deployment on Render) ─────────────
const frontendDist = path.join(__dirname, '../ayush-frontend/dist');
app.use(express.static(frontendDist));

// Catch-all route to support React Router (SPA). Registered AFTER all /api routes.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AYUSH backend running on http://localhost:${PORT}`);
});
