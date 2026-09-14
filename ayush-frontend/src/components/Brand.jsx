import { useTheme } from '../context/ThemeContext';
import { BRAND, OFFICIAL_BADGE_TEXT } from '../utils/brand';

// VRRTANT brand primitives, shared by every top bar so the name, official badge and
// theme switch read identically across the platform.

/** The standard institutional badge. */
export function OfficialBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-amber-600/40 bg-amber-500/10 text-amber-400 text-[11px] font-semibold tracking-wide whitespace-nowrap ${className}`}>
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified</span>
      <span className="hidden sm:inline">{OFFICIAL_BADGE_TEXT}</span>
      <span className="sm:hidden">GOVT OF INDIA · MINISTRY OF AYUSH</span>
    </span>
  );
}

/** Slim strip anchored above each navigation bar, carrying the official badge. */
export function OfficialStrip() {
  return (
    <div className="border-b border-stone-800 bg-stone-950">
      <div className="h-0.5 bg-gradient-to-r from-amber-600/80 via-amber-500/40 to-emerald-700/80" />
      <div className="px-4 sm:px-6 py-1 flex items-center justify-between gap-3">
        <OfficialBadge />
        <span className="hidden md:inline text-[11px] text-stone-500 truncate">
          <span className="font-serif text-stone-400">{BRAND.taglineHi}</span> · {BRAND.taglineEn}
        </span>
      </div>
    </div>
  );
}

/** Wordmark: VRRTANT + वृत्तान्त, with an optional context line (e.g. "Voice AI Kiosk"). */
export function BrandMark({ context, compact = false }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-9 h-9 shrink-0 rounded-full border border-amber-600/50 bg-amber-500/10 text-amber-500 flex items-center justify-center font-serif text-[17px] leading-none" aria-hidden="true">वृ</span>
      <div className="leading-tight min-w-0">
        <p className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[15px] font-bold tracking-[0.14em] text-stone-100">{BRAND.name}</span>
          <span className="font-serif text-[15px] text-amber-500">{BRAND.devanagari}</span>
        </p>
        {!compact && (
          <p className="text-[11px] text-stone-400 truncate">{context || 'Clinical HealthOS'}</p>
        )}
      </div>
    </div>
  );
}

/** Theme switch pill: names the theme it will switch TO. */
export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === 'dark';
  const label = toLight ? 'Bhojpatra Light / हल्का थीम' : 'Sheesham Dark / गहरा थीम';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${label}`}
      title={`Switch to ${label}`}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-600/60 hover:text-amber-400 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${className}`}
    >
      <span aria-hidden="true">{toLight ? '☀️' : '🌙'}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
