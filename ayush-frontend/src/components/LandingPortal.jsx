import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function LandingPortal() {
  const navigate = useNavigate();
  const [roomId] = useState(() => 'AYUSH-' + Date.now().toString().slice(-4));
  const teleconsultUrl = `${window.location.origin}/teleconsult?room=${roomId}`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-surface to-surface-container-low">

      {/* Nav */}
      <header className="w-full px-4 sm:px-8 h-16 flex items-center justify-between border-b border-surface-container-high bg-surface-container-lowest/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[20px]">spa</span>
          </div>
          <span className="font-title-md text-title-md text-on-surface font-semibold">AYUSH Swasthya Sahayak</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/text-intake')} className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">keyboard</span>Text Intake
          </button>
          <button onClick={() => navigate('/doctor')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors">
            <span className="material-symbols-outlined text-[18px]">stethoscope</span>
            <span className="hidden sm:inline">Doctor Dashboard</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-12">

        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-5 pt-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Ministry of AYUSH · AI-assisted Tele-Triage
          </span>
          <h1 className="font-headline-lg text-headline-lg sm:text-[42px] leading-tight text-on-surface font-bold max-w-3xl">
            AYUSH Swasthya Sahayak — AI Clinical Triage &amp; Teleconsultation
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            A multilingual, voice-first triage assistant that registers patients hands-free, reads
            their prescriptions, and routes them to an AYUSH physician by clinical priority.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <button onClick={() => navigate('/kiosk')} className="px-7 py-4 rounded-2xl bg-primary text-on-primary font-title-md text-title-md shadow-lg hover:bg-primary-container transition-all flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[24px]">local_hospital</span>
              🏥 Launch Hospital Kiosk Mode
            </button>
            <button onClick={() => navigate('/text-intake')} className="px-6 py-4 rounded-2xl bg-surface-container-high text-on-surface font-title-md text-title-md hover:bg-surface-container transition-colors flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">edit_note</span>
              Text Intake
            </button>
          </div>
        </section>

        {/* About */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: 'record_voice_over', title: 'Sarvam Multilingual Voice Loop', body: 'Hands-free Hindi & English intake using Sarvam Bulbul v3 TTS and Saaras v3 STT — no typing, no taps.' },
            { icon: 'document_scanner', title: 'Touchless Prescription OCR', body: 'Patients scan a QR to upload prescriptions or lab reports from their phone; Gemini Vision extracts medicines and abnormal labs.' },
            { icon: 'stethoscope', title: 'Doctor Priority Dashboard', body: 'Every intake is triaged P1–P4 with Dosha, Agni & Koshtha assessment and a printable A4 case-history sheet.' },
          ].map(c => (
            <div key={c.title} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm ring-1 ring-surface-container-high flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">{c.icon}</span>
              </div>
              <h3 className="font-title-md text-title-md text-on-surface font-semibold">{c.title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{c.body}</p>
            </div>
          ))}
        </section>

        {/* Teleconsult demo */}
        <section className="bg-surface-container-lowest rounded-3xl shadow-md ring-1 ring-surface-container-high overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 flex flex-col justify-center gap-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-container/40 text-on-tertiary-container font-label-md text-label-md w-fit">
                <span className="material-symbols-outlined text-[16px]">videocam</span>
                Live Demo
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                📱 Try Remote Teleconsultation on Your Smartphone
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Scan this QR code with your phone camera to experience an AI Vaidya teleconsultation
                call — with a 5-second admission countdown and press-or-say IVR language selection.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-3 mt-1">
                <button onClick={() => navigate(`/teleconsult?room=${roomId}`)} className="px-6 py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">desktop_windows</span>
                  💻 Open Call on this Screen for Demo
                </button>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Room ID: <strong className="text-primary">{roomId}</strong></p>
            </div>
            <div className="bg-primary/[0.05] p-8 flex flex-col items-center justify-center gap-4 border-t lg:border-t-0 lg:border-l border-surface-container-high">
              <div className="p-4 bg-white rounded-2xl shadow-sm">
                <QRCodeSVG value={teleconsultUrl} size={196} level="M" />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-xs">
                Point your phone camera here — the call opens directly in your mobile browser.
              </p>
            </div>
          </div>
        </section>

        <footer className="text-center font-label-sm text-label-sm text-on-surface-variant pb-4">
          AYUSH Swasthya Sahayak · Sarvam AI · Gemini 3.6 Flash · Prototype for demonstration
        </footer>
      </main>
    </div>
  );
}
