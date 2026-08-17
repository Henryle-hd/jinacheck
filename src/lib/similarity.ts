/**
 * String-similarity primitives + a Swahili-aware phonetic key.
 *
 * The phonetic key exists because the register's real-world collisions are
 * mostly *idem sonans* — names that sound alike when spoken, which is the test
 * an examiner applies when deciding whether a name is "too similar" to one
 * already on the register. NIKA / NYIKA / NIKKA / NICA all reduce to one key.
 */

/** Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Normalised edit similarity in [0,1]. */
export function editRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Jaro-Winkler similarity in [0,1]. Weighted toward a shared prefix, which
 * matches how people actually confuse business names — the front of the name
 * carries the recognition.
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aFlags = new Array<boolean>(a.length).fill(false);
  const bFlags = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue;
    while (!bFlags[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions) / m) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Order-insensitive token similarity. "NIKA MOTORS" vs "MOTORS NIKA" should
 * read as the same name, because on the register it effectively is.
 */
export function tokenSetRatio(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

/** How many of `needle`'s tokens appear in `hay` (directional containment). */
export function tokenContainment(needle: string[], hay: string[]): number {
  if (!needle.length) return 0;
  const set = new Set(hay);
  let hit = 0;
  for (const t of needle) if (set.has(t)) hit++;
  return hit / needle.length;
}

const VOWELS = /[AEIOU]/;

/**
 * Phonetic key tuned for names on the Tanzanian register (Swahili orthography
 * plus anglicised spellings).
 *
 * Digraphs are folded first, then letters that are pronounced alike are merged
 * (C/K/Q, S/Z, F/V/PH), semivowels dropped, runs collapsed, and interior vowels
 * removed — vowel choice is the most common spelling variation of all.
 */
export function phoneticKey(raw: string): string {
  let s = (raw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";

  s = s
    .replace(/NG'/g, "NG")
    .replace(/PH/g, "F")
    .replace(/GH/g, "G")
    .replace(/KH/g, "H")
    .replace(/TH/g, "T")
    .replace(/SH/g, "X")   // distinct sibilant, kept apart from plain S
    .replace(/CH/g, "X")   // Swahili CH ≈ SH for confusion purposes
    .replace(/NY/g, "N")
    .replace(/DH/g, "D");

  s = s
    .replace(/[CQ]/g, "K")
    .replace(/Z/g, "S")
    .replace(/V/g, "F")
    .replace(/X/g, "X")
    .replace(/[WY]/g, "")
    .replace(/H/g, "");

  const first = s[0];
  let tail = s.slice(1).replace(new RegExp(VOWELS.source, "g"), "");
  // collapse repeated consonants: MM -> M
  tail = tail.replace(/(.)\1+/g, "$1");

  const head = VOWELS.test(first) ? first : first;
  return (head + tail).replace(/(.)\1+/g, "$1");
}

/** Phonetic key across a multi-word core. */
export function phoneticPhrase(raw: string): string {
  return (raw || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(phoneticKey)
    .join("");
}
