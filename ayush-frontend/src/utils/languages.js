/**
 * Language partitioning for the AYUSH triage prototype.
 *
 *  • Physical kiosk        → all 11 Indic languages (walk-in patients pick their own).
 *  • Teleconsultation call → Hindi + English ONLY (the attending physician has to
 *    follow the call live, so regional languages must never reach it).
 *
 * Codes are Sarvam / BCP-47 style and are passed straight through to
 * `language_code` (STT) and `target_language_code` (TTS).
 */

// Full list of 11 Indic languages for Physical Kiosk intake
export const KIOSK_LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en-IN', name: 'English', native: 'English', flag: '🌐' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'od-IN', name: 'Odia', native: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
];

// Strictly Hindi and English only for Teleconsultation Video/Audio Calls
export const TELECONSULT_LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en-IN', name: 'English', native: 'English', flag: '🌐' },
];

export const DEFAULT_KIOSK_LANG = 'hi-IN';
export const DEFAULT_TELECONSULT_LANG = 'hi-IN';

const KIOSK_CODES = new Set(KIOSK_LANGUAGES.map(l => l.code));
const TELECONSULT_CODES = new Set(TELECONSULT_LANGUAGES.map(l => l.code));

// The legacy 'hi' / 'en' short codes are still used internally for on-screen copy.
const SHORT_TO_FULL = { hi: 'hi-IN', en: 'en-IN' };

/** Normalises 'hi' / 'HI-in' / 'hi-IN' to a supported kiosk code, else the default. */
export function normalizeLang(code, fallback = DEFAULT_KIOSK_LANG) {
  if (!code) return fallback;
  const raw = String(code).trim();
  const full = SHORT_TO_FULL[raw.toLowerCase()] || `${raw.split('-')[0].toLowerCase()}-IN`;
  return KIOSK_CODES.has(full) ? full : fallback;
}

/** True only for the two languages a teleconsult call is allowed to run in. */
export const isTeleconsultLanguage = (code) => TELECONSULT_CODES.has(normalizeLang(code, ''));

/**
 * Hard guard for calls: any regional language that reaches the teleconsult room —
 * from a deep link, a stale session or a future kiosk hand-off — collapses to Hindi
 * rather than putting a language the physician cannot follow on a live call.
 */
export function coerceTeleconsultLang(code, fallback = DEFAULT_TELECONSULT_LANG) {
  const full = normalizeLang(code, fallback);
  return TELECONSULT_CODES.has(full) ? full : fallback;
}

export const languageMeta = (code) =>
  KIOSK_LANGUAGES.find(l => l.code === normalizeLang(code)) || KIOSK_LANGUAGES[0];

/** English name — used to build the Gemini "conduct the conversation in X" instruction. */
export const languageName = (code) => languageMeta(code).name;

export const languageNative = (code) => languageMeta(code).native;

/**
 * Which of the two on-screen copy sets to render. The kiosk UI strings exist in
 * Hindi and English only, so Devanagari languages read the Hindi set (same script)
 * and every other language falls back to English while the SPOKEN prompts and STT
 * still run in the patient's own language.
 */
export const uiVariant = (code) => (['hi-IN', 'mr-IN'].includes(normalizeLang(code)) ? 'hi' : 'en');
