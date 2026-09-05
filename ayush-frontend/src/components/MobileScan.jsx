import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Mobile-optimized touchless document upload page.
// Opened on the patient's phone via the QR code shown on the kiosk.
// Multiple reports can be sent one after another — the session is never reset.

const FINALIZE_SECONDS = 10;

const DOC_BADGE = {
  PRESCRIPTION: { text: '📄 Prescription', cls: 'bg-primary/10 text-primary' },
  LAB_REPORT: { text: '🧪 Lab Report', cls: 'bg-secondary-container/50 text-on-secondary-container' },
  MIXED: { text: '📄🧪 Prescription + Lab', cls: 'bg-tertiary-container/50 text-on-tertiary-container' },
};

function ReportList({ reports }) {
  if (!reports.length) return null;
  return (
    <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-sm ring-1 ring-surface-container-high p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[18px]">folder_open</span>
          Reports in this session
        </span>
        <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">{reports.length}</span>
      </div>
      {reports.map((r, i) => {
        const badge = DOC_BADGE[r.documentType] || DOC_BADGE.MIXED;
        return (
          <div key={r.id || i} className="rounded-2xl bg-surface-container-low p-3 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${badge.cls}`}>{badge.text}</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{r.title || r.fileName}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              💊 {r.medicineCount || 0} medicine(s) · 🧪 {r.labCount || 0} lab parameter(s)
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function MobileScan() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sid') || '';

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');       // image data URL, or '' for PDF
  const [isPdf, setIsPdf] = useState(false);
  const [status, setStatus] = useState('idle');     // idle | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [reports, setReports] = useState([]);       // every report accepted this session
  const [lastReport, setLastReport] = useState(null);

  const [secondsLeft, setSecondsLeft] = useState(FINALIZE_SECONDS);

  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const timerRef = useRef(0);

  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = 0; };
  useEffect(() => stopTimer, []);

  // After a successful OCR the patient gets a visible 10s window to send one
  // more document; when it runs out the session finalizes on its own.
  useEffect(() => {
    if (status !== 'done') return undefined;
    const deadline = Date.now() + FINALIZE_SECONDS * 1000;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) { stopTimer(); setStatus('finalized'); }
    }, 250);
    return stopTimer;
  }, [status]);

  // Restore any reports already attached to this session (e.g. after a page reload)
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/session-docs/${sessionId}`);
        const data = await res.json();
        if (Array.isArray(data?.reports) && data.reports.length) {
          setReports(data.reports.map(r => ({
            id: r.id,
            title: r.title,
            fileName: r.fileName,
            documentType: r.documentType,
            medicineCount: r.medicines?.length || 0,
            labCount: r.labTests?.length || 0,
          })));
        }
      } catch { /* first visit — nothing to restore */ }
    })();
  }, [sessionId]);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStatus('idle');
    setErrorMsg('');
    const pdf = f.type === 'application/pdf';
    setIsPdf(pdf);
    if (pdf) {
      setPreview('');
    } else {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    }
  };

  const upload = async () => {
    if (!file) return;
    if (!sessionId) { setStatus('error'); setErrorMsg('Missing session ID — please re-scan the QR code from the kiosk.'); return; }
    setStatus('uploading');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('document', file, file.name);
      fd.append('sessionId', sessionId);
      const res = await fetch('/api/upload-mobile', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Upload failed (${res.status})`);
      if (Array.isArray(data.reports)) setReports(data.reports);
      setLastReport(data.report || null);
      setSecondsLeft(FINALIZE_SECONDS);
      setStatus('done');
    } catch (err) {
      console.error('[MobileScan] upload:', err.message);
      setStatus('error');
      setErrorMsg(err.message || 'Network error — please try again.');
    }
  };

  // Clears only the file picker — the session and its report list are preserved.
  const addAnother = () => {
    stopTimer();
    setFile(null); setPreview(''); setIsPdf(false); setStatus('idle'); setErrorMsg('');
    if (cameraRef.current) cameraRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
    // Jump straight back into the camera — one tap, no extra screen.
    setTimeout(() => cameraRef.current?.click(), 60);
  };

  const finishNow = () => { stopTimer(); setStatus('finalized'); };


  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 py-8 gap-6">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[30px]">document_scanner</span>
        </div>
        <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold">AYUSH Document Scan</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Upload your prescriptions and lab reports — send as many as you like. They appear instantly on the clinic kiosk screen.
        </p>
        {sessionId && (
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">
            Session {sessionId}
          </span>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />

      {status === 'finalized' ? (
        // ── Session closed — the patient should look back at the kiosk ──
        <>
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-md p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[54px]">task_alt</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              ✓ Upload Complete
            </h2>
            <p className="font-title-md text-title-md text-primary font-semibold">
              दस्तावेज़ सफलतापूर्वक अपलोड हो गए!
            </p>
            <div className="w-full rounded-2xl bg-primary/10 p-4 flex flex-col gap-1.5">
              <p className="font-body-md text-body-md text-on-surface font-semibold">
                👀 Please look back at the kiosk screen to continue your consultation
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                कृपया परामर्श जारी रखने के लिए कियोस्क स्क्रीन देखें।
              </p>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              This upload session is now closed. To send more, refresh this page or scan the QR again.
              <br />
              यह सत्र बंद हो गया है — और भेजने के लिए QR दोबारा स्कैन करें।
            </p>
          </div>
          <ReportList reports={reports} />
        </>
      ) : status === 'done' ? (
        // ── Success + 10-second window to add one more document ──
        <>
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-md p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[44px]">check_circle</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Report {reports.length} Sent!</h2>

            {lastReport && (
              <div className="w-full rounded-2xl bg-surface-container-low p-4 flex flex-col items-center gap-2">
                <span className={`px-3 py-1 rounded-full font-label-md text-label-md font-semibold ${(DOC_BADGE[lastReport.documentType] || DOC_BADGE.MIXED).cls}`}>
                  {(DOC_BADGE[lastReport.documentType] || DOC_BADGE.MIXED).text}
                </span>
                <p className="font-title-md text-title-md text-on-surface font-semibold">{lastReport.title}</p>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {lastReport.medicineCount > 0 && <>💊 <strong className="text-on-surface">{lastReport.medicineCount}</strong> medicine{lastReport.medicineCount === 1 ? '' : 's'} detected</>}
                  {lastReport.medicineCount > 0 && lastReport.labCount > 0 && ' · '}
                  {lastReport.labCount > 0 && <>🧪 <strong className="text-on-surface">{lastReport.labCount}</strong> parameter{lastReport.labCount === 1 ? '' : 's'} detected</>}
                  {!lastReport.medicineCount && !lastReport.labCount && 'Document stored for physician review'}
                </p>
              </div>
            )}

            {/* Auto-finalize countdown */}
            <div className="w-full flex flex-col gap-2">
              <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${(secondsLeft / FINALIZE_SECONDS) * 100}%` }}
                />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                ⏳ You have <strong className="text-primary text-body-md">{secondsLeft}s</strong> to add another document, or this session will automatically finalize
                <br />
                {secondsLeft} सेकंड में दूसरी रिपोर्ट जोड़ें या सत्र समाप्त हो जाएगा
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={addAnother}
                className="w-full px-5 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                ➕ Add Another Document / दूसरी रिपोर्ट जोड़ें
              </button>
              <button
                onClick={finishNow}
                className="w-full px-5 py-3.5 rounded-xl bg-surface-container-high text-on-surface font-label-lg text-label-lg hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[20px]">done_all</span>
                ✓ Finish &amp; Continue / समाप्त करें
              </button>
            </div>
          </div>
          <ReportList reports={reports} />
        </>
      ) : (
        <>
          {/* Pick buttons */}
          <div className="w-full max-w-md grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-primary text-on-primary shadow-sm hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[32px]">photo_camera</span>
              <span className="font-label-md text-label-md">Take Photo</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-surface-container-high text-on-surface shadow-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[32px] text-primary">upload_file</span>
              <span className="font-label-md text-label-md">Upload File / PDF</span>
            </button>
          </div>

          {/* Preview + upload */}
          {file && (
            <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-md p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {isPdf ? (
                  <div className="w-16 h-16 rounded-xl bg-error-container/40 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-error text-[32px]">picture_as_pdf</span>
                  </div>
                ) : preview ? (
                  <img src={preview} alt="preview" className="w-16 h-16 rounded-xl object-cover shrink-0 shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-[28px]">description</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{file.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{(file.size / 1024).toFixed(0)} KB · {isPdf ? 'PDF' : 'Image'}</p>
                </div>
              </div>

              {status === 'error' && (
                <div className="bg-error-container/30 text-on-error-container rounded-xl p-3 font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={upload}
                disabled={status === 'uploading'}
                className="w-full px-5 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {status === 'uploading' ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                    Sending to Triage Kiosk &amp; Extracting Clinical Insights…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Upload &amp; Analyze with AYUSH AI
                  </>
                )}
              </button>
            </div>
          )}

          <ReportList reports={reports} />
        </>
      )}

      <p className="font-label-sm text-label-sm text-on-surface-variant text-center max-w-md mt-2">
        Powered by Gemini 3.6 Flash Vision · Images &amp; PDF up to 10 MB
      </p>
    </div>
  );
}
