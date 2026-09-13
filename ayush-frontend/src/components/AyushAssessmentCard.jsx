import { AYUSH_PILLARS } from '../utils/ayushPillars';

/**
 * Editable 3-pillar AYUSH Clinical Assessment (Dosha, Agni, Koshtha).
 * Pre-filled with the AI triage read; any pillar the physician changes is flagged.
 */
export default function AyushAssessmentCard({ idPrefix, value, aiValue, onChange }) {
  const editedCount = AYUSH_PILLARS.filter(({ key }) => value[key] && value[key] !== aiValue[key]).length;

  return (
    <div className="rounded-2xl bg-slate-900 border-2 border-orange-500 p-3.5 flex flex-col gap-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-label-lg text-label-lg text-orange-400 font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">spa</span>
          AYUSH Clinical Assessment / आयुष नैदानिक मूल्यांकन
        </span>
        <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${editedCount ? 'bg-orange-500 text-white' : 'bg-emerald-600 text-white'}`}>
          {editedCount ? `${editedCount} verified by doctor` : 'AI triage values'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {AYUSH_PILLARS.map(({ key, label, hi, icon, options }) => {
          const edited = value[key] && value[key] !== aiValue[key];
          const id = `ayush-${idPrefix}-${key}`;
          return (
            <div key={key} className="flex flex-col gap-1 min-w-0">
              <label htmlFor={id} className="font-label-sm text-label-sm text-slate-300 uppercase tracking-wide flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-400 text-[14px]">{icon}</span>
                {label} <span className="normal-case text-slate-400">· {hi}</span>
              </label>
              <select
                id={id}
                value={value[key] || ''}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                className={`w-full rounded-xl bg-slate-800 text-white px-2.5 py-2 font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${edited ? 'border-orange-500' : 'border-slate-700'}`}
              >
                {!value[key] && <option value="">Select…</option>}
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {edited ? (
                <span className="font-label-sm text-label-sm text-orange-400 normal-case" title={`AI triage: ${aiValue[key] || 'not assessed'}`}>
                  ✎ Edited by Doctor / चिकित्सक द्वारा संशोधित
                </span>
              ) : (
                <span className="font-label-sm text-label-sm text-slate-500 normal-case">AI triage value</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="font-label-sm text-label-sm text-slate-400 normal-case">
        Saved with <strong className="text-emerald-400">💾 Save &amp; Finalize Prescription</strong> below.
      </p>
    </div>
  );
}
