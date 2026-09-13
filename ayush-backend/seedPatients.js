// Standard OPD records written into data/patients.json the first time the server
// boots with no data file. After that the file is the source of truth, so a record
// the physician deletes stays deleted across restarts.

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

function opdRecord(r) {
  const triageResult = {
    chiefComplaint: r.chiefComplaint,
    triageLevel: r.triageLevel,
    triageLabel: r.triageLabel,
    surgicalAlert: false,
    geneticAlert: false,
    dosha: r.dosha,
    agni: r.agni,
    koshtha: r.koshtha,
    redFlags: r.redFlags || 'None',
    meds: r.meds || 'None',
    labs: 'None',
    recommendation: r.recommendation,
    diagnosticCorrelation: 'No prior records available for correlation.',
    ayurvedicNotes: { agni: r.agni, koshtha: r.koshtha },
    diseaseTimeline: r.diseaseTimeline,
  };
  return {
    id: r.token,
    patientId: r.token,
    token: r.token,
    name: r.name,
    age: r.age,
    gender: r.gender,
    phone: r.phone,
    symptoms: r.symptoms,
    sleep_stress: r.sleep_stress,
    energy_lifestyle: r.energy_lifestyle,
    chronic_history: r.chronic_history,
    triageSource: 'OPD Registration Desk',
    lang: 'hi-IN',
    documents: null,
    followups: r.followups,
    timestamp: r.timestamp,
    status: 'WAITING',
    ...triageResult,
    triageResult,
  };
}

function seedPatients() {
  return [
    opdRecord({
      token: 'OPD-2026-101',
      name: 'Rajesh Kumar Sharma', age: '48', gender: 'Male', phone: '9876543210',
      timestamp: hoursAgo(3),
      chiefComplaint: 'Epigastric burning & acid regurgitation for 3 weeks',
      symptoms: 'Burning sensation in the upper abdomen with sour belching and acid coming up into the throat for 3 weeks, worse after spicy meals and late dinners.',
      triageLevel: 'P3', triageLabel: 'Moderate',
      dosha: 'Pitta-Vata', agni: 'Tikshnagni', koshtha: 'Krura',
      sleep_stress: 'Wakes at night with heartburn 2–3 times a week; work-related stress.',
      energy_lifestyle: 'Irregular meal timings, frequent tea and spicy food; normal energy.',
      chronic_history: 'No pre-existing conditions',
      recommendation: 'Features suggest Amlapitta with Pitta aggravation; assess for alarm features (dysphagia, weight loss, melena) before starting Pitta-pacifying management. Advise regular meal timings and avoidance of spicy, fried and fermented food.',
      followups: [
        { question: 'Does the burning get worse after meals or when lying down at night?', answer: 'Worse after spicy food and when I lie down after dinner.' },
        { question: 'How are your bowel movements — regular, hard, or loose?', answer: 'Hard stools, once every one or two days.' },
      ],
      diseaseTimeline: [
        { timeframe: '3 weeks ago', event: 'Onset of mild heartburn after heavy and spicy meals', status: 'Mild' },
        { timeframe: '1 week ago', event: 'Daily sour belching (Amla Udgara) with acid regurgitation', status: 'Worsening' },
        { timeframe: 'Present', event: 'Persistent epigastric burning, night-time heartburn, hard stools', status: 'Moderate' },
      ],
    }),
    opdRecord({
      token: 'OPD-2026-102',
      name: 'Sunita Devi', age: '54', gender: 'Female', phone: '9812345678',
      timestamp: hoursAgo(2),
      chiefComplaint: 'Bilateral knee joint pain and morning stiffness (Janu Sandhigata Vata)',
      symptoms: 'Pain in both knees with morning stiffness lasting about 30 minutes, difficulty climbing stairs, and mild swelling for 2 months.',
      triageLevel: 'P3', triageLabel: 'Moderate',
      dosha: 'Vata Dominant', agni: 'Mandagni', koshtha: 'Madhyama',
      sleep_stress: 'Sleep disturbed by knee pain on turning at night.',
      energy_lifestyle: 'Sedentary; tires easily by evening, low water intake.',
      chronic_history: 'No pre-existing conditions',
      recommendation: 'Presentation is consistent with Janu Sandhigata Vata; examine for crepitus, effusion and deformity and consider knee X-ray if not done. Vata-pacifying regimen with guided joint mobility exercises is advised.',
      followups: [
        { question: 'Is the stiffness worse in the morning, and how long does it last?', answer: 'Yes, mornings are worst, about half an hour.' },
        { question: 'Does cold weather or climbing stairs make the pain worse?', answer: 'Stairs make it much worse, and cold mornings too.' },
      ],
      diseaseTimeline: [
        { timeframe: '2 months ago', event: 'Mild stiffness in both knees on waking', status: 'Mild' },
        { timeframe: '3 weeks ago', event: 'Difficulty climbing stairs; pain on prolonged standing', status: 'Worsening' },
        { timeframe: 'Present', event: 'Bilateral knee swelling and pain with 30-minute morning stiffness', status: 'Moderate' },
      ],
    }),
    opdRecord({
      token: 'OPD-2026-103',
      name: 'Amit Verma', age: '29', gender: 'Male', phone: '9701234567',
      timestamp: hoursAgo(1),
      chiefComplaint: 'Allergic rhinitis with productive morning cough (Kaphaja Kasa)',
      symptoms: 'Sneezing and watery eyes followed by nasal congestion and a productive cough with white sputum, worst in the early morning, for 10 days.',
      triageLevel: 'P4', triageLabel: 'Routine',
      dosha: 'Kapha-Vata', agni: 'Sama', koshtha: 'Madhyama',
      sleep_stress: 'Sleep mildly disturbed by nasal blockage.',
      energy_lifestyle: 'Normal energy; commutes daily through dusty traffic.',
      chronic_history: 'Respiratory / Allergy — seasonal dust allergy',
      redFlags: 'None',
      recommendation: 'Consistent with Kaphaja Pratishyaya progressing to Kaphaja Kasa; confirm no fever, wheeze or breathlessness. Kapha-reducing diet, steam inhalation and allergen avoidance are advised.',
      followups: [
        { question: 'What colour is the phlegm, and do you have any fever?', answer: 'White phlegm, no fever.' },
        { question: 'Is the cough worse in the morning or around dust?', answer: 'Mostly in the morning and when I travel in dust.' },
      ],
      diseaseTimeline: [
        { timeframe: '10 days ago', event: 'Sneezing bouts and watery eyes after dust exposure', status: 'Mild' },
        { timeframe: '4 days ago', event: 'Nasal congestion and post-nasal drip', status: 'Worsening' },
        { timeframe: 'Present', event: 'Persistent productive morning cough with white sputum; no fever', status: 'Moderate' },
      ],
    }),
  ];
}

module.exports = { seedPatients };
