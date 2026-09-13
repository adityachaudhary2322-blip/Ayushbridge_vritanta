/**
 * The three core AYUSH clinical pillars the triage stream reports and the physician
 * verifies: Dosha, Agni, Koshtha. `normalize*` maps any legacy or free-text value
 * ("Mandagni", "Pitta-Vata", "Tridosha", "Mridu") onto one canonical option, and
 * mirrors normalizeAyushPillars() in the backend.
 */

export const DOSHA_OPTIONS = [
  'Vata Dominant', 'Pitta Dominant', 'Kapha Dominant',
  'Vata-Pitta', 'Pitta-Kapha', 'Kapha-Vata', 'Tridoshaja',
];

export const AGNI_OPTIONS = [
  'Sama Agni (Balanced)', 'Vishama Agni (Irregular/Vata)',
  'Tikshna Agni (Hyper/Pitta)', 'Manda Agni (Sluggish/Kapha)',
];

export const KOSHTHA_OPTIONS = [
  'Madhyama Koshtha (Balanced)', 'Krura Koshtha (Constipated/Hard)', 'Mrudu Koshtha (Soft/Frequent)',
];

export const AYUSH_PILLARS = [
  { key: 'dosha', label: 'Dosha / Prakriti-Vikriti', hi: 'दोष', icon: 'balance', options: DOSHA_OPTIONS },
  { key: 'agni', label: 'Agni Status', hi: 'अग्नि', icon: 'local_fire_department', options: AGNI_OPTIONS },
  { key: 'koshtha', label: 'Koshtha Type', hi: 'कोष्ठ', icon: 'gastroenterology', options: KOSHTHA_OPTIONS },
];

const PAIRS = { 'pitta|vata': 'Vata-Pitta', 'kapha|pitta': 'Pitta-Kapha', 'kapha|vata': 'Kapha-Vata' };

export function normalizeDosha(value) {
  const v = String(value || '').toLowerCase();
  if (!v.trim()) return '';
  if (/tridosh|sannipat/.test(v)) return 'Tridoshaja';
  const found = ['vata', 'pitta', 'kapha'].filter(d => v.includes(d === 'kapha' ? 'kap' : d));
  if (found.length === 3) return 'Tridoshaja';
  if (found.length === 2) return PAIRS[[...found].sort().join('|')];
  if (found.length === 1) return `${found[0][0].toUpperCase()}${found[0].slice(1)} Dominant`;
  return '';
}

export function normalizeAgni(value) {
  const v = String(value || '').toLowerCase();
  if (/vishama/.test(v)) return AGNI_OPTIONS[1];
  if (/tikshn|tiksn|teekshn/.test(v)) return AGNI_OPTIONS[2];
  if (/manda/.test(v)) return AGNI_OPTIONS[3];
  if (/sama/.test(v)) return AGNI_OPTIONS[0];
  return '';
}

export function normalizeKoshtha(value) {
  const v = String(value || '').toLowerCase();
  if (/krura|krur/.test(v)) return KOSHTHA_OPTIONS[1];
  if (/mrudu|mridu|mrdu/.test(v)) return KOSHTHA_OPTIONS[2];
  if (/madhyam/.test(v)) return KOSHTHA_OPTIONS[0];
  return '';
}

/** The patient's current (possibly physician-verified) 3-pillar assessment. */
export function assessmentOf(p) {
  return {
    dosha: normalizeDosha(p?.dosha),
    agni: normalizeAgni(p?.agni || p?.ayurvedicNotes?.agni),
    koshtha: normalizeKoshtha(p?.koshtha || p?.ayurvedicNotes?.koshtha),
  };
}

/** What the AI triage originally reported — kept by the server once a physician edits. */
export function aiAssessmentOf(p) {
  return p?.aiAssessment ? assessmentOf(p.aiAssessment) : assessmentOf(p);
}
