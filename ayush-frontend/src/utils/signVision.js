/**
 * AYUSH SignBridge — client-side sign detection.
 *
 * Adapted from the SignBridge AI reference repo (temp-signbridge):
 *  - MediaPipe Hand Landmarker (tasks-vision, WASM) replaces its Python landmark extractor
 *  - a geometric ISL gesture classifier replaces its server-side BiLSTM (which needs a
 *    Python/FastAPI backend, so it cannot ship inside this kiosk)
 *  - the rolling majority-vote smoother is a direct port of prediction_smoother.py
 *  - the canvas skeleton drawing is a port of utils/landmarkDrawer.ts
 *
 * Everything runs in the browser — no extra backend, no model download beyond the
 * MediaPipe hand model, so the kiosk stays demo-stable.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// ── Hand shape vocabulary ─────────────────────────────────────────────────────
// The classifier reports the SHAPE of the hand, never a clinical meaning — the
// kiosk maps a shape to an answer per wizard stage, so 👍 can mean "good sleep"
// on one screen and "normal digestion" on the next.
export const HAND_SHAPES = {
  OPEN_PALM:   { emoji: '🖐️', en: 'Open palm',              hi: 'खुली हथेली',        hint: 'All five fingers spread' },
  FIST:        { emoji: '✊',  en: 'Closed fist',            hi: 'बंद मुट्ठी',         hint: 'All fingers folded in' },
  THUMBS_UP:   { emoji: '👍', en: 'Thumbs up',              hi: 'अंगूठा ऊपर',        hint: 'Fist with the thumb pointing up' },
  THUMBS_DOWN: { emoji: '👎', en: 'Thumbs down',            hi: 'अंगूठा नीचे',       hint: 'Fist with the thumb pointing down' },
  L_SHAPE:     { emoji: '👆', en: 'Thumb + index',          hi: 'अंगूठा + तर्जनी',    hint: 'L shape — thumb out, index up' },
  SHAKA:       { emoji: '🤙', en: 'Thumb + little finger',  hi: 'अंगूठा + कनिष्ठा',   hint: 'Thumb and little finger extended' },
  POINT:       { emoji: '☝️', en: 'Index finger',           hi: 'तर्जनी',            hint: 'Index finger only, pointing up' },
  VICTORY:     { emoji: '✌️', en: 'Two fingers',            hi: 'दो उंगलियाँ',        hint: 'Index + middle finger up' },
  THREE:       { emoji: '🤟', en: 'Three fingers',          hi: 'तीन उंगलियाँ',       hint: 'Index + middle + ring up' },
  FOUR:        { emoji: '🖖', en: 'Four fingers',           hi: 'चार उंगलियाँ',       hint: 'Four fingers up, thumb tucked' },
  PINKY:       { emoji: '🤞', en: 'Little finger',          hi: 'कनिष्ठा',           hint: 'Little finger only' },
  HORNS:       { emoji: '🤘', en: 'Index + little finger',  hi: 'तर्जनी + कनिष्ठा',   hint: 'Index and little finger up' },
  OK_SIGN:     { emoji: '👌', en: 'OK sign',                hi: 'ठीक का इशारा',      hint: 'Thumb touching index, three fingers up' },
};

export const SHAPE_KEYS = Object.keys(HAND_SHAPES);

export function shapeLabel(shape, lang = 'en') {
  const v = HAND_SHAPES[shape];
  if (!v) return shape;
  return lang === 'hi' ? v.hi : v.en;
}

// ── Landmark geometry ─────────────────────────────────────────────────────────
const TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIPS = { index: 6, middle: 10, ring: 14, pinky: 18 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

/**
 * Extension state of every finger, scale-normalised against palm size so the
 * result is independent of how far the patient stands from the kiosk camera.
 */
function fingerStates(lm) {
  const wrist = lm[0];
  const palm = dist(wrist, lm[9]) || 1e-6;

  const state = {};
  const margins = [];

  for (const finger of ['index', 'middle', 'ring', 'pinky']) {
    const tipD = dist(lm[TIPS[finger]], wrist) / palm;
    const pipD = dist(lm[PIPS[finger]], wrist) / palm;
    const ratio = tipD / (pipD || 1e-6);
    state[finger] = ratio > 1.15;
    margins.push(Math.min(Math.abs(ratio - 1.15) / 0.35, 1));
  }

  // Thumb: measured against the pinky MCP, so it stays valid however the hand is
  // rotated — a tucked thumb crosses the palm and lands closer to the pinky than
  // its own IP joint does, an extended thumb swings away from it.
  const thumbRatio = dist(lm[TIPS.thumb], lm[17]) / (dist(lm[3], lm[17]) || 1e-6);
  state.thumb = thumbRatio > 1.05;
  margins.push(Math.min(Math.abs(thumbRatio - 1.05) / 0.35, 1));

  // Thumb-to-index pinch (OK sign) and vertical thumb orientation.
  state.pinch = dist(lm[TIPS.thumb], lm[TIPS.index]) / palm < 0.42;
  state.thumbUp = (wrist.y - lm[TIPS.thumb].y) / palm > 0.55;
  state.thumbDown = (lm[TIPS.thumb].y - wrist.y) / palm > 0.25;

  const certainty = margins.reduce((a, b) => a + b, 0) / margins.length;
  return { state, certainty };
}

/**
 * Rule-based classifier. Returns { shape, confidence } or null when the hand
 * does not match any known shape.
 */
export function classifyHand(lm) {
  if (!lm || lm.length < 21) return null;

  const { state: s, certainty } = fingerStates(lm);
  const up = ['index', 'middle', 'ring', 'pinky'].filter(f => s[f]).length;
  const confidence = Math.min(0.62 + certainty * 0.36, 0.99);

  let shape = null;

  if (s.pinch && s.middle && s.ring && s.pinky) shape = 'OK_SIGN';
  else if (up === 4 && s.thumb) shape = 'OPEN_PALM';
  else if (up === 4 && !s.thumb) shape = 'FOUR';
  else if (up === 0 && !s.thumb) shape = 'FIST';
  else if (up === 0 && s.thumb && s.thumbUp) shape = 'THUMBS_UP';
  else if (up === 0 && s.thumb && s.thumbDown) shape = 'THUMBS_DOWN';
  else if (s.index && s.pinky && !s.middle && !s.ring) shape = 'HORNS';
  else if (s.thumb && s.index && !s.middle && !s.ring && !s.pinky) shape = 'L_SHAPE';
  else if (s.thumb && s.pinky && !s.index && !s.middle && !s.ring) shape = 'SHAKA';
  else if (up === 1 && s.index) shape = 'POINT';
  else if (up === 1 && s.pinky) shape = 'PINKY';
  else if (up === 2 && s.index && s.middle) shape = 'VICTORY';
  else if (up === 3 && s.index && s.middle && s.ring) shape = 'THREE';

  // A thumb-only fist that is neither clearly up nor down stays unclassified so
  // the smoother never commits an ambiguous yes/no.
  return shape ? { shape, confidence } : null;
}

// ── Prediction smoother (port of backend/app/services/prediction_smoother.py) ──
export function createSmoother({ windowSize = 8, confidenceThreshold = 0.7, cooldownMs = 1200 } = {}) {
  let window = [];
  let lastCommitTime = 0;
  let lastCommittedSign = null;

  const trim = () => { if (window.length > windowSize) window = window.slice(-windowSize); };

  return {
    /** @returns {{sign:string, confidence:number}|null} committed sign, if any */
    push(sign, confidence) {
      if (!sign || confidence < confidenceThreshold) {
        window.push({ sign: '_LOW_CONF_', confidence });
        trim();
        if (!sign) lastCommittedSign = null;   // hand left the frame → allow a repeat
        return null;
      }

      window.push({ sign, confidence });
      trim();
      if (window.length < windowSize) return null;

      // Majority vote across the window
      const counts = new Map();
      for (const p of window) {
        if (p.sign === '_LOW_CONF_') continue;
        counts.set(p.sign, (counts.get(p.sign) || 0) + 1);
      }
      if (!counts.size) return null;

      let best = null;
      let bestCount = 0;
      for (const [s, c] of counts) if (c > bestCount) { best = s; bestCount = c; }
      if (bestCount < Math.floor(windowSize / 2) + 1) return null;

      const now = Date.now();
      if (now - lastCommitTime < cooldownMs) return null;
      if (best === lastCommittedSign) return null;   // duplicate suppression

      const avg = window.filter(p => p.sign === best).reduce((a, p) => a + p.confidence, 0) / bestCount;
      lastCommitTime = now;
      lastCommittedSign = best;
      window = [];
      return { sign: best, confidence: avg };
    },

    /** Fraction of the smoothing window that currently agrees — drives the UI meter. */
    stability() {
      if (!window.length) return 0;
      const counts = new Map();
      for (const p of window) counts.set(p.sign, (counts.get(p.sign) || 0) + 1);
      return Math.max(...counts.values()) / windowSize;
    },

    reset() { window = []; lastCommitTime = 0; lastCommittedSign = null; },
  };
}

// ── Canvas skeleton drawing (port of utils/landmarkDrawer.ts) ─────────────────
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function drawHand(ctx, landmarks, { width, height, mirror = true, primary = true }) {
  if (!landmarks?.length) return;
  const point = (lm) => ({ x: (mirror ? 1 - lm.x : lm.x) * width, y: lm.y * height });
  const dot = primary ? '#00E5FF' : '#FF6090';
  const line = primary ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 96, 144, 0.55)';

  ctx.lineWidth = 3;
  ctx.strokeStyle = line;
  for (const [i, j] of HAND_CONNECTIONS) {
    const a = point(landmarks[i]);
    const b = point(landmarks[j]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const lm of landmarks) {
    const { x, y } = point(lm);
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

// ── MediaPipe wrapper (port of services/mediapipe.ts, hands only) ─────────────
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class SignVision {
  constructor() {
    this.landmarker = null;
    this.ready = false;
    this.lastTimestamp = -1;
  }

  async initialize() {
    if (this.ready) return true;
    const build = async (delegate) => {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    };

    try {
      this.landmarker = await build('GPU');
    } catch (gpuErr) {
      console.warn('[SignBridge] GPU delegate unavailable, retrying on CPU:', gpuErr?.message);
      this.landmarker = await build('CPU');
    }
    this.ready = true;
    return true;
  }

  /** @returns {{hands: Array<Array>, prediction: {shape,confidence}|null}} */
  detect(video, timestamp) {
    if (!this.ready || !video || video.readyState < 2) return { hands: [], prediction: null };

    // MediaPipe rejects non-monotonic timestamps — nudge past the previous one.
    const ts = timestamp <= this.lastTimestamp ? this.lastTimestamp + 1 : timestamp;
    this.lastTimestamp = ts;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, ts);
    } catch {
      return { hands: [], prediction: null };   // frame jitter — skip silently
    }

    const hands = result?.landmarks || [];
    let prediction = null;
    for (const hand of hands) {
      const guess = classifyHand(hand);
      if (guess && (!prediction || guess.confidence > prediction.confidence)) prediction = guess;
    }
    return { hands, prediction };
  }

  close() {
    try { this.landmarker?.close(); } catch { /* already released */ }
    this.landmarker = null;
    this.ready = false;
    this.lastTimestamp = -1;
  }
}
