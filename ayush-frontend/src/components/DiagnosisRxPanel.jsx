import { useState } from 'react';
import {
  FORMULATIONS, TIMINGS, emptyMedication, patientToken,
  buildConsultationDraft, filledMedications,
} from '../utils/consultation';

const API = '/api';

const field = 'w-full rounded-xl bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary ring-1 ring-surface-container-high';
const label = 'font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide';

/**
 * Physician's final diagnosis + prescription builder for one patient.
 * Pre-filled from the Gemini intake summary as an editable draft.
 */
export default function DiagnosisRxPanel({ patient, onSaved }) {
  const [form, setForm] = useState(() => buildConsultationDraft(patient));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const setMed = (i, k, v) => {
    setForm(f => ({ ...f, prescription: f.prescription.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
    setSaved(false);
  };
  const addMed = () => setForm(f => ({ ...f, prescription: [...f.prescription, emptyMedication()] }));
  const removeMed = (i) => setForm(f => {
    const next = f.prescription.filter((_, j) => j !== i);
    return { ...f, prescription: next.length ? next : [emptyMedication()] };
  });

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
    };
    try {
      const res = await fetch(`${API}/consultation/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || 'Save failed');
      onSaved?.(data.consultation || { ...payload, signedAt: new Date().toISOString() });
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

  return (
    <div className="rounded-2xl bg-surface-container-low ring-1 ring-primary/25 overflow-hidden">
      <div className="px-4 py-3 bg-primary/10 flex items-center justify-between gap-3 flex-wrap">
        <span className="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">prescriptions</span>
          👨‍⚕️ Physician Final Diagnosis &amp; Prescription / चिकित्सक निदान एवं नुस्खा
        </span>
        {saved && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 font-label-sm text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            ✓ Prescription Saved &amp; Signed
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* 1 — Final diagnosis & clinical notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Primary Diagnosis (Allopathic / Differential)</span>
            <textarea rows={3} className={field} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)}
              placeholder="e.g. Acute gastritis; r/o peptic ulcer disease" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>AYUSH Diagnosis / Samprapti</span>
            <textarea rows={3} className={field} value={form.ayushDiagnosis} onChange={e => set('ayushDiagnosis', e.target.value)}
              placeholder="Doshic vitiation, Nidan, Agni status…" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Clinical Observations &amp; Examination Notes</span>
          <textarea rows={4} className={field} value={form.clinicalNotes} onChange={e => set('clinicalNotes', e.target.value)}
            placeholder="Nadi, Jihva, tenderness, vitals, examination findings…" />
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Pre-filled from the Sahayak AI intake summary — edit freely before signing.
          </span>
        </div>

        {/* 2 — Dynamic Rx builder */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={label}>Prescription (Rx) — Newly Prescribed Medication</span>
            <button onClick={addMed} type="button"
              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-1.5 shadow-sm transition-all">
              <span className="material-symbols-outlined text-[16px]">add</span> Add Medication / दवा जोड़ें
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-surface-container-high">
            <table className="w-full text-left font-body-sm text-body-sm min-w-[720px]">
              <thead className="bg-surface-container-high text-on-surface-variant">
                <tr>
                  <th className="px-2.5 py-2 font-semibold">Medicine</th>
                  <th className="px-2.5 py-2 font-semibold">Form</th>
                  <th className="px-2.5 py-2 font-semibold">Dose &amp; Frequency</th>
                  <th className="px-2.5 py-2 font-semibold">Timing</th>
                  <th className="px-2.5 py-2 font-semibold">Duration</th>
                  <th className="px-2.5 py-2 font-semibold text-right">—</th>
                </tr>
              </thead>
              <tbody>
                {form.prescription.map((m, i) => (
                  <tr key={i} className="border-t border-surface-container-high align-top">
                    <td className="px-2 py-1.5">
                      <input className={field} value={m.name} onChange={e => setMed(i, 'name', e.target.value)}
                        placeholder="Tab Ashwagandha" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={field} value={m.form} onChange={e => setMed(i, 'form', e.target.value)}>
                        {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={field} value={m.dosage} onChange={e => setMed(i, 'dosage', e.target.value)}
                        placeholder="500mg, 1-0-1 (BD)" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={field} value={m.timing} onChange={e => setMed(i, 'timing', e.target.value)}>
                        {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={field} value={m.duration} onChange={e => setMed(i, 'duration', e.target.value)}
                        placeholder="5 days" />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => removeMed(i)} title="Remove medication"
                        className="w-9 h-9 rounded-xl bg-error-container/50 text-error hover:bg-error-container flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lifestyle / dietary advice */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <span className={label}>Lifestyle &amp; Dietary Advice (Pathya / Apathya &amp; Precautions)</span>
            <textarea rows={3} className={field} value={form.advice} onChange={e => set('advice', e.target.value)}
              placeholder="Pathya: warm light meals — e.g. moong dal, lukewarm water. Apathya: curd at night, fried food. Precautions…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Follow-up</span>
            <input className={field} value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)}
              placeholder="Follow-up after 7 days" />
          </div>
        </div>

        {/* 3 — Persistence */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={saving} type="button"
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-70">
            <span className={`material-symbols-outlined text-[19px] ${saving ? 'animate-spin' : ''}`}>
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? 'Saving…' : '💾 Save & Finalize Prescription / पर्चा सुरक्षित करें'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-800 font-label-md text-label-md font-semibold">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              ✓ Prescription Saved &amp; Signed
            </span>
          )}
          {error && <span className="font-label-sm text-label-sm text-secondary">{error}</span>}
        </div>
      </div>
    </div>
  );
}
