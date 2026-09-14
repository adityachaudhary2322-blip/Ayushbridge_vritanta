// Chronological disease progression timeline (oldest → present).
// Two renderers share one status palette: Tailwind for the dark workstation, and
// inline styles for the A4 sheet so html2canvas captures borders and fills exactly.

const TIMELINE_STATUS = {
  Mild: { chip: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30', dot: 'bg-sky-400', print: '#0369a1' },
  Moderate: { chip: 'bg-stone-500/15 text-stone-300 ring-1 ring-stone-500/40', dot: 'bg-stone-400', print: '#57534e' },
  Worsening: { chip: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-600/40', dot: 'bg-amber-500', print: '#b45309' },
  Acute: { chip: 'bg-rose-600/15 text-rose-300 ring-1 ring-rose-500/40', dot: 'bg-rose-500', print: '#9f1239' },
  Improving: { chip: 'bg-emerald-600/15 text-emerald-400 ring-1 ring-emerald-600/30', dot: 'bg-emerald-500', print: '#047857' },
  Chronic: { chip: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30', dot: 'bg-violet-400', print: '#6d28d9' },
};

const styleFor = (status) => TIMELINE_STATUS[status] || TIMELINE_STATUS.Moderate;

export default function DiseaseTimeline({ events, bare = false }) {
  if (!Array.isArray(events) || !events.length) {
    return bare ? <p className="text-sm text-stone-500">No progression details recorded at intake.</p> : null;
  }
  const list = (
    <ol className="relative">
      {events.map((e, i) => {
        const st = styleFor(e.status);
        const last = i === events.length - 1;
        return (
          <li key={i} className="relative pl-6 pb-4 last:pb-0">
            {!last && <span className="absolute left-[5px] top-3.5 bottom-0 w-px bg-amber-600/40" aria-hidden="true" />}
            <span className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full ring-2 ring-stone-900 ${st.dot}`} aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-semibold tabular-nums text-stone-300">{e.timeframe}</span>
              <span className={`px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wide ${st.chip}`}>{e.status}</span>
            </div>
            <p className="text-sm leading-snug text-stone-400 mt-0.5">{e.event}</p>
          </li>
        );
      })}
    </ol>
  );
  if (bare) return list;
  return (
    <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 mb-2.5">
        <span className="material-symbols-outlined text-[15px]">timeline</span>
        📅 Disease Progression Timeline / रोग प्रगति समय-रेखा
      </span>
      {list}
    </div>
  );
}

/** Print-safe variant for the A4 case sheet / PDF export. */
export function PrintDiseaseTimeline({ events }) {
  if (!Array.isArray(events) || !events.length) {
    return <div style={{ color: '#555' }}>No progression details recorded at intake.</div>;
  }
  return (
    <div style={{ paddingLeft: 4 }}>
      {events.map((e, i) => {
        const st = styleFor(e.status);
        const last = i === events.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            {/* Node + connector drawn as boxes (no absolute positioning) so html2canvas never misplaces them. */}
            <div style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: st.print, border: '2px solid #fff', boxShadow: `0 0 0 1px ${st.print}`, marginTop: 3, boxSizing: 'border-box' }} />
              {!last && <div style={{ width: 2, flex: 1, minHeight: 16, background: '#d6d3d1', marginTop: 2 }} />}
            </div>
            <div style={{ flex: 1, border: '1px solid #e7e5e4', borderLeft: `3px solid ${st.print}`, borderRadius: 4, padding: '5px 10px', marginBottom: last ? 0 : 8, background: '#fcfbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{e.timeframe}</strong>
                <span style={{ border: `1px solid ${st.print}`, color: st.print, borderRadius: 10, padding: '0 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.status}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#333', marginTop: 2 }}>{e.event}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
