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
  const ocr = p.documents?.ocrData;
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
          <Row label="Red Flags / Alerts" value={(p.redFlags && p.redFlags !== 'None') ? p.redFlags : (p.surgicalAlert ? 'Surgical alert flagged' : 'None')} />
        </Section>

        <Section n={3} title="Ayurvedic Assessment">
          <Row label="Dosha Imbalance" value={p.dosha} />
          <Row label="Agni (Digestive Fire)" value={agni} />
          <Row label="Koshtha (Bowel)" value={koshtha} />
          <Row label="Ama Markers" value={ama} />
        </Section>

        <Section n={4} title="Document OCR Findings">
          <Row label="Document Type" value={ocr?.documentType || 'No document uploaded'} />
          <div style={{ padding: '2px 0' }}>
            <span style={{ minWidth: 150, color: '#555', fontWeight: 600, display: 'inline-block' }}>Current Medications</span>
            {ocr?.medicines?.length ? (
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {ocr.medicines.map((m, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{m.name}{m.dosage ? ` — ${m.dosage}` : ''} {m.ayushCategory && m.ayushCategory !== 'Unknown' ? `(${m.ayushCategory})` : ''}</li>
                ))}
              </ul>
            ) : <span> {p.meds && p.meds !== 'None' ? p.meds : '— None recorded'}</span>}
          </div>
          <div style={{ padding: '4px 0' }}>
            <span style={{ minWidth: 150, color: '#555', fontWeight: 600, display: 'inline-block' }}>Abnormal Lab Markers</span>
            {ocr?.abnormalLabValues?.length ? (
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {ocr.abnormalLabValues.map((l, i) => (
                  <li key={i} style={{ marginBottom: 2, color: l.flag === 'High' ? '#b3261e' : l.flag === 'Low' ? '#e8710a' : '#111' }}>
                    {l.test}: <strong>{l.value}</strong> {l.flag ? `(${l.flag})` : ''}
                  </li>
                ))}
              </ul>
            ) : <span> {p.labs && p.labs !== 'None' ? p.labs : '— None recorded'}</span>}
          </div>
          {ocr?.clinicalImpressions && <Row label="Doctor Impression (OCR)" value={ocr.clinicalImpressions} />}
        </Section>

        <Section n={5} title="Physician Clinical Diagnosis & Plan">
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
