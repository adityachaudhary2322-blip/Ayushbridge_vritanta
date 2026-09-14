import { useState } from 'react';
import {
  FORMULATIONS, TIMINGS, emptyMedication, patientToken,
  buildConsultationDraft, filledMedications,
} from '../utils/consultation';

const API = '/api';

const field = 'w-full rounded-md bg-stone-950 border border-stone-700 px-2.5 py-1.5 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600';
const label = 'text-[11px] font-semibold uppercase tracking-wider text-stone-400';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Physician Clinical Action Suite: diagnosis, dynamic Rx table, Pathya-Apathya,
 * follow-up, and the unified Save / PDF / Delete footer for one patient.
 *
 * `draft` + `onDraftChange` let the workstation keep unsaved typing per patient, so
 * switching between queue cards never throws away a half-written prescription.
 */
export default function DiagnosisRxPanel({
  patient, onSaved, draft, onDraftChange,
  onDownloadPdf, onDelete, deleting = false,
}) {
  const [form, setFormState] = useState(() => draft || buildConsultationDraft(patient));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const setForm = (next) => { setFormState(next); onDraftChange?.(next); setSaved(false); };
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setMed = (i, k, v) => setForm({ ...form, prescription: form.prescription.map((m, j) => (j === i ? { ...m, [k]: v } : m)) });
  const addMed = () => setForm({ ...form, prescription: [...form.prescription, emptyMedication()] });
  const removeMed = (i) => {
    const next = form.prescription.filter((_, j) => j !== i);
    setForm({ ...form, prescription: next.length ? next : [emptyMedication()] });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const payload = {
      token: patientToken(patient),
      diagnosis: form.diagnosis,
      ayushDiagnosis: form.ayushDiagnosis,
      clinicalNotes: form.clinicalNotes,
      prescription: filledMedications(form.prescription),
      advice: form.advice,
      followUpDate: form.followUpDate,
      status: 'COMPLETED',
      // The physician-verified AYUSH pillars from the assessment card (read at click time).
      dosha: patient?.dosha,
      agni: patient?.agni,
      koshtha: patient?.koshtha,
    };
    try {
      const res = await fetch(`${API}/consultation/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || 'Save failed');
      onSaved?.(data.consultation || { ...payload, signedAt: new Date().toISOString() }, data.record);
      setSaved(true);
    } catch (err) {
      // A demo laptop losing the backend must not lose the physician's typing —
      // keep it in the dashboard so the A4 sheet and PDF still carry the Rx.
      console.error('[DiagnosisRxPanel] save failed:', err);
      onSaved?.({ ...payload, signedAt: new Date().toISOString(), offline: true });
      setSaved(true);
      setError('Saved locally — backend unreachable, the printed sheet still carries this Rx.');
    } finally {
      setSaving(false);
    }
  };

  const signed = saved || !!patient?.consultation?.signedAt;

  return (
    <section className="card-surface rounded-xl bg-stone-900/90 border border-stone-800">
      <header className="px-4 py-2.5 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">prescriptions</span>
          Physician Prescription &amp; Sign-off <span className="font-serif normal-case tracking-normal text-stone-400">· चिकित्सक निदान एवं नुस्खा</span>
        </h3>
        {signed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-600/30 bg-emerald-600/15 text-[11px] font-semibold text-emerald-400">
            <span className="material-symbols-outlined text-[14px]">verified</span> Consultation finalised
          </span>
        )}
      </header>

      <div className="p-4 flex flex-col gap-4">
        {/* Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Primary Diagnosis</span>
            <textarea rows={3} className={field} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)}
              placeholder="e.g. Acute gastritis; r/o peptic ulcer disease" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Samprapti / Ayurvedic Differential</span>
            <textarea rows={3} className={`${field} font-serif`} value={form.ayushDiagnosis} onChange={e => set('ayushDiagnosis', e.target.value)}
              placeholder="Doshic vitiation, Nidana, Samprapti…" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Examination Notes</span>
            <textarea rows={3} className={field} value={form.clinicalNotes} onChange={e => set('clinicalNotes', e.target.value)}
              placeholder="Nadi, Jihva, tenderness, vitals…" />
          </label>
        </div>

        {/* Dynamic Rx table */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={label}>℞ Prescription — Newly Prescribed</span>
            <button onClick={addMed} type="button"
              className="px-2.5 py-1 rounded-md border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10 text-xs font-semibold flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[15px]">add</span> Add Row / दवा जोड़ें
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-stone-800">
            <table className="w-full text-left text-sm min-w-[760px]">
              <thead className="bg-stone-800/50 text-[11px] uppercase tracking-wider text-stone-300">
                <tr>
                  <th className="px-2.5 py-2 font-semibold w-[26%]">Medicine Name</th>
                  <th className="px-2.5 py-2 font-semibold w-[13%]">Form</th>
                  <th className="px-2.5 py-2 font-semibold w-[18%]">Dose &amp; Frequency</th>
                  <th className="px-2.5 py-2 font-semibold w-[24%]">Timing</th>
                  <th className="px-2.5 py-2 font-semibold w-[13%]">Duration</th>
                  <th className="px-2.5 py-2 w-[6%]"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {form.prescription.map((m, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-2 py-1.5">
                      <input className={field} value={m.name} onChange={e => setMed(i, 'name', e.target.value)} placeholder="Arogyavardhini Vati" aria-label={`Medicine ${i + 1} name`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={field} value={m.form} onChange={e => setMed(i, 'form', e.target.value)} aria-label={`Medicine ${i + 1} form`}>
                        {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${field} tabular-nums`} value={m.dosage} onChange={e => setMed(i, 'dosage', e.target.value)} placeholder="500mg · 1-0-1" aria-label={`Medicine ${i + 1} dose`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={field} value={m.timing} onChange={e => setMed(i, 'timing', e.target.value)} aria-label={`Medicine ${i + 1} timing`}>
                        {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={field} value={m.duration} onChange={e => setMed(i, 'duration', e.target.value)} placeholder="14 days" aria-label={`Medicine ${i + 1} duration`} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => removeMed(i)} title="Remove row"
                        className="w-8 h-8 rounded-md text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pathya-Apathya & follow-up */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <label className="lg:col-span-3 flex flex-col gap-1.5">
            <span className={label}>Dietary &amp; Lifestyle Advice <span className="font-serif normal-case tracking-normal">(Pathya-Apathya)</span></span>
            <textarea rows={2} className={field} value={form.advice} onChange={e => set('advice', e.target.value)}
              placeholder="Pathya: warm light meals, moong dal, lukewarm water. Apathya: curd at night, fried food…" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Follow-up Date</span>
            {/* Older sign-offs stored free text ("after 7 days") — keep it editable as text. */}
            {form.followUpDate && !ISO_DATE.test(form.followUpDate) ? (
              <input className={field} value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
            ) : (
              <input type="date" className={`${field} [color-scheme:dark]`} value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
            )}
          </label>
        </div>
      </div>

      {/* Unified action footer */}
      <footer className="px-4 py-3 border-t border-stone-800 bg-stone-950/40 flex flex-wrap items-center gap-2.5 rounded-b-xl">
        <button onClick={handleSave} disabled={saving} type="button"
          className="px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60">
          <span className={`material-symbols-outlined text-[18px] ${saving ? 'animate-spin' : ''}`}>{saving ? 'progress_activity' : 'save'}</span>
          {saving ? 'Saving…' : '💾 Save & Finalize Consultation (पर्चा सुरक्षित करें)'}
        </button>
        {onDownloadPdf && (
          <button onClick={onDownloadPdf} type="button"
            className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            📥 Save / Download PDF (A4 Case Sheet)
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} disabled={deleting} type="button"
            className="ml-auto px-3.5 py-2 rounded-md border border-rose-700/60 text-rose-400 hover:bg-rose-950/50 text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60">
            <span className="material-symbols-outlined text-[18px]">delete</span>
            {deleting ? 'Deleting…' : '🗑️ Delete Record'}
          </button>
        )}
        {error && <span className="w-full text-xs text-amber-400">{error}</span>}
      </footer>
    </section>
  );
}
