import { useState } from 'react';

export default function AuthPortal({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('patient');
  const [lang, setLang] = useState('en');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [doctorRegId, setDoctorRegId] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');

  const DEMO_REG_ID = 'AYUSH-DEMO';
  const DEMO_PASSWORD = 'doctor123';

  const handleOtp = (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setTimeout(() => { setOtpLoading(false); setOtpSent(true); }, 700);
  };

  const handleDoctorLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (doctorRegId.trim() === DEMO_REG_ID && doctorPassword === DEMO_PASSWORD) {
      onNavigate('doctor');
    } else {
      setLoginError(`Invalid credentials. Use demo account: ID = "${DEMO_REG_ID}", Password = "${DEMO_PASSWORD}"`);
    }
  };

  return (
    <section className="w-full relative overflow-hidden py-10 px-4 sm:px-6 lg:px-margin-desktop">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none"></div>
      <div className="max-w-5xl mx-auto flex flex-col items-center">

        {/* Top Micro Notice */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm shadow-sm mb-6">
          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
          <span>Unified Traditional &amp; Allopathic Medical Intake System</span>
          <span className="w-1 h-1 rounded-full bg-primary/40"></span>
          <span className="text-on-surface-variant font-label-sm">NAM/ABDM Gateway</span>
        </div>

        {/* Main Dual Panel Card */}
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">

          {/* Header Strip */}
          <div className="p-6 sm:p-8 bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm flex-shrink-0 relative overflow-hidden">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 6C24 6 20 16 13 18C6 20 6 29 11 34C16 39 24 42 24 42C24 42 32 39 37 34C42 29 42 20 35 18C28 16 24 6 24 6Z" fill="currentColor" fillOpacity="0.25" />
                  <path d="M24 10C24 10 21 18 16 20C11 22 10.5 28 14.5 32C18.5 36 24 38 24 38C24 38 29.5 36 33.5 32C37.5 28 37 22 32 20C27 18 24 10 24 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  <path d="M24 18V34M24 24C21.5 22.5 19 23 18 24.5M24 28C26.5 26.5 29 27 30 28.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent"></div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">AYUSH CareBridge</h1>
                  <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">M2 Ready</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Integrative AI Triage &amp; Clinical Intake Portal</p>
              </div>
            </div>

            {/* Language Pill */}
            <div className="inline-flex items-center bg-surface-container rounded-full p-1 self-end sm:self-auto shadow-sm">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 ${lang === 'en' ? 'bg-surface-container-lowest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {lang === 'en' && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
                English
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded-full font-label-md text-label-md transition-all ${lang === 'hi' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                हिंदी
              </button>
            </div>
          </div>

          {/* Role Toggle Tabs */}
          <div className="px-6 sm:px-8 pt-6 pb-2">
            <div className="w-full bg-surface-container p-1.5 rounded-xl grid grid-cols-2 gap-1.5 max-w-lg mx-auto">
              <button
                onClick={() => setActiveTab('patient')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-title-md text-body-lg shadow-sm transition-all duration-200 ${activeTab === 'patient' ? 'bg-surface-container-lowest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                <span className="font-label-lg text-label-lg">Patient Portal</span>
              </button>
              <button
                onClick={() => setActiveTab('doctor')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-title-md text-body-lg transition-all duration-200 ${activeTab === 'doctor' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">medical_services</span>
                <span className="font-label-lg text-label-lg">AYUSH Doctor Login</span>
              </button>
            </div>
          </div>

          {/* Patient Tab */}
          {activeTab === 'patient' && (
            <div className="p-6 sm:p-8 pt-4 transition-all duration-300">
              <div className="max-w-xl mx-auto flex flex-col items-center text-center">
                <div className="mb-6">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Instant Consultation &amp; AI Symptom Intake</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
                    Connect with verified Ayurveda, Yoga &amp; Naturopathy, Unani, Siddha, and Homeopathy specialists.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8">
                  {['Ayurveda','Yoga & Naturopathy','Unani','Siddha','Homeopathy'].map(m => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">{m}</span>
                  ))}
                </div>
                <form className="w-full text-left space-y-4" onSubmit={handleOtp}>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1.5" htmlFor="mobile-number">
                      Registered Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center gap-1.5 pr-2 pointer-events-none">
                        <span aria-hidden="true" className="text-[18px]">🇮🇳</span>
                        <span className="font-label-lg text-label-lg text-on-surface">+91</span>
                        <span className="w-px h-4 bg-surface-container-highest"></span>
                      </div>
                      <input className="w-full pl-24 pr-4 py-3 bg-surface-container-low focus:bg-surface-container-lowest rounded-xl font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant/60 transition-all outline-none focus:ring-2 focus:ring-primary shadow-inner" id="mobile-number" maxLength="10" pattern="[0-9]{10}" placeholder="Enter 10-digit mobile number" required type="tel" />
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary text-[14px]">info</span>
                      An OTP will be sent to this number for encrypted verification.
                    </p>
                  </div>
                  <button
                    className="w-full py-3.5 px-6 rounded-xl bg-primary-container hover:bg-primary text-on-primary-container font-label-lg text-label-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
                    type="submit"
                    disabled={otpLoading}
                  >
                    {otpLoading ? (
                      <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Sending Code...</span></>
                    ) : otpSent ? (
                      <><span className="material-symbols-outlined text-[18px]">done</span><span>OTP Sent!</span></>
                    ) : (
                      <><span>Get OTP</span><span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                    )}
                  </button>
                  {otpSent && (
                    <div className="p-3 rounded-xl bg-surface-container text-primary font-body-sm text-body-sm text-center">
                      OTP sent successfully! Enter code <strong>739201</strong> to proceed to tele-triage.
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">or</span>
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-4 transition-colors hover:bg-surface-container">
                    <button className="w-full text-left flex items-start justify-between gap-3" type="button" onClick={() => onNavigate('patient')}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-highest text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[18px]">emergency</span>
                        </div>
                        <div>
                          <span className="font-title-md text-title-md text-on-surface block">Continue as Guest / One-Time Consultation</span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant block mt-0.5">
                            Quick 2-minute emergency intake without registration.
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px] mt-1">chevron_right</span>
                    </button>
                  </div>
                  <div className="pt-2 text-center">
                    <button className="inline-flex items-center gap-1.5 text-primary hover:text-on-surface font-label-md text-label-md transition-colors" type="button">
                      <span className="material-symbols-outlined text-[18px]">credit_card</span>
                      <span>Or link directly with 14-digit ABHA (Health ID)</span>
                    </button>
                  </div>
                </form>
                <div className="mt-8 pt-6 border-t border-surface-container flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-on-surface-variant font-label-sm text-label-sm">
                  <span className="inline-flex items-center gap-1 text-primary">
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                    ABDM &amp; Data Privacy Compliant
                  </span>
                  <span className="w-1 h-1 rounded-full bg-surface-container-highest"></span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">health_and_safety</span>
                    100% Free Public &amp; Certified Service
                  </span>
                  <span className="w-1 h-1 rounded-full bg-surface-container-highest"></span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
                    End-to-End Encrypted
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Doctor Tab */}
          {activeTab === 'doctor' && (
            <div className="p-6 sm:p-8 pt-4 transition-all duration-300">
              <div className="max-w-xl mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-sm text-label-sm mb-2">
                    <span className="material-symbols-outlined text-[14px]">shield_person</span>
                    <span>National Medical Council AYUSH Registry Verified</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Practitioner Tele-Triage Desk</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Authorized access for Registered Vaidyas, Hakims, Siddha Physicians, and Homeopaths.
                  </p>
                </div>
                <form className="space-y-4" onSubmit={handleDoctorLogin}>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1.5" htmlFor="council-select">
                      Governing State Council / National Commission
                    </label>
                    <div className="relative">
                      <select className="w-full px-4 py-3 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer" id="council-select">
                        <option>NCISM - National Commission for Indian System of Medicine</option>
                        <option>NCH - National Commission for Homoeopathy</option>
                        <option>Central Council of Indian Medicine (CCIM Archive)</option>
                        <option>Delhi Bharatiya Chikitsa Parishad (DBCP)</option>
                        <option>State Ayurvedic and Unani Medical Board (UP/Bihar)</option>
                        <option>Tamil Nadu Board of Indian Medicine (Siddha)</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-3.5 text-on-surface-variant pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1.5" htmlFor="doctor-reg-id">
                      Practitioner Registration ID / State Council Number
                    </label>
                    <div className="relative">
                      <input className="w-full pl-11 pr-4 py-3 bg-surface-container-low focus:bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-2 focus:ring-primary transition-all" id="doctor-reg-id" placeholder="Demo: AYUSH-DEMO" required type="text" value={doctorRegId} onChange={e => setDoctorRegId(e.target.value)} />
                      <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]">badge</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-label-md text-label-md text-on-surface" htmlFor="doctor-password">Password / Secure Passkey</label>
                      <a className="font-label-sm text-label-sm text-secondary hover:underline" href="#">Forgot Council PIN?</a>
                    </div>
                    <div className="relative">
                      <input className="w-full pl-11 pr-11 py-3 bg-surface-container-low focus:bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-2 focus:ring-primary transition-all" id="doctor-password" placeholder="Demo: doctor123" required type={showPass ? 'text' : 'password'} value={doctorPassword} onChange={e => setDoctorPassword(e.target.value)} />
                      <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]">key</span>
                      <button className="absolute right-3.5 top-3.5 text-on-surface-variant hover:text-on-surface" onClick={() => setShowPass(p => !p)} type="button">
                        <span className="material-symbols-outlined text-[20px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                  {loginError && (
                    <div className="bg-error-container/30 text-on-error-container rounded-xl px-4 py-3 font-body-sm text-body-sm flex items-start gap-2">
                      <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">error</span>
                      <span>{loginError}</span>
                    </div>
                  )}
                  <div className="bg-surface-container rounded-xl px-4 py-2.5 font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0">info</span>
                    <span>Demo credentials — ID: <strong className="text-on-surface">AYUSH-DEMO</strong> &nbsp;|&nbsp; Password: <strong className="text-on-surface">doctor123</strong></span>
                  </div>
                  <div className="pt-2">
                    <button className="w-full py-3.5 px-6 rounded-xl bg-inverse-surface hover:bg-black text-inverse-on-surface font-label-lg text-label-lg shadow-sm transition-all flex items-center justify-center gap-2" type="submit">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>Secure Clinical Portal Login</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">or biometric token</span>
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                  </div>
                  <button className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-2" type="button">
                    <span className="material-symbols-outlined text-primary text-[20px]">fingerprint</span>
                    <span>Verify with Aadhaar OTP or Biometric WebAuthn</span>
                  </button>
                  <div className="pt-4 text-center">
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      New practitioner?{' '}
                      <a className="text-primary font-label-md text-label-md hover:underline ml-1" href="#">
                        Register as Accredited AYUSH Practitioner under NAM
                      </a>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Trust Badges Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-secondary-fixed/30 rounded-2xl p-5 sm:p-6 flex items-start gap-4 shadow-sm relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-md text-title-md text-on-secondary-fixed">Emergency Surgical Triage Protection</h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm">Red Flag AI</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-secondary-fixed-variant mt-1 leading-relaxed">
                Smart automated AI screening detects acute surgical, cardiac, or pediatric red flags, instantly redirecting critical cases to the nearest tertiary allopathic trauma center.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-2xl p-5 sm:p-6 flex items-start gap-4 shadow-sm relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[24px]">medication_liquid</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-md text-title-md text-on-surface">Herbal-Pharmaceutical Safety Check</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">AYUSH-Rx Cross-Map</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                Real-time cross-referencing between Classical Pharmacopoeia and contemporary allopathic pharmaceuticals prevents adverse herb-drug reactions.
              </p>
            </div>
          </div>
        </div>

        {/* National Impact */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-8 mt-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: 'diversity_1', stat: '1.2M+', label: 'Rural Intakes Completed', sub: 'Through Village Ayush Health & Wellness Centres (AHWCs)' },
              { icon: 'local_hospital', stat: '42,000+', label: 'Certified AYUSH Clinicians', sub: 'Verified via National Council Registries' },
              { icon: 'hub', stat: '28 States & UTs', label: 'ABDM Network Live', sub: 'Instant interoperability with Ayushman Bharat IDs' },
            ].map(({ icon, stat, label, sub }) => (
              <div key={stat} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2">
                  <span className="material-symbols-outlined text-[22px]">{icon}</span>
                </div>
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight">{stat}</span>
                <span className="font-title-md text-title-md text-on-surface mt-0.5">{label}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
