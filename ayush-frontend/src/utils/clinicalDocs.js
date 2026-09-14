/**
 * Normalises a patient's attached documents into one shape the dashboard and the
 * A4 case sheet can both render.
 *
 * Handles both storage generations:
 *  - current: { reports[], aggregatedMedicines[], aggregatedLabFlags[] } (multi-report)
 *  - legacy:  { ocrData: { medicines[], abnormalLabValues[] } }          (single file)
 */

export const LAB_FLAG_STYLE = {
  // CRITICAL pulses on screen so it cannot be missed in a busy queue.
  // Ruby → warm amber-red → muted amber → forest sage. Tuned for the dark stone canvas.
  CRITICAL: { chip: 'bg-rose-700 text-white animate-pulse ring-2 ring-rose-500/70', print: '#9f1239', label: 'CRITICAL' },
  HIGH: { chip: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/40', print: '#c2410c', label: 'HIGH' },
  LOW: { chip: 'bg-amber-500/10 text-amber-300/90 ring-1 ring-amber-600/40', print: '#b45309', label: 'LOW' },
  NORMAL: { chip: 'bg-emerald-600/15 text-emerald-400 ring-1 ring-emerald-600/30', print: '#047857', label: 'NORMAL' },
};

/** Short, India-formatted timestamp for a document badge. */
export function docTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return String(ts); }
}

const UNVERIFIED = { chip: 'bg-stone-700/40 text-stone-400 ring-1 ring-stone-600/50', print: '#57534e', label: 'UNVERIFIED' };

/**
 * Style for a lab flag. An unrecognised flag falls back to a neutral badge —
 * never to NORMAL, so a value we could not classify is never shown as healthy.
 */
export const flagStyle = (flag) => {
  const f = String(flag || '').toUpperCase();
  if (f === 'ABNORMAL') return LAB_FLAG_STYLE.HIGH;
  return LAB_FLAG_STYLE[f] || UNVERIFIED;
};

const LEGACY_FLAG = { High: 'HIGH', Low: 'LOW', Critical: 'CRITICAL', Abnormal: 'HIGH' };

export function normalizeClinicalDocs(documents) {
  const empty = { reports: [], medicines: [], labTests: [], observations: '', correlation: '', hasData: false };
  if (!documents) return empty;

  const ocr = documents.ocrData || {};
  const reports = Array.isArray(documents.reports) ? documents.reports : [];

  // ── Medications ──
  let medicines = Array.isArray(documents.aggregatedMedicines) ? documents.aggregatedMedicines : [];
  if (!medicines.length && reports.length) {
    medicines = reports.flatMap(r => (r.medicines || []).map(m => ({ ...m, source: r.title || r.fileName })));
  }
  if (!medicines.length && Array.isArray(ocr.medicines)) {
    medicines = ocr.medicines.map(m => ({
      name: m.name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      instructions: m.instructions || '',
      source: m.ayushCategory && m.ayushCategory !== 'Unknown' ? m.ayushCategory : '',
    }));
  }

  // ── Lab parameters (prefer the full matrix, fall back to abnormal-only) ──
  let labTests = Array.isArray(documents.aggregatedLabFlags) ? documents.aggregatedLabFlags : [];
  if (!labTests.length && reports.length) {
    labTests = reports.flatMap(r => (r.labTests || []).map(l => ({ ...l, source: r.title || r.fileName })));
  }
  if (!labTests.length && Array.isArray(ocr.labTests)) labTests = ocr.labTests;
  if (!labTests.length && Array.isArray(ocr.abnormalLabValues)) {
    labTests = ocr.abnormalLabValues.map(l => ({
      testName: l.test || l.testName,
      observedValue: l.value || l.observedValue || '',
      referenceRange: l.referenceRange || '',
      flag: LEGACY_FLAG[l.flag] || String(l.flag || '').toUpperCase() || 'HIGH',
    }));
  }
  labTests = labTests.map(l => ({ ...l, flag: String(l.flag || 'NORMAL').toUpperCase() }));

  const observations = ocr.clinicalImpressions
    || reports.map(r => r.clinicalObservations).filter(Boolean).join(' ')
    || '';
  const correlation = ocr.ayushCorrelation
    || reports.map(r => r.ayushCorrelation).filter(Boolean).join(' ')
    || '';

  return {
    reports,
    medicines,
    labTests,
    observations,
    correlation,
    hasData: !!(reports.length || medicines.length || labTests.length || observations),
  };
}

/** Human label for a document type across both storage generations. */
export function docTypeLabel(type) {
  const t = String(type || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (t === 'PRESCRIPTION') return '📄 Prescription';
  if (t === 'LAB_REPORT') return '🧪 Lab Report';
  if (t === 'MIXED') return '📄🧪 Prescription + Lab';
  return type || 'Document';
}
