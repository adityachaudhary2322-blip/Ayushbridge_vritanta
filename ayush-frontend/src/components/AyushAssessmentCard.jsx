import { AYUSH_PILLARS } from '../utils/ayushPillars';

/**
 * Editable 3-pillar AYUSH Rogi Pariksha (Dosha, Agni, Koshtha).
 * Pre-filled with the AI triage read; any pillar the physician changes is flagged.
 */
export default function AyushAssessmentCard({ idPrefix, value, aiValue, onChange, correlation }) {
  return (
    <section className="h-full rounded-xl bg-stone-900/90 border border-amber-600/40 p-3.5 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px]">spa</span>
          3-Pillar AYUSH Rogi Pariksha
        </h3>
        <span className="px-1.5 py-px rounded border border-amber-600/40 bg-amber-500/10 text-[10px] font-semibold text-amber-400">
          Editable by Doctor
        </span>
      </header>

      <div className="flex flex-col gap-2.5">
        {AYUSH_PILLARS.map(({ key, label, hi, icon, options }) => {
          const edited = value[key] && value[key] !== aiValue[key];
          const id = `ayush-${idPrefix}-${key}`;
          return (
            <div key={key} className={`rounded-lg border p-2.5 transition-colors ${edited ? 'border-amber-500/70 bg-amber-500/5' : 'border-stone-800 bg-stone-950/60'}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor={id} className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[15px]">{icon}</span>
                  {label} <span className="font-serif text-stone-500">· {hi}</span>
                </label>
                {edited ? (
                  <span className="text-[10px] font-semibold text-amber-400 whitespace-nowrap" title={`AI triage: ${aiValue[key] || 'not assessed'}`}>
                    ✎ Edited by Doctor / चिकित्सक द्वारा संशोधित
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-500 whitespace-nowrap">AI triage value</span>
                )}
              </div>
              <select
                id={id}
                value={value[key] || ''}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                className="w-full rounded-md bg-stone-950 border border-stone-700 text-stone-100 font-serif text-sm px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              >
                {!value[key] && <option value="">Select…</option>}
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {correlation && (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-950/30 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-[14px]">neurology</span>
            AI Vaidya Clinical Correlation
          </p>
          <p className="text-xs leading-relaxed text-stone-300">{correlation}</p>
        </div>
      )}
    </section>
  );
}
