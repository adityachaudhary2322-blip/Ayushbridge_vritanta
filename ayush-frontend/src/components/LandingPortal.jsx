import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { BrandMark, OfficialBadge, OfficialStrip, ThemeToggle } from './Brand';
import { BRAND } from '../utils/brand';

function PathwayCard({ index, icon, title, hi, body, children, cta, ctaIcon, onClick, tone = 'sage' }) {
  const ctaTone = tone === 'brass'
    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
    : 'bg-emerald-700 hover:bg-emerald-600 text-white';
  return (
    <article className="card-surface group relative flex flex-col rounded-xl border border-stone-800 bg-stone-900/90 hover:border-amber-600/50 transition-colors overflow-hidden">
      <div className="h-px bg-gradient-to-r from-transparent via-amber-600/60 to-transparent" />
      <div className="p-6 flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className="w-12 h-12 rounded-lg border border-amber-600/40 bg-amber-500/10 flex items-center justify-center text-[26px]" aria-hidden="true">{icon}</span>
          <span className="text-[11px] font-semibold tabular-nums tracking-widest text-stone-600">PATHWAY 0{index}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-stone-100 leading-snug">{title}</h3>
          <p className="font-serif text-[15px] text-amber-500 mt-0.5">{hi}</p>
        </div>
        <p className="text-sm leading-relaxed text-stone-400">{body}</p>
        {children}
      </div>
      <div className="px-6 pb-6">
        <button onClick={onClick} className={`w-full px-4 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${ctaTone}`}>
          <span className="material-symbols-outlined text-[19px]">{ctaIcon}</span>
          {cta}
        </button>
      </div>
    </article>
  );
}

export default function LandingPortal() {
  const navigate = useNavigate();
  const [roomId] = useState(() => 'AYUSH-' + Date.now().toString().slice(-4));
  const teleconsultUrl = `${window.location.origin}/teleconsult?room=${roomId}`;

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      {/* Institutional nav */}
      <header className="sticky top-0 z-20 bg-stone-950/85 backdrop-blur-md">
        <OfficialStrip />
        <div className="border-b border-stone-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <BrandMark context="Clinical HealthOS · Ministry of AYUSH" />
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => navigate('/text-intake')} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 text-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-[18px]">keyboard</span>Text Intake
            </button>
            <button onClick={() => navigate('/doctor')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
              <span className="material-symbols-outlined text-[18px]">stethoscope</span>
              <span className="hidden sm:inline">Doctor Workstation</span>
            </button>
          </nav>
        </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col gap-14">
        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-5">
          <OfficialBadge />
          <h1 className="flex flex-col items-center gap-1">
            <span className="text-5xl sm:text-7xl font-bold tracking-[0.18em] text-stone-100">{BRAND.name}</span>
            <span className="font-serif text-3xl sm:text-4xl text-amber-500">{BRAND.devanagari}</span>
            <span className="mt-3 max-w-3xl text-lg sm:text-2xl font-semibold leading-snug text-stone-200">{BRAND.subtitle}</span>
          </h1>
          <p className="flex flex-col sm:flex-row items-center gap-x-3 gap-y-1 text-base">
            <span className="font-serif text-xl text-emerald-400">{BRAND.taglineHi}</span>
            <span className="hidden sm:inline text-stone-600" aria-hidden="true">/</span>
            <span className="text-stone-300">{BRAND.taglineEn}</span>
          </p>
          <p className="max-w-2xl text-base leading-relaxed text-stone-400">
            Voice, telephony and sign-language intake in 11 Indian languages. Every patient is triaged P1–P4,
            assessed on the three Ayurvedic pillars — <span className="font-serif text-stone-200">Dosha, Agni, Koshtha</span> — and
            handed to the attending Vaidya with a verified clinical record.
          </p>
        </section>

        {/* Pathways */}
        <section aria-labelledby="pathways" className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4 border-b border-stone-800 pb-3">
            <div>
              <h2 id="pathways" className="text-sm font-semibold uppercase tracking-wider text-amber-500">Choose an intake pathway</h2>
              <p className="font-serif text-sm text-stone-400">अपना माध्यम चुनें</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            <PathwayCard
              index={1} icon="🗣️"
              title="Voice AI Clinical Kiosk" hi="आवाज आधारित कियोस्क"
              body="Walk-in OPD intake, fully hands-free. The AI Vaidya asks two adaptive clinical follow-ups, locks each answer after 1 second of silence, and reads uploaded prescriptions."
              cta="Launch Kiosk" ctaIcon="local_hospital" onClick={() => navigate('/kiosk')}
            />

            <PathwayCard
              index={2} icon="📞"
              title="Telephony Voice Consultation" hi="टेली-परामर्श — वॉयस कॉल"
              body="High-fidelity voice consultation. In live hospital deployment this runs over standard cellular/PSTN lines (IVR/Toll-Free) for patients without internet; it currently runs over web-voice for presentation."
              cta="Start Voice Call" ctaIcon="call" onClick={() => navigate(`/teleconsult?room=${roomId}`)}
            >
              <div className="flex items-center gap-3 rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
                <div className="p-1.5 bg-white rounded-md shrink-0">
                  <QRCodeSVG value={teleconsultUrl} size={76} level="M" />
                </div>
                <p className="text-xs leading-relaxed text-stone-400">
                  Scan with a phone camera — the call opens in the mobile browser.
                  <span className="block mt-1 text-amber-400 font-semibold tabular-nums">Line {roomId}</span>
                </p>
              </div>
            </PathwayCard>

            <PathwayCard
              index={3} icon="🤟" tone="brass"
              title="Divyang Jan Sign-Bridge" hi="दिव्यांग जन सांकेतिक भाषा कियोस्क"
              body="For speech and hearing impaired patients: touchless gesture selection tracked on-device, large visual symptom tiles, and multi-report document upload."
              cta="Open Sign-Bridge" ctaIcon="sign_language" onClick={() => navigate('/sign-bridge')}
            />
          </div>
        </section>

        {/* Capabilities */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-xl overflow-hidden border border-stone-800 bg-stone-800">
          {[
            { icon: 'record_voice_over', title: 'Multilingual Voice Loop', body: 'Sarvam Bulbul v3 speech and Saaras v3 transcription across 11 Indian languages.' },
            { icon: 'document_scanner', title: 'Touchless Record Scan', body: 'Patients upload prescriptions and lab reports from their phone; values are extracted into a lab matrix.' },
            { icon: 'stethoscope', title: 'Physician EMR Workstation', body: 'P1–P4 queue, disease timeline, editable 3-pillar Pariksha, Rx builder and A4 case sheet.' },
          ].map(c => (
            <div key={c.title} className="bg-stone-900/95 p-5 flex flex-col gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[24px]">{c.icon}</span>
              <h3 className="text-sm font-semibold text-stone-100">{c.title}</h3>
              <p className="text-sm leading-relaxed text-stone-400">{c.body}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Status footer */}
      <footer className="border-t border-stone-800 bg-stone-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />ABDM FHIR R4 Ready</span>
            <span aria-hidden="true">•</span>
            <span>DPDP Act 2023 Ephemeral Protocol</span>
            <span aria-hidden="true">•</span>
            <span>Ministry of AYUSH Aligned</span>
          </p>
          <p className="text-stone-600">{BRAND.name} · <span className="font-serif">{BRAND.devanagari}</span> Clinical HealthOS · Prototype</p>
        </div>
      </footer>
    </div>
  );
}
