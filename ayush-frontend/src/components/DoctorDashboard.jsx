import { useState, useEffect } from 'react';
import ClinicalBriefingModal from './ClinicalBriefingModal';
import PatientAdviceDrawer from './PatientAdviceDrawer';
import CaseReportModal from './CaseReportModal';

const API = '/api';

export default function DoctorDashboard({ latestPatient, onNavigate }) {
  const [patients, setPatients] = useState([]);
  const [zoomUrl, setZoomUrl] = useState('');
  const [zoomLoading, setZoomLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);
  const [showCaseReport, setShowCaseReport] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [openDocsId, setOpenDocsId] = useState(null);   // which patient card's docs accordion is open
  const [docModal, setDocModal] = useState(null);        // documents record shown in inspection modal

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(fetchPatients, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (latestPatient) setSelectedPatient(latestPatient);
  }, [latestPatient]);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API}/doctor/queue`);
      const data = await res.json();
      if (Array.isArray(data)) setPatients(data);
    } catch { /* ignore — keep last-known queue */ }
  };

  const PRIORITY_BADGE = {
    P1: 'bg-error-container text-on-error-container',
    P2: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    P3: 'bg-surface-container-high text-primary',
    P4: 'bg-surface-container-high text-tertiary',
  };

  const handleZoom = async (patient) => {
    setZoomLoading(true);
    try {
      const res = await fetch(`${API}/zoom/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'AYUSH Triage Consult', patientName: patient?.id || 'Patient' })
      });
      const data = await res.json();
      setZoomUrl(data.joinUrl);
      window.open(data.joinUrl, '_blank');
    } catch {
      setZoomUrl('https://zoom.us/j/demo');
    } finally {
      setZoomLoading(false);
    }
  };

  const openBriefing = (p) => { setSelectedPatient(p || latestPatient); setShowBriefing(true); };
  const openAdvice = (p) => { setSelectedPatient(p || latestPatient); setShowAdvice(true); };
  const openCaseReport = (p) => { setSelectedPatient(p || latestPatient); setShowCaseReport(true); };

  const counts = {
    P1: patients.filter(p => p.triageLevel === 'P1').length,
    P2: patients.filter(p => p.triageLevel === 'P2').length,
    P3: patients.filter(p => p.triageLevel === 'P3').length,
    P4: patients.filter(p => p.triageLevel === 'P4').length,
  };

  const totalDemo = 2 + 4 + 9 + 6;

  return (
    <>
      <div className="flex flex-col w-full">
        {/* Physician Subheader */}
        <section className="w-full px-4 lg:px-margin-desktop py-6 bg-surface-container-low">
          <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary overflow-hidden">
                  <span className="material-symbols-outlined text-primary text-[32px]">health_and_safety</span>
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full ring-2 ring-surface-container-lowest" title="Physician Active & Verified"></span>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-title-md text-title-md text-on-surface tracking-tight">Dr. Ananya Sharma, BAMS, MD (Ayurveda)</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">verified_user</span>
                    NAM Certified Tele-Clinician: AY-DL-88421
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-on-surface-variant font-label-md text-label-md">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                    <span className="w-2 h-2 rounded-full bg-primary -ml-3.5"></span>
                    <span>On-Duty OPD Triage Queue: <strong className="text-on-surface">Active ({totalDemo + patients.length} Enrolled Today)</strong></span>
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="inline-flex items-center gap-1 text-tertiary">
                    <span className="material-symbols-outlined text-[15px]">sync</span>
                    <span>ABDM M2 Gateway Synced • Updated 45s ago</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-3.5 py-2 rounded-xl bg-surface-container-lowest shadow-sm flex items-center gap-2 text-on-surface font-label-md text-label-md">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span>Accepting Walk-ins &amp; Rural e-Sanjeevani</span>
              </div>
              <button className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors flex items-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                <span>OPD Protocol Settings</span>
              </button>
              <button className="px-3.5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>Trigger Rapid Team Handoff</span>
              </button>
            </div>
          </div>
        </section>

        {/* Main Clinical Cockpit */}
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-margin-desktop py-8 flex flex-col gap-8">

          {/* P1–P4 Stat Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden bg-error-container/40 p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-error/15 text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">emergency</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm tracking-wider uppercase">P1 Critical</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-error">{2 + counts.P1}</span>
                  <span className="font-title-md text-title-md text-error">Patients</span>
                </div>
                <span className="font-label-md text-label-md text-on-error-container block font-semibold">Urgent Allopathic Transfer</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">Immediate tertiary allopathic referral required. Surgical/Cardiac red flags flagged by Sahayak AI.</p>
              </div>
            </div>
            <div className="relative overflow-hidden bg-secondary-fixed/50 p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">schedule</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm tracking-wider uppercase">P2 Urgent</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-secondary">{4 + counts.P2}</span>
                  <span className="font-title-md text-title-md text-secondary">Patients</span>
                </div>
                <span className="font-label-md text-label-md text-on-secondary-fixed font-semibold block">Severe Acute Aggravation</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">Severe acute aggravation (Pitta/Vata surge, severe pyrexia or active bleeding risk).</p>
              </div>
            </div>
            <div className="relative overflow-hidden bg-surface-container-high p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">local_florist</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm tracking-wider uppercase">P3 Stable</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-primary">{9 + counts.P3}</span>
                  <span className="font-title-md text-title-md text-primary">Patients</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold block">Chronic Integrative Care</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">Chronic disease follow-ups, metabolic / lifestyle integrative management.</p>
              </div>
            </div>
            <div className="relative overflow-hidden bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed-dim/30 text-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">spa</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm tracking-wider uppercase">P4 Routine</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-on-surface">{6 + counts.P4}</span>
                  <span className="font-title-md text-title-md text-on-surface">Patients</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold block">Shodhana &amp; Dinacharya</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">Preventive Dinacharya, Prakriti wellness counseling, Rasayana therapy.</p>
              </div>
            </div>
          </section>

          {/* AI Clinical Guardrail Banner */}
          <div className="rounded-2xl bg-surface-container-low p-4 pl-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary-container text-[20px]">smart_toy</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface">Autonomous Clinical Triage Co-Pilot (Ayush Sahayak v2.4)</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Multi-modal evaluation combining Charaka Samhita nidana parameters with ABDM HL7-FHIR red-flag alerts.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-on-surface-variant">Dual Sign-Off Required</span>
              <button className="text-primary font-label-md text-label-md hover:underline inline-flex items-center gap-1">
                <span>Safety Criteria</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </button>
            </div>
          </div>

          {/* Live Triage Queue — patient records from /api/doctor/queue */}
          {patients.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <span className="font-headline-sm text-headline-sm text-on-surface">Live Triage Queue</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">{patients.length} New Record{patients.length > 1 ? 's' : ''}</span>
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span> auto-refresh 10s
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {patients.map((p) => {
                  const docs = p.documents;
                  const ocr = docs?.ocrData;
                  const hasDocs = !!ocr;
                  const isOpen = openDocsId === p.id;
                  return (
                    <div key={p.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden ring-1 ring-surface-container-high">
                      {/* Card header: priority + demographics */}
                      <div className="p-4 flex items-start justify-between gap-3 border-b border-surface-container-high">
                        <div className="flex flex-col gap-1.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold w-fit ${PRIORITY_BADGE[p.triageLevel] || PRIORITY_BADGE.P3}`}>
                            {p.surgicalAlert && <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>}
                            {p.triageLevel} — {p.triageLabel}
                          </div>
                          <span className="font-title-md text-title-md text-on-surface font-semibold">{p.name}</span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {p.age !== 'N/A' ? `${p.age}` : '—'}{p.gender !== 'N/A' ? ` • ${p.gender}` : ''}{p.phone !== 'N/A' ? ` • 📱 ${p.phone}` : ''}
                          </span>
                        </div>
                        {hasDocs && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm shrink-0">
                            <span className="material-symbols-outlined text-[14px]">attach_file</span> Docs
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-4 flex flex-col gap-3">
                        <div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Chief Complaint</span>
                          <p className="font-body-md text-body-md text-on-surface font-medium">{p.chiefComplaint}</p>
                        </div>

                        {/* Ayurvedic assessment chips */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { l: 'Dosha', v: p.dosha, icon: 'balance' },
                            { l: 'Agni', v: p.agni || p.ayurvedicNotes?.agni, icon: 'local_fire_department' },
                            { l: 'Koshtha', v: p.koshtha || p.ayurvedicNotes?.koshtha, icon: 'gastroenterology' },
                          ].filter(x => x.v).map(x => (
                            <span key={x.l} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface font-label-sm text-label-sm">
                              <span className="material-symbols-outlined text-[14px] text-primary">{x.icon}</span>
                              <span className="text-on-surface-variant">{x.l}:</span> {x.v}
                            </span>
                          ))}
                        </div>

                        {p.redFlags && p.redFlags !== 'None' && (
                          <div className="inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-error-container/40 text-on-error-container font-label-sm text-label-sm w-fit">
                            <span className="material-symbols-outlined text-error text-[15px]">warning</span> {p.redFlags}
                          </div>
                        )}

                        {/* Meds / Labs */}
                        {(p.meds !== 'None' || p.labs !== 'None') && (
                          <div className="font-body-sm text-body-sm text-on-surface-variant">
                            {p.meds !== 'None' && <div><strong className="text-on-surface">Meds:</strong> {p.meds}</div>}
                            {p.labs !== 'None' && <div className="text-secondary"><strong>Labs:</strong> {p.labs}</div>}
                          </div>
                        )}

                        {/* Documents accordion */}
                        {hasDocs && (
                          <div className="rounded-xl bg-surface-container-low overflow-hidden">
                            <button
                              onClick={() => setOpenDocsId(isOpen ? null : p.id)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-surface-container transition-colors"
                            >
                              <span className="inline-flex items-center gap-2 font-label-md text-label-md text-on-surface">
                                <span className="material-symbols-outlined text-primary text-[18px]">folder_open</span>
                                Prescriptions &amp; Lab Reports
                                <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">{ocr.documentType || 'Document'}</span>
                              </span>
                              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {isOpen && (
                              <div className="px-3.5 pb-3.5 flex flex-col gap-3">
                                {ocr.medicines?.length > 0 && (
                                  <div className="flex flex-col gap-1.5">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Extracted Medicines</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {ocr.medicines.map((m, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-label-sm text-label-sm">
                                          <span className="material-symbols-outlined text-[13px]">medication</span>
                                          {m.name}{m.dosage ? ` — ${m.dosage}` : ''}
                                          {m.ayushCategory && m.ayushCategory !== 'Unknown' && (
                                            <span className="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] ml-0.5">{m.ayushCategory}</span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {ocr.abnormalLabValues?.length > 0 && (
                                  <div className="flex flex-col gap-1.5">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Abnormal Lab Values</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {ocr.abnormalLabValues.map((l, i) => (
                                        <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-sm text-label-sm ${
                                          l.flag === 'High' ? 'bg-error-container text-on-error-container' :
                                          l.flag === 'Low' ? 'bg-secondary-fixed text-on-secondary-fixed-variant' :
                                          'bg-secondary-container/40 text-on-secondary-container'
                                        }`}>
                                          <span className="material-symbols-outlined text-[13px]">science</span>
                                          {l.test}: {l.value} {l.flag && `(${l.flag})`}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {ocr.clinicalImpressions && (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Doctor Impression</span>
                                    <p className="font-body-sm text-body-sm text-on-surface">{ocr.clinicalImpressions}</p>
                                  </div>
                                )}
                                {docs.fileBase64 && (
                                  <button
                                    onClick={() => setDocModal(docs)}
                                    className="mt-1 self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm"
                                  >
                                    <span className="material-symbols-outlined text-primary text-[16px]">visibility</span>
                                    View Original Document
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button onClick={() => openBriefing(p)} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-1.5 shadow-sm transition-all">
                            <span className="material-symbols-outlined text-[16px]">clinical_notes</span> Briefing
                          </button>
                          <button onClick={() => handleZoom(p)} disabled={zoomLoading} className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-[15px]">videocam</span> {zoomLoading ? 'Creating…' : 'Zoom'}
                          </button>
                          <button onClick={() => openCaseReport(p)} className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-[15px]">description</span> Case Report
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Search & Filter */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
                <input className="w-full h-12 pl-11 pr-4 bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" placeholder="Search patient name, ABHA ID, or symptom..." type="text" />
              </div>
              <div className="relative shrink-0">
                <select className="appearance-none h-12 pl-4 pr-10 bg-surface-container-lowest rounded-xl font-label-md text-label-md text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                  <option>Urgency Score (Highest to Lowest) ▾</option>
                  <option>Wait Time (Longest to Shortest)</option>
                  <option>Prakriti Dominance (Vata ➔ Pitta ➔ Kapha)</option>
                  <option>ABDM Linked Status</option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">expand_more</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
              <button className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm transition-all flex items-center gap-1.5"><span>All ({totalDemo + patients.length})</span></button>
              <button className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-error-container/60 text-error font-label-md text-label-md transition-all flex items-center gap-1.5 shadow-sm"><span className="w-2 h-2 rounded-full bg-error"></span><span>Surgical Flags ({2 + counts.P1})</span></button>
              <button className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-secondary-fixed text-on-secondary-fixed-variant font-label-md text-label-md transition-all flex items-center gap-1.5 shadow-sm"><span className="w-2 h-2 rounded-full bg-secondary"></span><span>P2 Urgent ({4 + counts.P2})</span></button>
              <button className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-all flex items-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-[16px] text-primary">videocam</span><span>Zoom Ready (5)</span>
              </button>
            </div>
          </section>

          {/* Demo Queue Table */}
          <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface">Physician Triage Stream</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">Demo Queue: 5 Active Records</span>
              </div>
              <div className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span>Real-time Tele-OPD feed</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/40 text-on-surface-variant font-label-md text-label-md">
                    <th className="py-3.5 px-5 font-semibold">Priority</th>
                    <th className="py-3.5 px-5 font-semibold">Patient &amp; ABHA</th>
                    <th className="py-3.5 px-5 font-semibold">Chief Complaint</th>
                    <th className="py-3.5 px-5 font-semibold">Biomarkers</th>
                    <th className="py-3.5 px-5 font-semibold">Ayurvedic</th>
                    <th className="py-3.5 px-5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60">
                  {/* P1 Row */}
                  <tr className="hover:bg-error-container/10 transition-colors">
                    <td className="py-4 px-5 align-top">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                        <span className="w-2 h-2 rounded-full bg-error -ml-3.5"></span>
                        <span>P1 - Surgical Warning</span>
                      </div>
                      <div className="mt-2 text-error font-label-sm text-label-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">timer</span><span>Wait: 3 mins</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-title-md text-title-md text-on-surface">Rameshwar Prasad</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant block">54y Male • Gorakhpur</span>
                    </td>
                    <td className="py-4 px-5 align-top max-w-xs">
                      <p className="font-body-md text-body-md text-on-surface font-medium">Severe RLQ abdominal colic x 2 days, rebound tenderness, pyrexia.</p>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="px-2.5 py-1 rounded-lg bg-error text-on-error font-label-sm text-label-sm flex items-center gap-1 w-fit shadow-xs mb-1">
                        <span className="material-symbols-outlined text-[15px]">priority_high</span>Appendicitis Suspicion
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface font-label-sm text-label-sm w-fit block">WBC: 16,500/uL</span>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">Pittaja Vidradhi</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm w-fit block mt-1">Pitta-Vata Dushti</span>
                    </td>
                    <td className="py-4 px-5 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => openBriefing(null)} className="px-3 py-2 rounded-xl bg-error text-on-error hover:bg-error-container hover:text-on-error-container font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm transition-all">
                          <span className="material-symbols-outlined text-[16px]">local_hospital</span><span>Refer Emergency</span>
                        </button>
                        <button onClick={() => openCaseReport(null)} className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors">
                          <span className="material-symbols-outlined text-[15px]">description</span><span>Case Summary</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* P2 Row */}
                  <tr className="hover:bg-secondary-fixed/20 transition-colors">
                    <td className="py-4 px-5 align-top">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-secondary"></span>
                        <span>🟠 P2 - Urgent Review</span>
                      </div>
                      <div className="mt-2 text-secondary font-label-sm text-label-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">timer</span><span>Wait: 11 mins</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-title-md text-title-md text-on-surface">Sunita Devi</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant block">42y Female • Varanasi</span>
                    </td>
                    <td className="py-4 px-5 align-top max-w-xs">
                      <p className="font-body-md text-body-md text-on-surface font-medium">Severe uncontrolled hypertension, epistaxis, throbbing Shirashoola.</p>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="px-2.5 py-1 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm flex items-center gap-1 w-fit mb-1">
                        <span className="material-symbols-outlined text-[15px]">blood_pressure</span>BP: 172/106 mmHg
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-error-container text-on-error-container font-label-sm text-label-sm w-fit block font-medium">Herb-Drug Alert</span>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">Rakta-Pitta Prakopa</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm w-fit block mt-1">Pitta-Pradhana Vata</span>
                    </td>
                    <td className="py-4 px-5 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => openBriefing(null)} className="px-3 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm transition-all">
                          <span className="material-symbols-outlined text-[16px]">clinical_notes</span><span>Clinical Briefing</span>
                        </button>
                        <button onClick={() => handleZoom(null)} className="px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary font-label-sm text-label-sm flex items-center gap-1 transition-colors" disabled={zoomLoading}>
                          <span className="material-symbols-outlined text-[15px]">videocam</span>
                          <span>{zoomLoading ? 'Creating...' : 'Generate Zoom Consult'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* P3 Row */}
                  <tr className="hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-5 align-top">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        <span>🟡 P3 - Moderate Care</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-title-md text-title-md text-on-surface">Mohd. Farooq Akhtar</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant block">61y Male • Lucknow</span>
                    </td>
                    <td className="py-4 px-5 align-top max-w-xs">
                      <p className="font-body-md text-body-md text-on-surface font-medium">Chronic Type 2 Prameha, bilateral peripheral tingling, Mandagni.</p>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 w-fit">HbA1c: 9.2%</span>
                      <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-label-sm text-label-sm w-fit block mt-1">Metformin 1000mg + Nishamalaki</span>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">Kapha-Medoroga</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm w-fit block mt-1">Kapha-Vataja Dushti</span>
                    </td>
                    <td className="py-4 px-5 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => handleZoom(null)} className="px-3.5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm transition-all" disabled={zoomLoading}>
                          <span className="material-symbols-outlined text-[16px]">videocam</span>
                          <span>{zoomLoading ? 'Creating...' : 'Launch Teleconsult'}</span>
                        </button>
                        <button onClick={() => openAdvice(null)} className="px-3 py-1 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-sm text-label-sm transition-colors">
                          <span>Patient Advice</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span>Showing <strong>3 of {totalDemo + patients.length}</strong> scheduled tele-triage encounters</span>
                <span className="text-outline-variant">•</span>
                <span className="text-tertiary">Auto-refresh every 15 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm opacity-60 cursor-not-allowed">Previous</button>
                <span className="px-3 py-1 font-label-sm text-label-sm font-semibold text-primary">Page 1 of 5</span>
                <button className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm hover:bg-surface-container transition-colors">Next</button>
              </div>
            </div>
          </div>

          {/* Zoom URL Display */}
          {zoomUrl && (
            <div className="rounded-2xl bg-primary-fixed/30 p-4 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[24px]">videocam</span>
                <div>
                  <span className="font-label-md text-label-md text-on-surface font-semibold block">Zoom Meeting Created</span>
                  <a href={zoomUrl} target="_blank" rel="noreferrer" className="font-body-sm text-body-sm text-primary hover:underline break-all">{zoomUrl}</a>
                </div>
              </div>
              <a href={zoomUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                <span>Join Now</span>
              </a>
            </div>
          )}

          {/* Safety Guardrail Bar */}
          <section className="rounded-2xl bg-surface-container-high p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-start gap-3.5 max-w-3xl">
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[22px]">policy</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-on-surface">National AYUSH Integrative Safety Guardrail</span>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
                  The National Pharmacopoeia &amp; AI Triage Engine automatically cross-analyzes herb-drug interaction alerts and flags acute surgical abdomen presentations.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button className="px-4 py-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 shadow-sm transition-all">
                <span className="material-symbols-outlined text-primary text-[18px]">picture_as_pdf</span>
                <span>Export Shift Report (PDF)</span>
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-2 shadow-sm transition-all">
                <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
                <span>Transfer to e-Sanjeevani</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      <ClinicalBriefingModal
        isOpen={showBriefing}
        onClose={() => setShowBriefing(false)}
        patient={selectedPatient}
        onZoom={() => handleZoom(selectedPatient)}
      />
      <PatientAdviceDrawer
        isOpen={showAdvice}
        onClose={() => setShowAdvice(false)}
        patientData={selectedPatient}
      />
      <CaseReportModal
        isOpen={showCaseReport}
        onClose={() => setShowCaseReport(false)}
        patient={selectedPatient}
      />

      {/* Document Inspection Modal */}
      {docModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDocModal(null)}>
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-container-high bg-surface-container-low">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">description</span>
                <div>
                  <h3 className="font-title-md text-title-md text-on-surface font-semibold">{docModal.fileName || 'Original Document'}</h3>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{docModal.ocrData?.documentType || 'Uploaded via mobile scan'}</p>
                </div>
              </div>
              <button onClick={() => setDocModal(null)} className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 overflow-auto bg-surface/40 flex items-center justify-center">
              {docModal.mimeType?.startsWith('image/') ? (
                <img src={docModal.fileBase64} alt="original document" className="max-w-full max-h-[70vh] rounded-xl shadow-sm object-contain" />
              ) : docModal.mimeType === 'application/pdf' ? (
                <iframe src={docModal.fileBase64} title="original document" className="w-full h-[70vh] rounded-xl bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[48px]">draft</span>
                  <p className="font-body-md text-body-md">Preview unavailable for this file type.</p>
                  <a href={docModal.fileBase64} download={docModal.fileName} className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md">Download</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
