import { useState } from 'react';

export default function ClinicalBriefingModal({ isOpen, onClose, patient, onZoom }) {
  const [toastMsg, setToastMsg] = useState('');
  const [toastIcon, setToastIcon] = useState('info');

  if (!isOpen) return null;

  const showToast = (msg, icon = 'info') => {
    setToastMsg(msg);
    setToastIcon(icon);
    setTimeout(() => setToastMsg(''), 4500);
  };

  const isSurgical = patient?.surgicalAlert || true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-inverse-surface/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-[1100px] my-auto bg-surface-container-lowest rounded-2xl shadow-[0_20px_50px_-12px_rgba(25,45,35,0.28)] flex flex-col overflow-hidden max-h-[92vh]" role="dialog" aria-modal="true">

        {/* Modal Header */}
        <div className="bg-surface-container-low px-6 py-5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                {patient?.id ? `Patient ${patient.id}` : 'Sunil Kumar'}
                <span className="font-body-md text-body-md text-on-surface-variant font-normal">54y M</span>
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">verified</span>ABHA Verified
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">translate</span>Bilingual: Hindi / English
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">schedule</span>Wait Time: 4 mins
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface-variant font-body-sm text-body-sm">
              <span className="font-mono tracking-tight font-medium text-on-surface">ABHA: 91-8429-1092-4410</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                Gorakhpur Kendra (UP) — Rural Tele-Health Node #14
              </span>
              <span>•</span>
              <span className="text-tertiary font-label-md text-label-md">Triage Token: AY-GKP-8821</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors shadow-sm" onClick={() => showToast('Compiling ABDM certified e-Case Sheet PDF...', 'download')}>
              <span className="material-symbols-outlined text-secondary text-[18px]">picture_as_pdf</span>
              <span className="hidden sm:inline">Download Case PDF</span>
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-all" onClick={() => { onZoom?.(); showToast('Launching secure AYUSH Tele-Consultation Zoom Room...', 'videocam'); }}>
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              <span>Launch Zoom Meeting</span>
            </button>
            <button className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors ml-1" onClick={onClose}>
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">

          {/* P1 Surgical Alert */}
          {isSurgical && (
            <div className="rounded-xl bg-error-container/40 p-4 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-label-lg text-label-lg tracking-wider uppercase font-bold text-on-error-container">
                      ⚠️ URGENT ALLOPATHIC SURGICAL ESCALATION REQUIRED
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm uppercase tracking-wide">P1_EMERGENCY: TRUE</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface leading-relaxed max-w-3xl">
                    Clinical indicators consistent with <strong>Acute Appendicitis</strong> (Right lower quadrant McBurney point rebound tenderness + marked leukocytosis 16,800/µL, Temp 101.4°F). <span className="text-error font-semibold">Herbal oral therapies and Panchakarma are strictly contraindicated.</span> Immediate urgent ultrasound (USG Abdomen) and direct transfer to general surgery ER required.
                  </p>
                  {patient?.chiefComplaint && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1"><strong>AI Assessment:</strong> {patient.chiefComplaint}</p>
                  )}
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error text-on-error font-label-md text-label-md hover:bg-on-error-container transition-colors shadow-sm whitespace-nowrap shrink-0 self-end sm:self-center" onClick={() => showToast('Initiating 108 Emergency Medical Response Protocol & USG requisition.', 'emergency_share')}>
                <span className="material-symbols-outlined text-[18px]">emergency_share</span>
                <span>108 Dispatch / ER Protocol</span>
              </button>
            </div>
          )}

          {/* Genetic Alert */}
          {patient?.geneticAlert && (
            <div className="rounded-xl bg-secondary-fixed/35 p-4 flex items-start gap-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">genetics</span>
              </div>
              <div className="flex flex-col gap-1 w-full">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Hereditary &amp; Familial Susceptibility (Kula-ja Vikara / कुलज विकार)</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">Genetic risk markers detected. Recommend formal genetic screening and proactive cardiovascular / metabolic assessment.</p>
              </div>
            </div>
          )}

          {/* Three-Column Clinical Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Allopathic History */}
            <div className="bg-surface-container-low/70 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Allopathic History</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-mono">OCR Synced</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Active Medications (Rx)</span>
                <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col gap-2">
                  {(patient?.meds || 'Metformin HCl 500mg BD, Atorvastatin 20mg OD').split(',').map((med, i) => (
                    <div key={i} className="flex items-center justify-between font-body-sm text-body-sm">
                      <span className="font-semibold text-on-surface">{med.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Abnormal Biomarkers</span>
                <div className="flex flex-col gap-1.5">
                  {(patient?.labs || 'HbA1c 8.9% (HIGH), WBC 16,800/µL').split(',').map((lab, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-error-container/30 text-on-error-container font-body-sm text-body-sm">
                      <span className="font-semibold">{lab.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 flex items-center justify-around text-center">
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">Blood Pressure</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">142/88</span>
                  <span className="font-label-sm text-label-sm text-secondary block">Stage 1 HTN</span>
                </div>
                <div className="h-8 w-px bg-surface-container-high"></div>
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">SpO2 / Temp</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">97%</span>
                  <span className="font-label-sm text-label-sm text-error block">101.4°F</span>
                </div>
              </div>
            </div>

            {/* Ayurvedic Assessment */}
            <div className="bg-surface-container-low/70 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">spa</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Rogapariksha (रोगपरीक्षा)</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">Ayush AI Co-pilot</span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3.5 flex flex-col gap-2.5">
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Agni (Digestive Fire)</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{patient?.ayurvedicNotes?.agni || 'Vishamagni (विषमाग्नि)'}</span>
                </div>
                <div className="h-px w-full bg-surface-container"></div>
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Koshtha (Bowel Habit)</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{patient?.ayurvedicNotes?.koshtha || 'Krura Koshtha (क्रूर कोष्ठ)'}</span>
                </div>
                <div className="h-px w-full bg-surface-container"></div>
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Nidra (Sleep Pattern)</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Alpanidra (अल्पनिद्रा)</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Constitutional Matrix</span>
                <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface-variant">Prakriti Baseline:</span>
                    <span className="font-semibold text-primary">Pitta-Kapha (60:40)</span>
                  </div>
                  <div className="flex items-center justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface-variant">Vikriti Pathological:</span>
                    <span className="font-semibold text-secondary">Vata-Pitta Dushti</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                    <div className="bg-secondary w-1/2 h-full" title="Vata Spike"></div>
                    <div className="bg-primary w-1/3 h-full" title="Pitta Inflammatory"></div>
                    <div className="bg-surface-container-high w-1/6 h-full" title="Kapha Depleted"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Herb-Drug Safety */}
            <div className="bg-surface-container-low/70 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-[20px]">shield_with_heart</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">AYUSH Pharmacopoeia Guard</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">Safety Protocol</span>
              </div>
              <div className="rounded-xl bg-secondary-fixed/50 p-3.5 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-2 text-on-secondary-fixed font-label-md text-label-md font-bold">
                  <span className="material-symbols-outlined text-[18px]">report_problem</span>
                  <span>Active Drug-Herb Antagonism Alert</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-secondary-container leading-relaxed">
                  <strong>Contraindicated:</strong> High-dose <em>Commiphora mukul</em> (Guggulu) and concentrated Garlic extract must NOT be initiated with active <strong>Aspirin 75mg</strong> regimen due to synergistic COX-1 inhibition and hemorrhagic risk.
                </p>
              </div>
              <div className="rounded-xl bg-error-container/30 p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-error font-label-md text-label-md font-semibold">
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  <span>Strict Panchakarma Contraindication</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface">Shodhana contraindicated in acute peritoneal irritation and febrile surgical abdomen.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Permissible Adjuncts (Post-Clearance)</span>
                <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col gap-2">
                  {[['Guduchi Ghana Vati', 'Safe with Metformin'],['Amalaki Rasayana', 'Non-antiplatelet'],['Bilva Shoshana Kwath','Pitta Shaman']].map(([herb, note]) => (
                    <div key={herb} className="flex items-center justify-between font-body-sm text-body-sm">
                      <span className="font-semibold text-primary">{herb}</span>
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
              {patient?.recommendation && (
                <div className="p-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm">
                  <strong>AI Recommendation:</strong> {patient.recommendation}
                </div>
              )}
            </div>
          </div>

          {/* Triage Physician Note */}
          <div className="rounded-xl bg-surface-container p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">quick_reference_all</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">Triage Physician Note (Dr. Ananya Joshi, MD Ayur):</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  "Patient walked into Gorakhpur Kendra with acute 6-hour abdominal pain radiating to RIF. Vitals and palpation suggest acute appendicular inflammation. Halt all oral decoctions. Immediate allopathic ER transfer priority."
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest text-on-surface-variant font-mono text-[11px] shrink-0">SHA-256: 4f8b...92e1</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-surface-container-low px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant font-body-sm text-body-sm">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
              <span>ABDM Consent: <strong>CONS-AY-77291-B</strong></span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
              <span>Session Encrypted (256-bit)</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-error text-on-error font-label-md text-label-md shadow-md hover:bg-on-error-container transition-all" onClick={() => showToast('Urgent Transfer to District Hospital ER triggered via ABDM M2 gateway.', 'local_hospital')}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-error opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-surface-container-lowest"></span>
              </span>
              <span>Transfer to Allopathic ER</span>
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors shadow-sm" onClick={() => showToast('Conditional Ayush regimen saved. Awaiting surgical clearance.', 'checklist')}>
              <span className="material-symbols-outlined text-primary text-[18px]">clinical_notes</span>
              <span>Approve Ayush (Conditional)</span>
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-md transition-all" onClick={() => { onZoom?.(); showToast('Launching secure AYUSH Tele-Consultation Zoom Room...', 'videocam'); }}>
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              <span>Launch One-Click Zoom Meeting</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-inverse-surface text-inverse-on-surface px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 font-body-sm text-body-sm transition-all">
          <span className="material-symbols-outlined text-[20px] text-primary-fixed">{toastIcon}</span>
          <span className="font-label-md text-label-md">{toastMsg}</span>
          <button className="ml-2 text-inverse-on-surface/70 hover:text-inverse-on-surface" onClick={() => setToastMsg('')}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
