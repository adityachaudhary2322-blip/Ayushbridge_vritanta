/**
 * Strips hesitation fillers ("uhh", "umm", "actually", "matlab") from a spoken answer
 * so only the clinical content is shown and stored. Mirrors cleanUtterance() in the
 * backend. Delimiters are explicit because \b does not work with Devanagari.
 */
const FILLER_RE = /(^|[\s,.;!?।])(?:u+h+m*|u+m+|h+m+|e+r+m+|a+h+|actually|basically|you know|i mean|matlab|yaani|अ+ं+|उ+म्+|ह+म्+|मतलब|यानी)(?=$|[\s,.;!?।])/gi;

export function cleanUtterance(text) {
  return String(text || '')
    .replace(FILLER_RE, '$1')
    .replace(/\s+([,.;!?।])/g, '$1')
    .replace(/([,.;!?।])(?:\s*[,.;])+/g, '$1')
    .replace(/^[\s,.;]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
