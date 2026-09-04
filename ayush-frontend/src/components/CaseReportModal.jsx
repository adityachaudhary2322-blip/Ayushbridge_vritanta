import { useState } from 'react';

export default function CaseReportModal({ isOpen, onClose, patient }) {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState('');

  if (!isOpen) return null;

  const handleExport = (format) => {
    setExportLoading(true);
    setExportDone('');
    setTimeout(() => {
      setExportLoading(false);
      setExportDone(`${format} export initiated. Download will begin shortly.`);
    }, 1800);
  };

  const triageColor = {
    P1: 'bg-error text-on-error',
    P2: 'bg-secondary text-on-secondary',
    P3: 'bg-primary text-on-primary',
    P4: 'bg-tertiary text-on-tertiary',
  }[patient?.triageLevel] || 'bg-primary text-on-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-inverse-surface/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-[1200px] my-auto bg-surface-container-lowest rounded-2xl shadow-[0_20px_50px_-12px_rgba(25,45,35,0.28)] flex flex-col overflow-hidden max-h-[94vh]" role="dialog" aria-modal="true">

        {/* Modal Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight">AYUSH Integrated Case Report</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">ABDM-Certified Tele-Health Documentation — National AYUSH Mission</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors shadow-sm" onClick={() => handleExport('PDF')}>
              <span className="material-symbols-outlined text-secondary text-[18px]">picture_as_pdf</span>
              <span>Export PDF</span>
            </button>
            <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors shadow-sm" onClick={() => handleExport('FHIR/HL7')}>
              <span className="material-symbols-outlined text-tertiary text-[18px]">cloud_upload</span>
              <span>Push ABDM</span>
            </button>
            <button className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" onClick={onClose}>
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Body: Two-pane layout */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

          {/* Left: A4 Document Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface-container/40">
            <div className="max-w-[794px] mx-auto bg-surface-container-lowest rounded-2xl shadow-[0_2px_20px_rgba(25,45,35,0.12)] p-8 sm:p-12 flex flex-col gap-7">

              {/* Document Header */}
              <div className="flex flex-col items-center text-center gap-2 pb-5 border-b border-surface-container-high">
                <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-1">
                  <span className="material-symbols-outlined text-[30px] text-primary">local_hospital</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">AYUSH INTEGRATED CASE REPORT</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">National Commission for Indian System of Medicine (NCISM) — Tele-Health Module v2.1</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Ministry of AYUSH, Government of India | ABDM Compliant | HL7 FHIR R4</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-mono">Doc Ref: AY-GKP-CR-20240523-8821</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-mono">SHA-256: 4f8b2c...92e1af</span>
                </div>
              </div>

              {/* Patient Demographics */}
              <section className="flex flex-col gap-3">
                <h3 className="font-label-lg text-label-lg uppercase tracking-widest text-primary border-b border-surface-container pb-1.5">Section I: Patient Identification</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                  {[
                    ['Full Name', patient?.name || 'Sunil Kumar'],
                    ['ABHA Number', '91-8429-1092-4410'],
                    ['Age / Sex', '54 years / Male'],
                    ['Language', 'Hindi / हिन्दी'],
                    ['District / State', 'Gorakhpur, Uttar Pradesh'],
                    ['Kendra Node', 'Gorakhpur Tele-Health Node #14'],
                    ['Consult Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                    ['Triage Token', 'AY-GKP-8821'],
                    ['Triage Level', patient?.triageLevel || 'P1'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">{label}</span>
                      <span className="font-body-md text-body-md text-on-surface font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chief Complaint + Triage */}
              <section className="flex flex-col gap-3">
                <h3 className="font-label-lg text-label-lg uppercase tracking-widest text-primary border-b border-surface-container pb-1.5">Section II: Chief Complaint &amp; AI Triage</h3>
                <div className={`rounded-xl p-4 flex items-start gap-3 ${triageColor}`}>
                  <span className="material-symbols-outlined text-[22px] shrink-0">emergency</span>
                  <div>
                    <div className="font-label-lg text-label-lg font-bold">{patient?.triageLevel || 'P1'} — {patient?.triageLabel || 'Surgical Emergency'}</div>
                    <div className="font-body-sm text-body-sm mt-0.5 opacity-90">{patient?.chiefComplaint || 'Acute right iliac fossa pain with rebound tenderness, suspected acute appendicitis.'}</div>
                  </div>
                </div>
                {patient?.surgicalAlert && (
                  <div className="rounded-xl bg-error-container/30 p-3 flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                    <strong>Surgical Alert:</strong> Immediate allopathic ER escalation required.
                  </div>
                )}
                {patient?.geneticAlert && (
                  <div className="rounded-xl bg-secondary-fixed/30 p-3 flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-secondary text-[18px]">genetics</span>
                    <strong>Genetic Alert:</strong> Family history warrants hereditary risk screening.
                  </div>
                )}
              </section>

              {/* Ayurvedic Rogapariksha */}
              <section className="flex flex-col gap-3">
                <h3 className="font-label-lg text-label-lg uppercase tracking-widest text-primary border-b border-surface-container pb-1.5">Section III: Rogapariksha (Ayurvedic Clinical Examination)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Agni (Digestive Fire)</span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold">{patient?.ayurvedicNotes?.agni || 'Vishamagni (विषमाग्नि) — Irregular'}</span>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Koshtha (Bowel Constitution)</span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold">{patient?.ayurvedicNotes?.koshtha || 'Krura Koshtha (क्रूर कोष्ठ) — Hard'}</span>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Prakriti</span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold">Pitta-Kapha (पित्त-कफ)</span>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Vikriti</span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold">Vata-Pitta Dushti (वात-पित्त दुष्टि)</span>
                  </div>
                  <div className="sm:col-span-2 bg-surface-container rounded-xl p-3.5 flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Nidana (Disease Root Cause)</span>
                    <span className="font-body-md text-body-md text-on-surface">Ama accumulation in pakwashaya (large intestine), aggravated Vata, leading to acute inflammatory Shula (शूल).</span>
                  </div>
                </div>
              </section>

              {/* Lab & Meds */}
              <section className="flex flex-col gap-3">
                <h3 className="font-label-lg text-label-lg uppercase tracking-widest text-primary border-b border-surface-container pb-1.5">Section IV: Biomarkers &amp; Pharmacological History</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Current Medications (from OCR)</span>
                    {(patient?.meds || 'Metformin 500mg BD, Atorvastatin 20mg OD').split(',').map((m, i) => (
                      <span key={i} className="font-body-sm text-body-sm text-on-surface font-medium">{i + 1}. {m.trim()}</span>
                    ))}
                  </div>
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Abnormal Lab Values</span>
                    {(patient?.labs || 'HbA1c 8.9% (HIGH), WBC 16800/µL (HIGH)').split(',').map((l, i) => (
                      <span key={i} className="font-body-sm text-body-sm text-error font-semibold">{l.trim()}</span>
                    ))}
                  </div>
                </div>
              </section>

              {/* AI Recommendation */}
              <section className="flex flex-col gap-3">
                <h3 className="font-label-lg text-label-lg uppercase tracking-widest text-primary border-b border-surface-container pb-1.5">Section V: AYUSH AI Clinical Recommendation</h3>
                <div className="bg-surface-container rounded-xl p-4 font-body-md text-body-md text-on-surface leading-relaxed">
                  {patient?.recommendation || 'Immediate surgical referral for appendicitis workup. Suspend all oral Ayurvedic medications pending surgical clearance. Post-operative Rasayana therapy (Guduchi, Amalaki) advised for recovery support. Follow-up Agni correction with Chitrakadi Vati post-discharge.'}
                </div>
              </section>

              {/* Signature Block */}
              <div className="border-t border-surface-container pt-6 flex flex-col sm:flex-row items-start justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Triage Physician (Digital Signature)</span>
                  <span className="font-body-md text-body-md text-on-surface font-semibold italic">Dr. Ananya Joshi, MD (Ay.)</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Reg. No: CCIM-UP-28812</span>
                  <div className="mt-2 h-px w-40 bg-on-surface"></div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-20 h-20 rounded-lg bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant">qr_code_2</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant text-right">Scan to verify on<br />ABDM Health Stack</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Export Sidebar */}
          <div className="w-full lg:w-72 xl:w-80 bg-surface-container-low border-t lg:border-t-0 lg:border-l border-surface-container-high p-5 flex flex-col gap-5 overflow-y-auto">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">Export &amp; Share</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Certified for ABDM Health Locker and HL7 FHIR R4 push.</p>
            </div>

            {exportDone && (
              <div className="rounded-xl bg-surface-container p-3 flex items-start gap-2 font-body-sm text-body-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">check_circle</span>
                <span>{exportDone}</span>
              </div>
            )}

            {exportLoading && (
              <div className="rounded-xl bg-surface-container p-3 flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Preparing export...</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {[
                { label: 'Download PDF (A4)', icon: 'picture_as_pdf', color: 'text-secondary', format: 'PDF' },
                { label: 'Push to ABDM Health Locker', icon: 'cloud_upload', color: 'text-primary', format: 'ABDM' },
                { label: 'Export FHIR/HL7 Bundle', icon: 'data_object', color: 'text-tertiary', format: 'FHIR/HL7' },
                { label: 'Send via Digilocker', icon: 'folder_shared', color: 'text-secondary', format: 'Digilocker' },
              ].map(({ label, icon, color, format }) => (
                <button
                  key={format}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors shadow-sm text-left"
                  onClick={() => handleExport(format)}
                  disabled={exportLoading}
                >
                  <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="mt-1 rounded-xl bg-surface-container-lowest p-4 flex flex-col gap-2.5">
              <h4 className="font-label-md text-label-md text-on-surface font-semibold">Document Metadata</h4>
              {[
                ['Version', 'v2.1.4-stable'],
                ['Standard', 'FHIR R4 / HL7'],
                ['Jurisdiction', 'India (ABDM)'],
                ['Language', 'EN + HI'],
                ['Consent', 'CONS-AY-77291-B'],
                ['Integrity', 'SHA-256 signed'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
                  <span>{k}:</span>
                  <span className="font-medium text-on-surface font-mono text-[11px]">{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-surface-container p-3.5 flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface-variant mt-auto">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">verified_user</span>
              <span>This document is digitally signed and tamper-evident under ABDM Health Data Management Policy 2020.</span>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors shadow-sm"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Close Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
