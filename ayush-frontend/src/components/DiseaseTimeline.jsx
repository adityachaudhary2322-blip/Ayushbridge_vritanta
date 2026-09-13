// Chronological disease progression timeline (oldest → present).
// Two renderers share one status palette: Tailwind for the dashboard, and inline
// styles for the A4 sheet so html2canvas captures borders and fills exactly.

const TIMELINE_STATUS = {
  Mild: { chip: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', print: '#1a73e8' },
  Moderate: { chip: 'bg-teal-100 text-teal-800', dot: 'bg-teal-600', print: '#00796b' },
  Worsening: { chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500', print: '#e37400' },
  Acute: { chip: 'bg-red-100 text-red-800', dot: 'bg-red-600', print: '#c5221f' },
  Improving: { chip: 'bg-green-100 text-green-800', dot: 'bg-green-600', print: '#188038' },
  Chronic: { chip: 'bg-violet-100 text-violet-800', dot: 'bg-violet-600', print: '#6750a4' },
};

const styleFor = (status) => TIMELINE_STATUS[status] || TIMELINE_STATUS.Moderate;

export default function DiseaseTimeline({ events }) {
  if (!Array.isArray(events) || !events.length) return null;
  return (
    <div className="rounded-xl bg-surface-container-low p-3">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
        <span className="material-symbols-outlined text-primary text-[15px]">timeline</span>
        📅 Disease Progression Timeline / रोग प्रगति समय-रेखा
      </span>
      <ol className="mt-2.5 relative">
        {events.map((e, i) => {
          const st = styleFor(e.status);
          const last = i === events.length - 1;
          return (
            <li key={i} className="relative pl-6 pb-3 last:pb-0">
              {!last && <span className="absolute left-[5px] top-3 bottom-0 w-0.5 bg-outline-variant/60" aria-hidden="true" />}
              <span className={`absolute left-0 top-1 w-3 h-3 rounded-full ring-2 ring-surface-container-lowest ${st.dot}`} aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-label-md text-label-md text-on-surface font-semibold">{e.timeframe}</span>
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${st.chip}`}>{e.status}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{e.event}</p>
            </li>
          );
        })}
      </ol>
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
              {!last && <div style={{ width: 2, flex: 1, minHeight: 16, background: '#c4c7c5', marginTop: 2 }} />}
            </div>
            <div style={{ flex: 1, border: '1px solid #e0e0e0', borderLeft: `3px solid ${st.print}`, borderRadius: 5, padding: '5px 10px', marginBottom: last ? 0 : 8, background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{e.timeframe}</strong>
                <span style={{ background: st.print, color: '#fff', borderRadius: 12, padding: '1px 9px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.status}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#333', marginTop: 2 }}>{e.event}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
