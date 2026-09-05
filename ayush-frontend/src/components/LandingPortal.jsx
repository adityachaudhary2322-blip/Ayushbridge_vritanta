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
        </section>

        {/* ── Mode selection — three distinct pathways ── */}
        <section className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Choose your pathway</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">अपना माध्यम चुनें — तीनों में से कोई एक</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

            {/* 1 · Voice kiosk */}
            <article className="group bg-surface-container-lowest rounded-3xl shadow-sm hover:shadow-lg ring-1 ring-surface-container-high hover:ring-primary/40 transition-all p-6 flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-[30px]">🗣️</div>
              <div className="flex-1 flex flex-col gap-1.5">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold leading-tight">
                  Touchless Voice AI Kiosk
                </h3>
                <p className="font-title-md text-title-md text-primary font-semibold leading-tight">आवाज आधारित कियोस्क</p>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mt-1">
                  Walk-in OPD patients · Autonomous Hindi/English voice intake &amp; Rogi Pariksha
                </p>
              </div>
              <button
                onClick={() => navigate('/kiosk')}
                className="w-full px-5 py-3.5 rounded-2xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
                Launch Kiosk
              </button>
            </article>

            {/* 2 · Teleconsultation */}
            <article className="group bg-surface-container-lowest rounded-3xl shadow-sm hover:shadow-lg ring-1 ring-surface-container-high hover:ring-primary/40 transition-all p-6 flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl bg-secondary-container/40 text-on-secondary-container flex items-center justify-center text-[30px]">📱</div>
              <div className="flex-1 flex flex-col gap-1.5">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold leading-tight">
                  Remote Teleconsultation
                </h3>
                <p className="font-title-md text-title-md text-primary font-semibold leading-tight">दूरस्थ टेली-परामर्श</p>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mt-1">
                  Mobile video call · Zero app install · Doctor remote triage
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm ring-1 ring-surface-container-high shrink-0">
                    <QRCodeSVG value={teleconsultUrl} size={92} level="M" />
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Scan with your phone camera — the call opens in the mobile browser.
                    <br />
                    <span className="text-primary font-semibold">Room {roomId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/teleconsult?room=${roomId}`)}
                className="w-full px-5 py-3.5 rounded-2xl bg-surface-container-high text-on-surface font-label-lg text-label-lg hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">videocam</span>
                Open Call on this Screen
              </button>
            </article>

            {/* 3 · Sign language */}
            <article className="group bg-surface-container-lowest rounded-3xl shadow-sm hover:shadow-lg ring-1 ring-tertiary-container hover:ring-tertiary transition-all p-6 flex flex-col gap-4 relative overflow-hidden">
              <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm font-semibold">Beta</span>
              <div className="w-14 h-14 rounded-2xl bg-tertiary-container/40 text-on-tertiary-container flex items-center justify-center text-[30px]">🤟</div>
              <div className="flex-1 flex flex-col gap-1.5">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold leading-tight">
                  Divyang Jan — Sign Language Mode
                </h3>
                <p className="font-title-md text-title-md text-primary font-semibold leading-tight">सांकेतिक भाषा मोड</p>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mt-1">
                  Speech &amp; hearing impaired · Touchless gesture &amp; visual triage · Multi-report upload
                </p>
              </div>
              <button
                onClick={() => navigate('/sign-bridge')}
                className="w-full px-5 py-3.5 rounded-2xl bg-tertiary text-on-tertiary font-label-lg text-label-lg shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">sign_language</span>
                Open SignBridge
              </button>
            </article>
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

        <footer className="text-center font-label-sm text-label-sm text-on-surface-variant pb-4">
          AYUSH Swasthya Sahayak · Sarvam AI · Gemini 3.6 Flash · Prototype for demonstration
        </footer>
      </main>
    </div>
  );
}
