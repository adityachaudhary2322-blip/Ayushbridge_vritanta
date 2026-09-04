import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Mobile-optimized touchless document upload page.
// Opened on the patient's phone via the QR code shown on the kiosk.
export default function MobileScan() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sid') || '';

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');       // image data URL, or '' for PDF
  const [isPdf, setIsPdf] = useState(false);
  const [status, setStatus] = useState('idle');     // idle | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const cameraRef = useRef(null);
  const fileRef = useRef(null);

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
      setStatus('done');
    } catch (err) {
      console.error('[MobileScan] upload:', err.message);
      setStatus('error');
      setErrorMsg(err.message || 'Network error — please try again.');
    }
  };

  const reset = () => {
    setFile(null); setPreview(''); setIsPdf(false); setStatus('idle'); setErrorMsg('');
    if (cameraRef.current) cameraRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 py-8 gap-6">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[30px]">document_scanner</span>
        </div>
        <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold">AYUSH Document Scan</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Upload your prescription or lab report. It will appear instantly on the clinic kiosk screen.
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

      {status === 'done' ? (
        // ── Success ──
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-md p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[44px]">check_circle</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Document Sent!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            ✓ Check the kiosk screen to see your extracted medicines and reports.
          </p>
          <button onClick={reset} className="mt-2 px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            Scan Another
          </button>
        </div>
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
                    Sending to Triage Kiosk & Extracting Clinical Insights…
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
        </>
      )}

      <p className="font-label-sm text-label-sm text-on-surface-variant text-center max-w-md mt-2">
        Powered by Gemini 3.6 Flash Vision · Images &amp; PDF up to 10 MB
      </p>
    </div>
  );
}
