/**
 * Shared shape for the physician's final diagnosis + prescription (Rx).
 *
 * The Rx builder in the dashboard and the A4 case sheet both read this shape, so
 * whatever the physician types is exactly what prints and what is POSTed to
 * /api/consultation/save.
 */

export const FORMULATIONS = ['Tablet', 'Capsule', 'Churna', 'Kwath', 'Syrup', 'Ointment', 'Other'];

export const TIMINGS = [
  'Before Food / भोजन से पहले',
  'After Food / भोजन के बाद',
  'Empty Stomach / खाली पेट',
  'With Warm Water / गुनगुने पानी के साथ',
  'At Bedtime / सोते समय',
];

export const emptyMedication = () => ({ name: '', form: 'Tablet', dosage: '', timing: TIMINGS[1], duration: '' });

/** Display token the dashboard and the case sheet both show for a patient. */
export function patientToken(p) {
  if (!p) return 'AYUSH-000000';
  return p.token || `AYUSH-${String(p.id || '').slice(-6).toUpperCase()}`;
}

const clean = (v) => (v && v !== 'N/A' && v !== 'None' ? String(v).trim() : '');

/**
 * Seeds the builder from Gemini's intake summary so the physician edits a draft
 * rather than starting from a blank sheet. Anything already signed off wins.
 */
export function buildConsultationDraft(p) {
  const saved = p?.consultation;
  if (saved) {
    return {
      diagnosis: saved.diagnosis || '',
      ayushDiagnosis: saved.ayushDiagnosis || '',
      clinicalNotes: saved.clinicalNotes || '',
      prescription: saved.prescription?.length ? saved.prescription.map(m => ({ ...m })) : [emptyMedication()],
      advice: saved.advice || '',
      followUpDate: saved.followUpDate || '',
    };
  }

  const agni = clean(p?.agni || p?.ayurvedicNotes?.agni);
  const koshtha = clean(p?.koshtha || p?.ayurvedicNotes?.koshtha);
  const dosha = clean(p?.dosha);

  const diagnosis = [
    clean(p?.chiefComplaint) && `Provisional: ${clean(p.chiefComplaint)}`,
    clean(p?.redFlags) && `Red flags noted: ${clean(p.redFlags)}`,
    p?.surgicalAlert ? 'Surgical red flag flagged by AI intake — rule out acute abdomen.' : '',
  ].filter(Boolean).join('\n');

  const ayushDiagnosis = [
    dosha && `Doshic vitiation: ${dosha}`,
    agni && `Agni: ${agni}`,
    koshtha && `Koshtha: ${koshtha}`,
    'Nidana / Samprapti: ',
  ].filter(Boolean).join('\n');

  const clinicalNotes = [
    clean(p?.symptoms) && `Reported symptoms: ${clean(p.symptoms)}`,
    clean(p?.chronic_history) && `Purva Vyadhi: ${clean(p.chronic_history)}`,
    clean(p?.sleep_stress) && `Nidra & Manas: ${clean(p.sleep_stress)}`,
    clean(p?.energy_lifestyle) && `Bala & Lifestyle: ${clean(p.energy_lifestyle)}`,
    clean(p?.diagnosticCorrelation) && `AI correlation: ${clean(p.diagnosticCorrelation)}`,
    clean(p?.recommendation) && `AI recommendation: ${clean(p.recommendation)}`,
  ].filter(Boolean).join('\n');

  return {
    diagnosis,
    ayushDiagnosis,
    clinicalNotes,
    prescription: [emptyMedication()],
    advice: '',
    followUpDate: '',
  };
}

/** Drops empty builder rows before sending or printing. */
export const filledMedications = (list) => (list || []).filter(m => String(m?.name || '').trim());
