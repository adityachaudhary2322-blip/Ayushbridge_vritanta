import { normalizeClinicalDocs, flagStyle, docTypeLabel } from '../utils/clinicalDocs';

// Printable A4 "Combined Total Case History Sheet" — Ministry of AYUSH format.
// Rendered in an overlay; window.print() + @media print CSS isolate the sheet.

const PRIORITY_TAG = {
  P1: { bg: '#b3261e', label: 'Critical' },
  P2: { bg: '#e8710a', label: 'Urgent' },
  P3: { bg: '#1a73e8', label: 'Moderate' },
  P4: { bg: '#188038', label: 'Routine' },
};

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(ts); }
}

export default function CaseHistorySheet({ patient, onClose }) {
  if (!patient) return null;
  const p = patient;
  const clinical = normalizeClinicalDocs(p.documents);
  const tag = PRIORITY_TAG[p.triageLevel] || PRIORITY_TAG.P3;
  const token = p.id ? `AYUSH-${String(p.id).slice(-6).toUpperCase()}` : 'AYUSH-000000';
  const agni = p.agni || p.ayurvedicNotes?.agni || '—';
  const koshtha = p.koshtha || p.ayurvedicNotes?.koshtha || '—';
  const ama = /manda|vishama/i.test(agni) ? 'Ama present (Sama condition suggested)' : 'Nirama (no significant Ama markers)';

  const Section = ({ n, title, children }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: '#f1f3f4', borderLeft: '4px solid #188038', padding: '5px 10px', fontWeight: 700, fontSize: 12.5, color: '#111', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {n}. {title}
      </div>
      <div style={{ padding: '8px 4px', fontSize: 12.5, color: '#1a1a1a', lineHeight: 1.5 }}>{children}</div>
    </div>
  );

  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
      <span style={{ minWidth: 150, color: '#555', fontWeight: 600 }}>{label}</span>
      <span style={{ flex: 1, color: '#111' }}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-start justify-center overflow-auto p-4" onClick={onClose}>
      {/* Print isolation styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #case-sheet, #case-sheet * { visibility: visible !important; }
          #case-sheet { position: absolute !important; left: 0; top: 0; width: 210mm !important; min-height: 297mm; margin: 0 !important; padding: 16mm !important; box-shadow: none !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-4 right-4 z-[310] flex gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container transition-all flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print / Save as PDF
        </button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md shadow-md hover:bg-surface-container transition-colors flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">close</span>
          Close
        </button>
      </div>

      {/* A4 sheet */}
      <div
        id="case-sheet"
        onClick={e => e.stopPropagation()}
        style={{ width: '210mm', minHeight: '297mm', background: '#fff', color: '#111', padding: '16mm', boxSizing: 'border-box', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', fontFamily: "'Inter', system-ui, sans-serif", margin: '8px 0' }}
      >
        {/* Official header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #188038', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: 10, background: '#188038', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>आ</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>Ministry of AYUSH — Clinical Triage</div>
              <div style={{ fontSize: 11, color: '#555' }}>Government of India · AYUSH Swasthya Sahayak · Combined Total Case History Sheet</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#333' }}>
            <div><strong>Date:</strong> {fmt(p.timestamp)}</div>
            <div><strong>Token:</strong> {token}</div>
            <div style={{ marginTop: 4, display: 'inline-block', background: tag.bg, color: '#fff', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>
              {p.triageLevel} — {p.triageLabel || tag.label}
            </div>
          </div>
        </div>

        <Section n={1} title="Patient Demographics & Contact">
          <Row label="Full Name" value={p.name} />
          <Row label="Age / Gender" value={`${p.age || '—'} / ${p.gender || '—'}`} />
          <Row label="Mobile Number" value={p.phone} />
          <Row label="Registration Time" value={fmt(p.timestamp)} />
          <Row label="Patient ID" value={p.id} />
        </Section>

        <Section n={2} title="Clinical Presentation & History">
          <Row label="Chief Complaint" value={p.chiefComplaint} />
          <Row label="Reported Symptoms" value={p.symptoms} />
          <Row label="Chronic History (Purva Vyadhi)" value={(p.chronic_history && p.chronic_history !== 'N/A') ? p.chronic_history : 'None reported'} />
          <Row label="Red Flags / Alerts" value={(p.redFlags && p.redFlags !== 'None') ? p.redFlags : (p.surgicalAlert ? 'Surgical alert flagged' : 'None')} />
        </Section>

        <Section n={3} title="AYUSH Rogi Pariksha (Ayurvedic Assessment)">
          <Row label="Dosha Imbalance" value={p.dosha} />
          <Row label="Agni (Digestive Fire)" value={agni} />
          <Row label="Koshtha (Bowel)" value={koshtha} />
          <Row label="Ama Markers" value={ama} />
          <Row label="Nidra & Manas (Sleep/Stress)" value={(p.sleep_stress && p.sleep_stress !== 'N/A') ? p.sleep_stress : '—'} />
          <Row label="Bala & Lifestyle (Energy)" value={(p.energy_lifestyle && p.energy_lifestyle !== 'N/A') ? p.energy_lifestyle : '—'} />
        </Section>

        <Section n={4} title="Active Medications (Aushadhi Sevana)">
          <Row
            label="Source Documents"
            value={clinical.reports.length
              ? clinical.reports.map(r => `${docTypeLabel(r.documentType)} — ${r.title || r.fileName}`).join(' | ')
              : (p.documents?.ocrData?.documentType || 'No document uploaded')}
          />
          {clinical.medicines.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {clinical.medicines.map((m, i) => (
                <span key={i} style={{ border: '1px solid #188038', borderRadius: 14, padding: '3px 10px', fontSize: 11.5, background: '#f2f8f3', color: '#111' }}>
                  <strong>{m.name}</strong>
                  {m.dosage ? ` · ${m.dosage}` : ''}
                  {m.frequency ? ` · ${m.frequency}` : ''}
                  {m.instructions ? ` (${m.instructions})` : ''}
                </span>
              ))}
            </div>
          ) : (
            <Row label="Current Medications" value={p.meds && p.meds !== 'None' ? p.meds : 'None recorded'} />
          )}
        </Section>

        <Section n={5} title="Diagnostic Lab Matrix">
          {clinical.labTests.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 4 }}>
              <thead>
                <tr style={{ background: '#f1f3f4' }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px', border: '1px solid #ddd', width: '34%' }}>Test Parameter</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', border: '1px solid #ddd', width: '22%' }}>Observed Value</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', border: '1px solid #ddd', width: '28%' }}>Normal Range</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', border: '1px solid #ddd', width: '16%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {clinical.labTests.map((l, i) => {
                  const st = flagStyle(l.flag);
                  return (
                    <tr key={i}>
                      <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>{l.testName}</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #ddd', fontWeight: 700 }}>{l.observedValue || '—'}</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #ddd', color: '#555' }}>{l.referenceRange || '—'}</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>
                        <span style={{ background: st.print, color: '#fff', borderRadius: 12, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Row label="Lab Markers" value={p.labs && p.labs !== 'None' ? p.labs : 'None recorded'} />
          )}
          {clinical.observations && <div style={{ marginTop: 6 }}><Row label="Clinical Observations" value={clinical.observations} /></div>}
        </Section>

        <Section n={6} title="AI Diagnostic Correlation">
          <div style={{ background: '#f7f5ff', borderLeft: '3px solid #6750a4', padding: '8px 10px', fontSize: 12, lineHeight: 1.55 }}>
            {p.diagnosticCorrelation || clinical.correlation ||
              `Reported markers — Dosha ${p.dosha || '—'}, Agni ${agni}, Koshtha ${koshtha}. ${clinical.labTests.length ? 'Correlate the lab matrix above with these Ayurvedic markers during examination.' : 'No prior records available for correlation.'}`}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
            AI-generated correlation of past prescriptions and lab markers with current Rogi Pariksha findings — requires physician verification.
          </div>
        </Section>

        <Section n={7} title="Physician Clinical Diagnosis & Plan">
          <Row label="AI Recommendation" value={p.recommendation} />
          <div style={{ marginTop: 8 }}>
            <div style={{ color: '#555', fontWeight: 600, marginBottom: 4 }}>Clinical Diagnosis</div>
            <div style={{ borderBottom: '1px dashed #999', height: 22 }} />
            <div style={{ borderBottom: '1px dashed #999', height: 22 }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ color: '#555', fontWeight: 600, marginBottom: 4 }}>Recommended Panchakarma / Aushadhi</div>
            <div style={{ borderBottom: '1px dashed #999', height: 22 }} />
            <div style={{ borderBottom: '1px dashed #999', height: 22 }} />
          </div>
          <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 11, color: '#666' }}>
              Generated by AYUSH Swasthya Sahayak AI · For physician verification &amp; dual sign-off.
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #111', width: 200, paddingTop: 4, fontSize: 11, color: '#333' }}>Physician Signature &amp; Seal</div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
