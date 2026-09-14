import palette from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/*
 * VRRTANT dual-palette theme: "Aged Sheesham & Espresso" (html.dark) and
 * "Bhojpatra Parchment & Ayur-Linen" (light).
 *
 * Components are written dark-first with plain Tailwind classes (bg-stone-900,
 * text-amber-500, bg-emerald-700 …). Instead of adding a `dark:` twin to every class,
 * each of those colour scales resolves through a CSS variable:
 *   - dark  → Tailwind's own shade (so the dark theme is exactly what is designed)
 *   - light → a readable counterpart on ivory, chosen per shade below
 * The design tokens (surface, primary …) follow the same mechanism.
 * ThemeContext toggles `html.dark`; the pre-paint script in index.html sets it first.
 */

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Neutral stone flips end to end: canvas ↔ ink, cards ↔ headings.
const STONE_LIGHT = {
  50: '#0c0a09', 100: '#1c1917', 200: '#292524', 300: '#44403c', 400: '#57534e', 500: '#78716c',
  600: '#a8a29e', 700: '#d6d3d1', 800: '#e7e5e4', 900: '#ffffff', 950: '#faf8f5',
};
const STONE_DARK = { ...palette.stone, 950: '#0f0d0b' };

// Accents in dark-first code: 100–500 are text on dark → deep shades on ivory;
// 600–800 are fills/borders → stay deep; 900–950 are dark tints → pale washes.
const ACCENT_LIGHT_SHADE = {
  50: '950', 100: '900', 200: '800', 300: '800', 400: '700', 500: '700',
  600: '700', 700: '800', 800: '800', 900: '100', 950: '50',
};
const ACCENTS = ['amber', 'emerald', 'rose', 'orange', 'sky', 'violet', 'red', 'green', 'teal'];

// Semantic tokens used by the modals and secondary screens: [dark, light].
const TOKENS = {
  primary: ['#059669', '#047857'],
  'on-primary': ['#ffffff', '#ffffff'],
  'primary-container': ['#047857', '#065f46'],
  'on-primary-container': ['#d1fae5', '#d1fae5'],
  'primary-fixed': ['#064e3b', '#d1fae5'],
  'primary-fixed-dim': ['#34d399', '#6ee7b7'],
  'on-primary-fixed': ['#d1fae5', '#022c22'],
  'on-primary-fixed-variant': ['#6ee7b7', '#065f46'],
  'inverse-primary': ['#047857', '#6ee7b7'],
  'surface-tint': ['#059669', '#047857'],

  secondary: ['#f59e0b', '#92400e'],
  'on-secondary': ['#1c1917', '#ffffff'],
  'secondary-container': ['#451a03', '#fef3c7'],
  'on-secondary-container': ['#fcd34d', '#78350f'],
  'secondary-fixed': ['#3b2208', '#fef3c7'],
  'secondary-fixed-dim': ['#d97706', '#fcd34d'],
  'on-secondary-fixed': ['#fef3c7', '#451a03'],
  'on-secondary-fixed-variant': ['#fcd34d', '#92400e'],

  tertiary: ['#8fb996', '#3f6b4a'],
  'on-tertiary': ['#0f0d0b', '#ffffff'],
  'tertiary-container': ['#1f3a2b', '#dcebdd'],
  'on-tertiary-container': ['#c7e3cc', '#1f3a2b'],
  'tertiary-fixed': ['#1f3a2b', '#dcebdd'],
  'tertiary-fixed-dim': ['#8fb996', '#8fb996'],
  'on-tertiary-fixed': ['#dcfce7', '#0f2417'],
  'on-tertiary-fixed-variant': ['#bbf7d0', '#2f5639'],

  error: ['#f87171', '#b91c1c'],
  'on-error': ['#1c1917', '#ffffff'],
  'error-container': ['#4c0519', '#ffe4e6'],
  'on-error-container': ['#fecdd3', '#881337'],

  background: ['#0f0d0b', '#faf8f5'],
  'on-background': ['#f5f5f4', '#1c1917'],
  surface: ['#0f0d0b', '#faf8f5'],
  'surface-bright': ['#292524', '#ffffff'],
  'surface-dim': ['#0c0a09', '#e7e5e4'],
  'surface-container-lowest': ['#1c1917', '#ffffff'],
  'surface-container-low': ['#231f1c', '#f5f2ec'],
  'surface-container': ['#292524', '#efebe4'],
  'surface-container-high': ['#312c28', '#e9e4db'],
  'surface-container-highest': ['#44403c', '#ded8cc'],
  'surface-variant': ['#292524', '#efebe4'],
  'on-surface': ['#f5f5f4', '#1c1917'],
  'on-surface-variant': ['#a8a29e', '#57534e'],
  outline: ['#78716c', '#78716c'],
  'outline-variant': ['#44403c', '#d6d3d1'],
  'inverse-surface': ['#e7e5e4', '#292524'],
  'inverse-on-surface': ['#1c1917', '#fafaf9'],
};

const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const rgbVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const colors = {};
const lightVars = {};
const darkVars = {};

colors.stone = {};
for (const s of SHADES) {
  colors.stone[s] = rgbVar(`stone-${s}`);
  lightVars[`--stone-${s}`] = channels(STONE_LIGHT[s]);
  darkVars[`--stone-${s}`] = channels(STONE_DARK[s]);
}
for (const accent of ACCENTS) {
  colors[accent] = {};
  for (const s of SHADES) {
    colors[accent][s] = rgbVar(`${accent}-${s}`);
    lightVars[`--${accent}-${s}`] = channels(palette[accent][ACCENT_LIGHT_SHADE[s]]);
    darkVars[`--${accent}-${s}`] = channels(palette[accent][s]);
  }
}
for (const [name, [dark, light]] of Object.entries(TOKENS)) {
  colors[name] = rgbVar(`c-${name}`);
  lightVars[`--c-${name}`] = channels(light);
  darkVars[`--c-${name}`] = channels(dark);
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...lightVars, colorScheme: 'light' },
        '.dark': { ...darkVars, colorScheme: 'dark' },
      });
    }),
  ],
  theme: {
    extend: {
      colors,
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        'gutter-md': '1rem',
        'margin-desktop': '3.5rem',
        'gutter-xs': '0.25rem',
        'gutter-xl': '2rem',
        'gutter-2xl': '3rem',
        'margin-tablet': '2rem',
        'gutter-sm': '0.5rem',
        'margin-mobile': '1rem',
        'gutter-lg': '1.5rem',
      },
      fontFamily: {
        // AYUSH terminology accents; numbers and lab values stay in the sans stack.
        serif: ['Source Serif 4', 'Georgia', 'serif'],
        'label-md': ['Plus Jakarta Sans', 'sans-serif'],
        'label-lg': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-lg-mobile': ['Source Serif 4', 'serif'],
        'body-md': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-lg': ['Source Serif 4', 'serif'],
        'label-sm': ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Source Serif 4', 'serif'],
        'body-lg': ['Plus Jakarta Sans', 'sans-serif'],
        'body-sm': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-md': ['Source Serif 4', 'serif'],
        'title-md': ['Plus Jakarta Sans', 'sans-serif'],
        'display-mobile': ['Source Serif 4', 'serif'],
        'headline-sm': ['Plus Jakarta Sans', 'sans-serif'],
      },
      fontSize: {
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '0em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'label-sm': ['10px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '700' }],
        display: ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-md': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'display-mobile': ['36px', { lineHeight: '44px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
      },
    },
  },
}
