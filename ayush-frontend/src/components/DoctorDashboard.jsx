import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicalBriefingModal from './ClinicalBriefingModal';
import PatientAdviceDrawer from './PatientAdviceDrawer';
import CaseReportModal from './CaseReportModal';
import CaseHistorySheet from './CaseHistorySheet';
import DiagnosisRxPanel from './DiagnosisRxPanel';
import DiseaseTimeline from './DiseaseTimeline';
import AyushAssessmentCard from './AyushAssessmentCard';
import { assessmentOf, aiAssessmentOf } from '../utils/ayushPillars';
import { normalizeClinicalDocs, flagStyle, docTypeLabel, docTime } from '../utils/clinicalDocs';
import { patientToken } from '../utils/consultation';
import { BrandMark, OfficialStrip, ThemeToggle } from './Brand';

const API = '/api';

// Ruby / brass / stone / sage — one urgency language for the queue and the banner.
const PRIORITY = {
  P1: { label: 'P1 Critical', badge: 'bg-rose-700/90 text-white ring-1 ring-rose-500/60', bar: 'bg-rose-500' },
  P2: { label: 'P2 Urgent', badge: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-600/50', bar: 'bg-amber-500' },
  P3: { label: 'P3 Moderate', badge: 'bg-stone-700/50 text-stone-300 ring-1 ring-stone-600/60', bar: 'bg-stone-500' },
  P4: { label: 'P4 Routine', badge: 'bg-emerald-600/15 text-emerald-400 ring-1 ring-emerald-600/30', bar: 'bg-emerald-600' },
};
const priorityOf = (p) => PRIORITY[p?.triageLevel] || PRIORITY.P3;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'p1', label: 'Emergency P1' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'consulted', label: 'Consulted' },
];

const clean = (v) => (v && v !== 'N/A' && v !== 'None' ? v : '');

function waitLabel(ts, now) {
  const mins = Math.max(0, Math.round((now - new Date(ts).getTime()) / 60000));
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d`;
}

function fmtTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(ts); }
}

function intakeChannels(p, hasDocs) {
  const src = String(p.triageSource || '').toLowerCase();
  return [
    /sign/.test(src) && { icon: '🤟', title: 'Divyang Sign-Bridge intake' },
    /telephon|call/.test(src) && { icon: '📞', title: 'Telephony voice consultation' },
    /voice|kiosk/.test(src) && !/sign/.test(src) && { icon: '🗣️', title: 'Voice AI kiosk intake' },
    hasDocs && { icon: '📄', title: 'Scanned documents attached' },
  ].filter(Boolean);
}

function MetricPill({ icon, label, value, tone = 'stone', pulse = false }) {
  const tones = {
    stone: 'border-stone-700 text-stone-300',
    amber: 'border-amber-600/40 text-amber-400',
    rose: 'border-rose-600/50 text-rose-300 bg-rose-950/40',
    sage: 'border-emerald-600/30 text-emerald-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs whitespace-nowrap ${tones[tone]}`}>
      {pulse && value > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
      <span aria-hidden="true">{icon}</span>
      <span className="text-stone-400">{label}</span>
      <strong className="tabular-nums text-stone-100">{value}</strong>
    </span>
  );
}

function ModuleCard({ title, icon, children, action }) {
  return (
    <section className="h-full card-surface rounded-xl bg-stone-900/90 border border-stone-800 p-3.5 flex flex-col gap-3 min-w-0">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px]">{icon}</span>{title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const [zoomUrl, setZoomUrl] = useState('');
  const [zoomLoading, setZoomLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);
  const [showCaseReport, setShowCaseReport] = useState(false);
  const [docModal, setDocModal] = useState(null);        // { fileBase64, mimeType, fileName, title }
  const [caseSheet, setCaseSheet] = useState(null);      // patient record shown in printable A4 case sheet
  const [autoPdf, setAutoPdf] = useState(false);         // open the sheet and export straight away
  const [consults, setConsults] = useState({});          // id → signed consultation, mirrored locally for instant print
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [cardError, setCardError] = useState({});        // id → last upload/delete error
  const [assessments, setAssessments] = useState({});    // id → physician-edited { dosha, agni, koshtha }
  const [rxDrafts, setRxDrafts] = useState({});          // id → unsaved Rx form, kept across queue switches

  const fetchPatients = useCallback(async () => {
    let data = null;
    try {
      const res = await fetch(`${API}/doctor/queue`);
      data = await res.json();
    } catch { /* keep last-known queue */ }
    if (Array.isArray(data)) setPatients(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // fetchPatients only sets state after its network await, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPatients();
    const poll = setInterval(fetchPatients, 10000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [fetchPatients]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchPatients();
    setNow(Date.now());
    setRefreshing(false);
  };

  const isConsulted = useCallback(
    (p) => ['COMPLETED', 'CONSULTED'].includes(p.status) || !!consults[p.id],
    [consults],
  );

  const metrics = useMemo(() => ({
    total: patients.length,
    waiting: patients.filter(p => !isConsulted(p)).length,
    p1: patients.filter(p => p.triageLevel === 'P1').length,
    consulted: patients.filter(isConsulted).length,
  }), [patients, isConsulted]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter(p => {
      if (filter === 'p1' && p.triageLevel !== 'P1') return false;
      if (filter === 'waiting' && isConsulted(p)) return false;
      if (filter === 'consulted' && !isConsulted(p)) return false;
      if (!q) return true;
      return [p.name, patientToken(p), p.chiefComplaint, p.phone].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [patients, search, filter, isConsulted]);

  // The selection survives polling; if the selected record disappears, fall back to the queue head.
  const active = patients.find(p => p.id === selectedId) || queue[0] || null;

  // The physician's on-screen pillar edits win over the stored AI read, so the Rx
  // save and the A4 sheet both carry exactly what the doctor sees.
  const assessmentFor = (p) => assessments[p.id] || assessmentOf(p);
  const withConsult = (p) => (p ? {
    ...p,
    ...assessmentFor(p),
    aiAssessment: aiAssessmentOf(p),
    consultation: consults[p.id] || p.consultation,
  } : p);

  const setErrorFor = (id, msg) => setCardError(prev => ({ ...prev, [id]: msg }));

  const handleDelete = async (p) => {
    if (!window.confirm('Are you sure you want to permanently delete this patient record?')) return;
    setDeletingId(p.id);
    setErrorFor(p.id, '');
    try {
      const res = await fetch(`${API}/patients/${encodeURIComponent(patientToken(p))}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      setPatients(prev => prev.filter(x => x.id !== p.id));
      setSelectedId(null);
    } catch (err) {
      setErrorFor(p.id, `Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Physician attaches a prescription / lab report to an existing record.
  const handleUpload = async (p, file) => {
    if (!file) return;
    setUploadingId(p.id);
    setErrorFor(p.id, '');
    try {
      const fd = new FormData();
      fd.append('document', file);
      const res = await fetch(`${API}/patients/${encodeURIComponent(patientToken(p))}/documents`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.record) throw new Error(data.error || `HTTP ${res.status}`);
      setPatients(prev => prev.map(x => (x.id === p.id ? data.record : x)));
    } catch (err) {
      setErrorFor(p.id, `Upload failed: ${err.message}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleZoom = async (p) => {
    setZoomLoading(true);
    try {
      const res = await fetch(`${API}/zoom/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'AYUSH Triage Consult', patientName: p?.name || 'Patient' }),
      });
      const data = await res.json();
      setZoomUrl(data.joinUrl);
      window.open(data.joinUrl, '_blank', 'noopener');
    } catch {
      setZoomUrl('');
    } finally {
      setZoomLoading(false);
    }
  };

  const today = new Date(now);

  return (
    <div className="min-h-screen lg:h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* ── A. Institutional top bar ─────────────────────────────────────────── */}
      <header className="sticky lg:static top-0 z-30 shrink-0 bg-stone-950/85 backdrop-blur-md">
        <OfficialStrip />
        <div className="border-b border-stone-800 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} title="Portal home" className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
              <BrandMark compact />
            </button>
            <span className="hidden sm:block w-px h-8 bg-stone-800" aria-hidden="true" />
            <div className="leading-tight min-w-0">
              <p className="font-serif text-[15px] text-stone-100 truncate">राष्ट्रीय आयुर्वेद संस्थान <span className="text-stone-500">/</span> National AYUSH OPD Portal</p>
              <p className="text-[11px] text-stone-400">Station ID: <span className="text-amber-500 font-semibold">OPD-Room 4B</span></p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:mx-auto">
            <MetricPill icon="👥" label="Total Registered" value={metrics.total} />
            <MetricPill icon="⏳" label="Waiting" value={metrics.waiting} tone="amber" />
            <MetricPill icon="🚨" label="P1 Critical" value={metrics.p1} tone="rose" pulse />
            <MetricPill icon="✓" label="Consulted" value={metrics.consulted} tone="sage" />
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="text-right leading-tight hidden sm:block">
              <p className="text-xs font-semibold text-stone-200">Dr. Sharma, BAMS, MD (Ayur)</p>
              <p className="text-[11px] text-stone-400 tabular-nums">
                {today.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} · {today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className="w-8 h-8 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center" title="Dr. Ananya Sharma — Reg. AY-DL-88421">AS</span>
            <ThemeToggle />
            <button onClick={refresh} title="Refresh queue"
              className="w-9 h-9 rounded-md border border-stone-700 text-stone-300 hover:text-amber-400 hover:border-amber-600/50 flex items-center justify-center transition-colors">
              <span className={`material-symbols-outlined text-[20px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── B. Split workstation ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* B1. Queue column */}
        <aside className="lg:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-stone-800 bg-stone-950/60 flex flex-col max-h-[46vh] lg:max-h-none min-h-0">
          <div className="sticky top-0 z-10 p-3 border-b border-stone-800 bg-stone-950/90 backdrop-blur-md flex flex-col gap-2">
            <label className="relative block">
              <span className="sr-only">Search queue</span>
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-[18px]">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, token, complaint…"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-stone-900 border border-stone-800 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-600/60" />
            </label>
            <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Queue filter">
              {FILTERS.map(f => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap border transition-colors ${
                    filter === f.id ? 'border-amber-600/60 bg-amber-500/10 text-amber-400' : 'border-stone-800 text-stone-400 hover:text-stone-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {!loaded && <li className="p-4 text-sm text-stone-500">Loading OPD queue…</li>}
            {loaded && queue.length === 0 && (
              <li className="p-4 text-sm text-stone-500">{patients.length ? 'No patients match this filter.' : 'No patients registered yet.'}</li>
            )}
            {queue.map(p => {
              const pr = priorityOf(p);
              const selected = active?.id === p.id;
              const hasDocs = normalizeClinicalDocs(p.documents).hasData;
              const done = isConsulted(p);
              return (
                <li key={p.id}>
                  <button onClick={() => setSelectedId(p.id)} aria-current={selected ? 'true' : undefined}
                    className={`relative w-full text-left rounded-lg border px-3 py-2.5 pl-4 transition-colors overflow-hidden ${
                      selected ? 'border-amber-500/70 bg-amber-500/[0.07]' : 'border-stone-800 bg-stone-900/70 hover:border-stone-700'}`}>
                    <span className={`absolute left-0 inset-y-0 w-1 ${selected ? 'bg-amber-500' : pr.bar} ${selected ? '' : 'opacity-60'}`} aria-hidden="true" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-1.5 py-px rounded border border-amber-600/40 text-[10px] font-semibold tabular-nums text-amber-400">{patientToken(p)}</span>
                      <span className={`px-1.5 py-px rounded text-[10px] font-bold ${pr.badge} ${p.triageLevel === 'P1' ? 'animate-pulse' : ''}`}>{pr.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-stone-100 truncate">{p.name}</p>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-stone-400">
                      <span className="truncate">{[clean(p.age), clean(p.gender)].filter(Boolean).join(' · ') || '—'}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {intakeChannels(p, hasDocs).map(c => <span key={c.icon} title={c.title} aria-label={c.title}>{c.icon}</span>)}
                        {done
                          ? <span className="text-emerald-400 font-semibold">✓ Consulted</span>
                          : <span className="tabular-nums" title="Waiting since registration">⏳ {waitLabel(p.timestamp, now)}</span>}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* B2. Clinical workstation */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {!active ? (
            <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-2 text-stone-500 p-8 text-center">
              <span className="material-symbols-outlined text-[44px] text-stone-700">clinical_notes</span>
              <p className="text-sm">{loaded ? 'Select a patient from the queue to open their clinical record.' : 'Loading…'}</p>
            </div>
          ) : (
            <Workstation
              key={active.id}
              p={active}
              patient={withConsult(active)}
              assessment={assessmentFor(active)}
              onAssessment={(next) => setAssessments(prev => ({ ...prev, [active.id]: next }))}
              consulted={isConsulted(active)}
              rxDraft={rxDrafts[active.id]}
              onRxDraft={(d) => setRxDrafts(prev => ({ ...prev, [active.id]: d }))}
              onSaved={(c, record) => {
                setConsults(prev => ({ ...prev, [active.id]: c }));
                if (record) setPatients(prev => prev.map(x => (x.id === active.id ? record : x)));
              }}
              onPdf={() => { setAutoPdf(true); setCaseSheet(active); }}
              onPrint={() => { setAutoPdf(false); setCaseSheet(active); }}
              onDelete={() => handleDelete(active)}
              deleting={deletingId === active.id}
              onUpload={(file) => handleUpload(active, file)}
              uploading={uploadingId === active.id}
              error={cardError[active.id]}
              onInspect={setDocModal}
              onBriefing={() => setShowBriefing(true)}
              onAdvice={() => setShowAdvice(true)}
              onCaseReport={() => setShowCaseReport(true)}
              onZoom={() => handleZoom(active)}
              zoomLoading={zoomLoading}
              zoomUrl={zoomUrl}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <ClinicalBriefingModal isOpen={showBriefing} onClose={() => setShowBriefing(false)} patient={active} onZoom={() => handleZoom(active)} />
      <PatientAdviceDrawer isOpen={showAdvice} onClose={() => setShowAdvice(false)} patientData={active} />
      <CaseReportModal isOpen={showCaseReport} onClose={() => setShowCaseReport(false)} patient={active} />

      {caseSheet && (
        <CaseHistorySheet patient={withConsult(caseSheet)} autoDownload={autoPdf} onClose={() => { setCaseSheet(null); setAutoPdf(false); }} />
      )}

      {docModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDocModal(null)}>
          <div className="w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-800">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-stone-100 truncate">{docModal.title || docModal.fileName || 'Original Document'}</h3>
                <p className="text-[11px] text-stone-400">{docTypeLabel(docModal.documentType || docModal.ocrData?.documentType)} · {docModal.fileName}</p>
              </div>
              <button onClick={() => setDocModal(null)} className="w-8 h-8 rounded-md border border-stone-700 text-stone-300 hover:text-white flex items-center justify-center" aria-label="Close">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-4 overflow-auto bg-stone-950 flex items-center justify-center">
              {docModal.mimeType?.startsWith('image/') ? (
                <img src={docModal.fileBase64} alt={docModal.title || 'original document'} className="max-w-full max-h-[72vh] rounded-md object-contain" />
              ) : docModal.mimeType === 'application/pdf' ? (
                <iframe src={docModal.fileBase64} title="original document" className="w-full h-[72vh] rounded-md bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-stone-400">
                  <span className="material-symbols-outlined text-[44px]">draft</span>
                  <p className="text-sm">Preview unavailable for this file type.</p>
                  <a href={docModal.fileBase64} download={docModal.fileName} className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold">Download</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Active patient workstation ────────────────────────────────────────────────
function Workstation({
  p, patient, assessment, onAssessment, consulted, rxDraft, onRxDraft, onSaved,
  onPdf, onPrint, onDelete, deleting, onUpload, uploading, error, onInspect,
  onBriefing, onAdvice, onCaseReport, onZoom, zoomLoading, zoomUrl,
}) {
  const pr = priorityOf(p);
  const clinical = normalizeClinicalDocs(p.documents);
  const abha = p.abhaAddress || p.abhaId;
  const redFlags = clean(p.redFlags);
  const chronic = clean(p.chronic_history);
  const correlation = clean(p.diagnosticCorrelation) || clinical.correlation || clean(p.recommendation);
  // Reports carry their own file; single-file legacy uploads only have the record-level one.
  const docFiles = clinical.reports.length
    ? clinical.reports.filter(r => r.fileBase64)
    : (p.documents?.fileBase64 ? [p.documents] : []);

  const smallBtn = 'px-2.5 py-1.5 rounded-md border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 text-xs font-medium flex items-center gap-1 transition-colors';

  return (
    <div className="p-4 lg:p-5 flex flex-col gap-4 max-w-[1500px]">
      {/* Demographics banner */}
      <section className="card-surface rounded-xl bg-stone-900/90 border border-stone-800 overflow-hidden">
        <div className="p-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-stone-100">{p.name}</h1>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${pr.badge} ${p.triageLevel === 'P1' ? 'animate-pulse' : ''}`}>
                {pr.label}{p.surgicalAlert ? ' · Surgical alert' : ''}
              </span>
              {consulted && <span className="px-2 py-0.5 rounded border border-emerald-600/30 bg-emerald-600/15 text-[11px] font-semibold text-emerald-400">✓ Consulted</span>}
            </div>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-1.5 text-xs">
              {[
                ['Token', <span key="t" className="text-amber-400 font-semibold tabular-nums">{patientToken(p)}</span>],
                ['Age / Sex', [clean(p.age), clean(p.gender)].filter(Boolean).join(' / ') || '—'],
                ['Contact', <span key="c" className="tabular-nums">{clean(p.phone) || '—'}</span>],
                ['Registered', <span key="r" className="tabular-nums">{fmtTime(p.timestamp)}</span>],
                ['ABHA Address', abha ? <span key="a" className="text-emerald-400">{abha}</span> : <span key="a" className="text-stone-500">Not linked (name@abdm)</span>],
                ['Intake', p.triageSource || '—'],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wider text-stone-500">{k}</dt>
                  <dd className="text-stone-200 truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={onBriefing} className={smallBtn}><span className="material-symbols-outlined text-[15px]">clinical_notes</span>Briefing</button>
            <button onClick={onCaseReport} className={smallBtn}><span className="material-symbols-outlined text-[15px]">description</span>Case Report</button>
            <button onClick={onAdvice} className={smallBtn}><span className="material-symbols-outlined text-[15px]">nutrition</span>Advice</button>
            <button onClick={onPrint} className={smallBtn}><span className="material-symbols-outlined text-[15px]">print</span>Print</button>
            <button onClick={onZoom} disabled={zoomLoading} className={smallBtn}><span className="material-symbols-outlined text-[15px]">videocam</span>{zoomLoading ? 'Creating…' : 'Teleconsult'}</button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-stone-800 bg-stone-950/40 flex flex-col gap-2">
          <blockquote className="border-l-2 border-amber-500 pl-3">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Chief Complaint</p>
            <p className="text-[15px] text-stone-100">“{p.chiefComplaint || 'General consultation'}”</p>
          </blockquote>
          {(redFlags || chronic) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {redFlags && <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-600/40 bg-rose-950/40 text-rose-300"><span className="material-symbols-outlined text-[14px]">warning</span>{redFlags}</span>}
              {chronic && <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-700 text-stone-300"><span className="material-symbols-outlined text-[14px] text-amber-500">history</span>Purva Vyadhi: {chronic}</span>}
            </div>
          )}
          {zoomUrl && (
            <a href={zoomUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline break-all">Teleconsult link: {zoomUrl}</a>
          )}
        </div>
      </section>

      {/* 3-module grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <ModuleCard title="Disease Progression · रोग प्रगति समय-रेखा" icon="timeline">
          <DiseaseTimeline events={p.diseaseTimeline} bare />
          {Array.isArray(p.followups) && p.followups.length > 0 && (
            <div className="mt-1 pt-3 border-t border-stone-800 flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider text-stone-500">AI Vaidya follow-ups</p>
              {p.followups.map((f, i) => (
                <div key={i} className="text-xs">
                  <p className="text-stone-300"><span className="text-amber-500 font-semibold">Q{i + 1}</span> {f.question}</p>
                  <p className="text-stone-400 pl-5">↳ {f.answer}</p>
                </div>
              ))}
            </div>
          )}
        </ModuleCard>

        <AyushAssessmentCard
          idPrefix={p.id}
          value={assessment}
          aiValue={aiAssessmentOf(p)}
          onChange={onAssessment}
          correlation={correlation}
        />

        <ModuleCard
          title="Documents & Lab Matrix"
          icon="lab_profile"
          action={(
            <label className={`px-2 py-1 rounded-md border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10 text-[11px] font-semibold flex items-center gap-1 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
              <span className={`material-symbols-outlined text-[14px] ${uploading ? 'animate-spin' : ''}`}>{uploading ? 'progress_activity' : 'upload_file'}</span>
              {uploading ? 'Analysing…' : 'Upload'}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          )}
        >
          {clinical.reports.length > 0 || docFiles.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(clinical.reports.length ? clinical.reports : docFiles).map((r, i) => (
                <button key={r.id || i} onClick={() => r.fileBase64 && onInspect(r)} disabled={!r.fileBase64}
                  title={r.fileBase64 ? 'Inspect original' : 'Original file not stored'}
                  className="group flex items-center gap-2 max-w-full rounded-md border border-stone-700 bg-stone-950/60 pr-2.5 hover:border-amber-600/50 disabled:cursor-default transition-colors">
                  {r.mimeType?.startsWith('image/') && r.fileBase64 ? (
                    <img src={r.fileBase64} alt="" className="w-9 h-9 rounded-l-md object-cover" />
                  ) : (
                    <span className="w-9 h-9 rounded-l-md bg-stone-800 flex items-center justify-center text-stone-400">
                      <span className="material-symbols-outlined text-[18px]">{r.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'description'}</span>
                    </span>
                  )}
                  <span className="text-left min-w-0">
                    <span className="block text-xs text-stone-200 truncate max-w-[180px]">{r.title || r.fileName || 'Document'}</span>
                    <span className="block text-[10px] text-stone-500">{docTypeLabel(r.documentType || r.ocrData?.documentType)}{r.uploadedAt ? ` · ${docTime(r.uploadedAt)}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500">No documents attached. Upload a prescription or lab report to extract its values.</p>
          )}

          {clinical.labTests.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-stone-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-800/50 text-[10px] uppercase tracking-wider text-stone-300">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Parameter</th>
                    <th className="px-2 py-1.5 font-semibold">Observed</th>
                    <th className="px-2 py-1.5 font-semibold">Bio. Ref. Range</th>
                    <th className="px-2 py-1.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {clinical.labTests.map((l, i) => {
                    const st = flagStyle(l.flag);
                    return (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-stone-300">{l.testName}</td>
                        <td className="px-2 py-1.5 font-semibold tabular-nums text-stone-100">{l.observedValue || '—'}</td>
                        <td className="px-2 py-1.5 tabular-nums text-stone-500">{l.referenceRange || '—'}</td>
                        <td className="px-2 py-1.5"><span className={`inline-block px-1.5 py-px rounded text-[10px] font-bold ${st.chip}`}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {clinical.medicines.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">Existing medications</p>
              <div className="flex flex-wrap gap-1">
                {clinical.medicines.map((m, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded border border-stone-700 text-[11px] text-stone-300">
                    <strong className="text-stone-100">{m.name}</strong>{m.dosage ? ` · ${m.dosage}` : ''}{m.frequency ? ` · ${m.frequency}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {clinical.observations && <p className="text-xs text-stone-400 leading-relaxed">{clinical.observations}</p>}
        </ModuleCard>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Clinical action suite */}
      <DiagnosisRxPanel
        patient={patient}
        draft={rxDraft}
        onDraftChange={onRxDraft}
        onSaved={onSaved}
        onDownloadPdf={onPdf}
        onDelete={onDelete}
        deleting={deleting}
      />
    </div>
  );
}
