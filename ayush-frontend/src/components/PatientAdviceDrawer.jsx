import React, { useState } from 'react';

export default function PatientAdviceDrawer({ 
  isOpen = true, 
  onClose, 
  patientData = {}, 
  initialLang = 'en' 
}) {
  const [lang, setLang] = useState(initialLang);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const priority = patientData?.priority || 'P1';
  const isEmergency = priority === 'P1' || patientData?.surgicalAlert;
  const zoomUrl = patientData?.zoomUrl || 'https://zoom.us/j/demo-ayush-telehealth';

  const copyZoom = () => {
    navigator.clipboard.writeText(zoomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const t = {
    en: {
      subBadge: "ABDM Integrated Facility • MoA Triage Protocol",
      drawerTitle: "Personalized Ayush Clinical Advice",
      drawerSub: "Post-Triage Guidance & Pathya-Apathya Regimen",
      emergencyNotice: "Emergency Medical Notice / आपातकालीन सूचना",
      emergencyDesc: "Severe acute abdominal pain or surgical symptoms detected. Immediate allopathic emergency evaluation is advised before undergoing intensive therapies.",
      call108: "Call 108 • तुरंत संपर्क करें",
      stableNotice: "Triage Evaluation Completed",
      stableDesc: "Your clinical intake and doshic markers have been successfully logged. Please review immediate supportive measures below.",
      zoomHeader: "Active AYUSH Tele-Consultation Desk",
      zoomSub: "Live Video Session with Attending Physician",
      joinZoom: "Join Video Consult (परामर्श शुरू करें)",
      copyLink: "Copy Link",
      copied: "Copied!",
      triageSummary: "Triage & Doshic Analysis Summary",
      doshaTitle: "Assessed Prakriti / Vikriti Tendency",
      agniLabel: "Agni (Appetite):",
      koshthaLabel: "Koshtha (Bowels):",
      pathyaHeading: "Pathya (Recommended Regimen / क्या करें)",
      apathyaHeading: "Apathya (Strict Avoidance / क्या न करें)",
      pathyaItems: [
        "Sip lukewarm boiled water (Ushnodaka) at regular intervals to kindle digestion.",
        "Consume light, warm Moong Dal soup or Mandodaka (rice water).",
        "Maintain complete physical rest; avoid strenuous forward bends or abdominal pressure.",
        "Continue taking all your prescribed allopathic medications (e.g., Metformin, BP meds) without interruption."
      ],
      apathyaItems: [
        "Avoid heavy, deeply fried, oily, overly sour, or pungent foods.",
        "Strictly avoid cold refrigerated drinks, ice, and heavy fermented curd/dairy.",
        "Do not suppress natural physiological urges (Vega Dharana like flatus, micturition).",
        "Do not apply deep vigorous abdominal massage or heat packs without doctor consent."
      ],
      safetyNote: "Clinical Safety Note: These guidelines are supportive pre-consultation recommendations. Final diagnosis, Panchakarma procedures, and herbal formulations will be finalized by your physician during tele-consultation.",
      printBtn: "Print Clinical Advice",
      closeBtn: "Close / बंद करें"
    },
    hi: {
      subBadge: "ABDM एकीकृत सुविधा • आयुष मंत्रालय ट्रायज प्रोटोकॉल",
      drawerTitle: "व्यक्तिगत आयुष स्वास्थ्य परामर्श",
      drawerSub: "ट्रायज उपरांत परामर्श एवं पथ्य-अपथ्य व्यवस्था",
      emergencyNotice: "आपातकालीन चिकित्सा सूचना / Emergency Notice",
      emergencyDesc: "तीव्र उदर शूल अथवा आपातकालीन लक्षण पाए गए हैं। सघन आयुर्वेदिक चिकित्सा से पूर्व निकटतम अस्पताल अथवा एलोपैथिक चिकित्सक से तत्काल परामर्श लें।",
      call108: "108 पर कॉल करें • Call 108",
      stableNotice: "ट्रायज मूल्यांकन पूर्ण हुआ",
      stableDesc: "आपके प्राथमिक लक्षण एवं दोषीय विवरण दर्ज कर लिए गए हैं। कृपया वीडियो परामर्श शुरू होने तक नीचे दी गई सावधानियों का पालन करें।",
      zoomHeader: "सक्रिय आयुष टेली-कंसल्टेशन डेस्क",
      zoomSub: "उपलब्ध चिकित्सक के साथ सीधा वीडियो परामर्श",
      joinZoom: "परामर्श शुरू करें (Join Zoom)",
      copyLink: "लिंक कॉपी करें",
      copied: "कॉपी हो गया!",
      triageSummary: "ट्रायज एवं दोषीय विश्लेषण सारांश",
      doshaTitle: "मूल्यांकित प्रकृति / विकृति प्रवृत्ति",
      agniLabel: "अग्नि (पाचन शक्ति):",
      koshthaLabel: "कोष्ठ (मल निष्कासन):",
      pathyaHeading: "पथ्य (आहार एवं विहार - क्या करें)",
      apathyaHeading: "अपथ्य (वर्ज्य आहार-विहार - क्या न करें)",
      pathyaItems: [
        "नियमित अंतराल पर गुनगुना उबला पानी (उष्णोदक) घूंट-घूंट कर पिएं।",
        "हल्का, सुपाच्य मूंग दाल का यूष या मांड (चावल का पानी) ही ग्रहण करें।",
        "शांत मुद्रा में विश्राम करें, पेट पर दबाव डालने वाले व्यायाम न करें।",
        "अपनी नियमित एलोपैथिक दवाएं (जैसे शुगर/बीपी) बिना नागा समय पर लेते रहें।"
      ],
      apathyaItems: [
        "भारी, तला-भुना, अत्यधिक मिर्च-मसालेदार व खट्टे पदार्थों से बचें।",
        "ठंडा पानी, कोल्ड ड्रिंक, फ्रिज का भोजन और भारी दही का सेवन बिल्कुल न करें।",
        "प्राकृतिक वेगों (मल, मूत्र, छींक, जम्हाई) को कदापि न रोकें।",
        "डॉक्टर की सलाह के बिना पेट पर तीव्र मालिश या गर्म सिकाई न करें।"
      ],
      safetyNote: "क्लिनिकल सुरक्षा सूचना: यह दिशानिर्देश परामर्श-पूर्व प्राथमिक सहायता हेतु हैं। अंतिम चिकित्सा सूत्र, पंचकर्म तथा औषधियां वीडियो कंसल्टेशन के दौरान डॉक्टर द्वारा निर्धारित की जाएंगी।",
      printBtn: "परामर्श प्रिंट करें",
      closeBtn: "बंद करें"
    }
  }[lang];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-on-surface/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col border-l border-outline-variant/40 overflow-y-auto">
        
        {/* Top Header matching AYUSH CareBridge Navbar */}
        <div className="bg-surface-container-lowest border-b border-outline-variant/30 sticky top-0 z-20 p-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">spa</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-title-md text-on-surface tracking-tight">{t.drawerTitle}</h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm hidden sm:inline-block">ABDM M2</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{t.subBadge}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* EN / हिं Language Pill */}
            <div className="inline-flex items-center bg-surface-container rounded-full p-0.5 text-on-surface">
              <button 
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all ${lang === 'en' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLang('hi')}
                className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all ${lang === 'hi' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                हिं
              </button>
            </div>

            {onClose && (
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                title="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1">

          {/* Conditional Emergency Terracotta Banner */}
          {isEmergency ? (
            <div className="w-full bg-secondary-container/25 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-secondary/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">medical_services</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-label-lg text-on-secondary-container font-semibold">
                    {t.emergencyNotice}
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                    {t.emergencyDesc}
                  </p>
                </div>
              </div>
              <a 
                href="tel:108"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:bg-on-secondary-container transition-all flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                <span>{t.call108}</span>
              </a>
            </div>
          ) : (
            <div className="w-full bg-surface-container-low rounded-2xl p-4 shadow-sm flex items-start gap-3 border border-surface-container-highest">
              <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-primary font-semibold">{t.stableNotice}</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t.stableDesc}</p>
              </div>
            </div>
          )}

          {/* Tele-Consultation Live Desk Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high/60 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[22px]">videocam</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">{t.zoomHeader}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{t.zoomSub}</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                Ready
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-surface-container-low">
              <a
                href={zoomUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">video_call</span>
                <span>{t.joinZoom}</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>

              <button
                onClick={copyZoom}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? 'done' : 'content_copy'}
                </span>
                <span>{copied ? t.copied : t.copyLink}</span>
              </button>
            </div>
          </div>

          {/* Doshic & Triage Badges Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface font-semibold">{t.triageSummary}</span>
              <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${
                priority === 'P1' ? 'bg-secondary-container/30 text-secondary' : 'bg-surface-container text-primary'
              }`}>
                Tier: {priority}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-surface-container-low flex items-center gap-2.5 shadow-sm">
                <span className="material-symbols-outlined text-secondary text-[22px]">local_fire_department</span>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{t.agniLabel}</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {patientData?.ayurvedicNotes?.agni || 'Manda (मंदाग्नि)'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-center gap-2.5 shadow-sm">
                <span className="material-symbols-outlined text-primary text-[22px]">water_drop</span>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{t.koshthaLabel}</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {patientData?.ayurvedicNotes?.koshtha || 'Krura (क्रूर कोष्ठ)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pathya & Apathya Two-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pathya (Do's) */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 border-t-2 border-primary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">spa</span>
                <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">{t.pathyaHeading}</h3>
              </div>
              <ul className="space-y-2.5">
                {t.pathyaItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Apathya (Don'ts) */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 border-t-2 border-secondary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">block</span>
                <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">{t.apathyaHeading}</h3>
              </div>
              <ul className="space-y-2.5">
                {t.apathyaItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* API Pharmacopeia / Safety Note */}
          <div className="bg-surface-container-low/80 rounded-2xl p-3.5 shadow-sm flex items-start gap-2.5">
            <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 flex-shrink-0">verified_user</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t.safetyNote}
            </p>
          </div>

        </div>

        {/* Bottom Drawer Actions */}
        <div className="p-4 sm:px-6 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>{t.printBtn}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-all shadow-sm flex items-center gap-1"
            >
              <span>{t.closeBtn}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}