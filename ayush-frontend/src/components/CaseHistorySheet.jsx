import { useState, useEffect, useRef, useCallback } from 'react';
import { normalizeClinicalDocs, flagStyle, docTypeLabel, docTime } from '../utils/clinicalDocs';
import { filledMedications, patientToken } from '../utils/consultation';
import { PrintDiseaseTimeline } from './DiseaseTimeline';
import { AYUSH_PILLARS, assessmentOf, aiAssessmentOf } from '../utils/ayushPillars';

// Printable A4 "OPD Clinical Record" — Government of India / Ministry of AYUSH format.
// Rendered in an overlay; window.print() + @media print CSS isolate the sheet, and
// html2pdf rasterises the same DOM. Inline styles only, so both pipelines agree.

// Print palette: deep emerald + burnished brass rules on white, 1px stone borders, no black fills.
const EMERALD = '#065f46';
const BRASS = '#b45309';
const RULE = '#d6d3d1';
const INK = '#1c1917';
const MUTED = '#57534e';

const PRIORITY_TAG = {
  P1: { color: '#9f1239', label: 'Critical' },
  P2: { color: '#b45309', label: 'Urgent' },
  P3: { color: '#44403c', label: 'Moderate' },
  P4: { color: '#047857', label: 'Routine' },
};

const cell = { border: `1px solid ${RULE}`, padding: '5px 8px', verticalAlign: 'top' };
const labelCell = { ...cell, width: '18%', background: '#fafaf9', color: MUTED, fontWeight: 600, fontSize: 11 };
const thCell = { ...cell, textAlign: 'left', background: '#fafaf9', color: EMERALD, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3 };
const ruled = (n) => Array.from({ length: n }, (_, i) => <div key={i} style={{ borderBottom: '1px dashed #a8a29e', height: 22 }} />);

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(ts); }
}

function fmtDate(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

const clean = (v) => (v && v !== 'N/A' && v !== 'None' ? v : '');

function Section({ n, title, hi, children }) {
  return (
    <div className="pdf-block" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: `1px solid ${BRASS}`, paddingBottom: 3 }}>
        <span style={{ color: BRASS, fontWeight: 800, fontSize: 12 }}>{n}.</span>
        <span style={{ color: EMERALD, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        {hi && <span style={{ color: MUTED, fontSize: 11, fontFamily: "'Source Serif 4', Georgia, serif" }}>· {hi}</span>}
      </div>
      <div style={{ padding: '7px 0 0', fontSize: 12, color: INK, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/** Two-column key/value table: [[label, value], [label, value]] per row, or a single full-width pair. */
function KvTable({ rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11.5 }}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.length === 1 ? (
              <><td style={labelCell}>{row[0][0]}</td><td style={cell} colSpan={3}>{row[0][1] || '—'}</td></>
            ) : row.map(([k, v]) => (
              <FragmentPair key={k} k={k} v={v} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FragmentPair({ k, v }) {
  return (<><td style={labelCell}>{k}</td><td style={{ ...cell, width: '32%' }}>{v || '—'}</td></>);
}

export default function CaseHistorySheet({ patient, onClose, autoDownload = false }) {
  const [exporting, setExporting] = useState(false);
  const autoRanRef = useRef(false);

  const token = patientToken(patient);

  // html2pdf pulls in jsPDF + html2canvas (~1 MB), so it is imported only when a
  // physician actually asks for a download — it never lands in the main bundle.
  const downloadPdf = useCallback(async () => {
    const sheet = document.getElementById('case-sheet');
    if (!sheet || !patient) return;
    setExporting(true);
    try {
      const mod = await import('html2pdf.js');
      const html2pdf = mod.default || mod;
      // Let the export-mode styles (padding/shadow stripped) paint before capture.
      await new Promise(r => setTimeout(r, 80));
      const safeName = String(patient.name || 'Patient').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '') || 'Patient';
      await html2pdf()
        .set({
          margin: 10,
          filename: `AyushBridge_CaseSheet_${token}_${safeName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['table', 'tr', '.pdf-block'] },
        })
        .from(sheet)
        .save();
    } catch (err) {
      console.error('[CaseHistorySheet] PDF export failed:', err);
      // Falling back to the browser print dialog keeps the physician unblocked.
      window.print();
    } finally {
      setExporting(false);
    }
  }, [patient, token]);

  // Opened straight from the workstation's "Download PDF" button — export once, on paint.
  useEffect(() => {
    if (!autoDownload || autoRanRef.current || !patient) return undefined;
    autoRanRef.current = true;
    const id = setTimeout(downloadPdf, 400);
    return () => clearTimeout(id);
  }, [autoDownload, patient, downloadPdf]);

  if (!patient) return null;
  const p = patient;
  const clinical = normalizeClinicalDocs(p.documents);
  const tag = PRIORITY_TAG[p.triageLevel] || PRIORITY_TAG.P3;
  const pillars = assessmentOf(p);
  const aiPillars = aiAssessmentOf(p);
  const consult = p.consultation || null;
  const rx = filledMedications(consult?.prescription);
  const correlation = clean(p.diagnosticCorrelation) || clinical.correlation;
  const priorityBadge = (
    <span style={{ display: 'inline-block', border: `1.5px solid ${tag.color}`, color: tag.color, borderRadius: 4, padding: '1px 8px', fontWeight: 800, fontSize: 11 }}>
      {p.triageLevel || 'P3'} — {p.triageLabel || tag.label}{p.surgicalAlert ? ' · SURGICAL ALERT' : ''}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-start justify-center overflow-auto p-4" onClick={onClose}>
      {/* Print isolation styles */}
      <style>{`
        /* Badge fills and table rules must survive both the print pipeline and
           the html2canvas rasteriser, hence colour-adjust on the sheet itself. */
        #case-sheet, #case-sheet * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Never slice a section, a table or a table row across a page. */
        #case-sheet .pdf-block,
        #case-sheet table,
        #case-sheet tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #case-sheet thead { display: table-header-group; }
        /* html2canvas samples one frame, so freeze anything animated. */
        #case-sheet * { animation: none !important; }

        @media print {
          body * { visibility: hidden !important; }
          #case-sheet, #case-sheet * { visibility: visible !important; }
          #case-sheet { position: absolute !important; left: 0; top: 0; width: auto !important; min-height: 0; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-4 right-4 z-[310] flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={downloadPdf}
          disabled={exporting}
          className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-70"
        >
          <span className={`material-symbols-outlined text-[18px] ${exporting ? 'animate-spin' : ''}`}>
            {exporting ? 'progress_activity' : 'download'}
          </span>
          {exporting ? 'Generating PDF…' : '📥 Save / Download PDF (पीडीएफ डाउनलोड)'}
        </button>
        <button onClick={() => window.print()} className="px-3.5 py-2 rounded-md border border-stone-600 bg-stone-900 text-stone-200 hover:bg-stone-800 text-sm font-semibold flex items-center gap-1.5 transition-colors">
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print
        </button>
        <button onClick={onClose} className="px-3.5 py-2 rounded-md border border-stone-600 bg-stone-900 text-stone-200 hover:bg-stone-800 text-sm font-semibold flex items-center gap-1.5 transition-colors">
          <span className="material-symbols-outlined text-[18px]">close</span>
          Close
        </button>
      </div>

      {/* A4 sheet */}
      <div
        id="case-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          width: '210mm',
          minHeight: exporting ? 0 : '297mm',
          background: '#fff',
          color: INK,
          padding: exporting ? 0 : '14mm',
          boxSizing: 'border-box',
          boxShadow: exporting ? 'none' : '0 10px 40px rgba(0,0,0,0.5)',
          fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
          margin: exporting ? 0 : '8px 0',
        }}
      >
        {/* ── Government header with double emerald / brass rules ── */}
        <div style={{ borderTop: `3px double ${EMERALD}`, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${BRASS}`, color: BRASS, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, fontFamily: "'Source Serif 4', Georgia, serif" }}>आ</div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: 1.2 }}>भारत सरकार · GOVERNMENT OF INDIA</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: EMERALD, letterSpacing: 0.4 }}>MINISTRY OF AYUSH — OPD CLINICAL RECORD</div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: "'Source Serif 4', Georgia, serif" }}>राष्ट्रीय आयुर्वेद संस्थान · National AYUSH OPD Portal · OPD-Room 4B</div>
              </div>
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <tbody>
                <tr><td style={{ ...labelCell, width: 'auto' }}>OPD Token</td><td style={{ ...cell, fontWeight: 800, color: BRASS }}>{token}</td></tr>
                <tr><td style={{ ...labelCell, width: 'auto' }}>Record Date</td><td style={cell}>{fmt(p.timestamp)}</td></tr>
                <tr><td style={{ ...labelCell, width: 'auto' }}>Triage</td><td style={cell}>{priorityBadge}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 8, borderTop: `3px double ${BRASS}` }} />

        {/* 1 */}
        <Section n={1} title="Demographics & Triage Severity" hi="रोगी विवरण">
          <KvTable rows={[
            [['Full Name', <strong key="n">{p.name}</strong>], ['Patient ID', p.id]],
            [['Age / Gender', `${clean(p.age) || '—'} / ${clean(p.gender) || '—'}`], ['Mobile', clean(p.phone)]],
            [['ABHA Address', p.abhaAddress || p.abhaId || 'Not linked at intake'], ['Intake Channel', p.triageSource || 'Voice Kiosk']],
            [['Triage Severity', priorityBadge]],
            [['Chief Complaint', <strong key="c">{p.chiefComplaint}</strong>]],
            [['Reported Symptoms', p.symptoms]],
            [['Chronic History', clean(p.chronic_history) || 'None reported'], ['Red Flags', clean(p.redFlags) || (p.surgicalAlert ? 'Surgical alert flagged' : 'None')]],
            ...(Array.isArray(p.followups) ? p.followups.map((f, i) => [[`Follow-up Q${i + 1}`, `${f.question} — ${f.answer}`]]) : []),
          ]} />
        </Section>

        {/* 2 */}
        <Section n={2} title="Disease Progression Timeline" hi="रोग प्रगति समय-रेखा">
          <PrintDiseaseTimeline events={p.diseaseTimeline} />
        </Section>

        {/* 3 */}
        <Section n={3} title="Verified 3-Pillar AYUSH Pariksha" hi="दोष · अग्नि · कोष्ठ">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11.5 }}>
            <thead>
              <tr>{AYUSH_PILLARS.map(({ key, label, hi }) => <th key={key} style={thCell}>{label} · {hi}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                {AYUSH_PILLARS.map(({ key }) => {
                  const edited = pillars[key] && pillars[key] !== aiPillars[key];
                  return (
                    <td key={key} style={cell}>
                      <div style={{ fontWeight: 800, color: EMERALD, fontSize: 12, fontFamily: "'Source Serif 4', Georgia, serif" }}>{pillars[key] || 'Not assessed'}</div>
                      <div style={{ marginTop: 3, fontSize: 10, color: edited ? BRASS : MUTED, fontWeight: edited ? 700 : 400 }}>
                        {edited
                          ? `✎ Edited by Doctor (AI: ${aiPillars[key] || 'not assessed'})`
                          : (consult?.signedAt ? '✓ Verified by physician' : 'AI triage value — pending verification')}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
          {correlation && (
            <div style={{ marginTop: 6, borderLeft: `3px solid ${EMERALD}`, padding: '4px 10px', fontSize: 11, color: '#292524' }}>
              <strong style={{ color: EMERALD }}>AI Vaidya correlation:</strong> {correlation}
              <span style={{ color: MUTED }}> (AI-generated — requires physician verification)</span>
            </div>
          )}
        </Section>

        {/* 4 */}
        <Section n={4} title="Scanned Records & Lab Matrix" hi="प्रयोगशाला परिणाम">
          {clinical.reports.length > 0 && (
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
              <strong style={{ color: INK }}>Documents:</strong>{' '}
              {clinical.reports.map((r, i) => (
                <span key={r.id || i}>{i ? ' · ' : ''}{docTypeLabel(r.documentType)} — {r.title || r.fileName}{r.uploadedAt ? ` (${docTime(r.uploadedAt)})` : ''}</span>
              ))}
            </div>
          )}
          {clinical.labTests.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ ...thCell, width: '34%' }}>Test Parameter</th>
                  <th style={{ ...thCell, width: '20%' }}>Observed Value</th>
                  <th style={{ ...thCell, width: '30%' }}>Biological Reference Range</th>
                  <th style={{ ...thCell, width: '16%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {clinical.labTests.map((l, i) => {
                  const st = flagStyle(l.flag);
                  const critical = l.flag === 'CRITICAL';
                  return (
                    <tr key={i} style={critical ? { background: '#fff1f2' } : undefined}>
                      <td style={cell}>{l.testName}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{l.observedValue || '—'}</td>
                      <td style={{ ...cell, color: MUTED }}>{l.referenceRange || '—'}</td>
                      <td style={cell}>
                        <span style={{ border: `1.5px solid ${st.print}`, color: st.print, borderRadius: 4, padding: '0 7px', fontSize: 10, fontWeight: 800 }}>
                          {critical ? '⚠ ' : ''}{st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <KvTable rows={[[['Lab Markers', clean(p.labs) || 'None recorded']]]} />
          )}
          <div style={{ marginTop: 6 }}>
            <KvTable rows={[
              [['Existing Medications', clinical.medicines.length
                ? clinical.medicines.map(m => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join('; ')
                : (clean(p.meds) || 'None recorded')]],
              ...(clinical.observations ? [[['Clinical Observations', clinical.observations]]] : []),
            ]} />
          </div>
        </Section>

        {/* 5 */}
        <Section n={5} title="Attending Physician's Final Prescription" hi="चिकित्सक नुस्खा एवं पथ्य-अपथ्य">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11.5 }}>
            <thead>
              <tr><th style={thCell}>Primary Diagnosis</th><th style={thCell}>Samprapti / Ayurvedic Differential</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cell, whiteSpace: 'pre-wrap' }}>{consult?.diagnosis || ruled(2)}</td>
                <td style={{ ...cell, whiteSpace: 'pre-wrap' }}>{consult?.ayushDiagnosis || ruled(2)}</td>
              </tr>
              {consult?.clinicalNotes && (
                <tr><td style={{ ...cell, whiteSpace: 'pre-wrap' }} colSpan={2}><strong style={{ color: MUTED }}>Examination notes: </strong>{consult.clinicalNotes}</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ marginTop: 8, fontWeight: 800, color: EMERALD, fontSize: 12 }}>℞</div>
          {rx.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ ...thCell, width: '5%' }}>#</th>
                  <th style={{ ...thCell, width: '27%' }}>Medicine</th>
                  <th style={{ ...thCell, width: '11%' }}>Form</th>
                  <th style={{ ...thCell, width: '19%' }}>Dose &amp; Frequency</th>
                  <th style={{ ...thCell, width: '24%' }}>Timing</th>
                  <th style={{ ...thCell, width: '14%' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {rx.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...cell, color: MUTED }}>{i + 1}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{m.name}</td>
                    <td style={cell}>{m.form || '—'}</td>
                    <td style={cell}>{m.dosage || '—'}</td>
                    <td style={cell}>{m.timing || '—'}</td>
                    <td style={cell}>{m.duration || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : ruled(3)}

          <div style={{ marginTop: 8 }}>
            <KvTable rows={[
              [['Pathya-Apathya', consult?.advice ? <span key="a" style={{ whiteSpace: 'pre-wrap' }}>{consult.advice}</span> : ruled(2)]],
              [['Follow-up Date', fmtDate(consult?.followUpDate)], ['AI Recommendation', p.recommendation]],
            ]} />
          </div>
        </Section>

        {/* 6 */}
        <Section n={6} title="Physician Signature, Registration & Official Stamp">
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, border: `1px solid ${RULE}`, padding: '8px 10px', fontSize: 11.5 }}>
              <div style={{ color: MUTED, fontSize: 10.5, fontWeight: 600 }}>Attending Physician Signature</div>
              <div style={{ height: 34, borderBottom: `1px solid ${INK}`, margin: '6px 0 4px' }} />
              <div style={{ fontWeight: 700 }}>{consult?.signedBy || 'Dr. Ananya Sharma, BAMS, MD (Ayurveda)'}</div>
            </div>
            <div style={{ flex: 1, border: `1px solid ${RULE}`, padding: '8px 10px', fontSize: 11.5 }}>
              <div style={{ color: MUTED, fontSize: 10.5, fontWeight: 600 }}>Registration No. &amp; Date</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>{consult?.regNo || 'AY-DL-88421'}</div>
              <div style={{ marginTop: 2 }}>{consult?.signedAt ? fmt(consult.signedAt) : '____ / ____ / ________'}</div>
              {consult?.signedAt && <div style={{ marginTop: 4, color: EMERALD, fontWeight: 700, fontSize: 10.5 }}>✓ Digitally finalised</div>}
            </div>
            <div style={{ width: 130, border: `1.5px dashed ${BRASS}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: BRASS, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: 6 }}>
              OFFICIAL STAMP<br />कार्यालय मुहर
            </div>
          </div>
          <div style={{ marginTop: 10, borderTop: `3px double ${EMERALD}`, paddingTop: 4, fontSize: 9.5, color: MUTED, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>Generated by AyushBridge MediKiosk AI · AI findings require physician verification &amp; dual sign-off.</span>
            <span>ABDM FHIR R4 Ready · DPDP Act 2023</span>
          </div>
        </Section>
      </div>
    </div>
  );
}
