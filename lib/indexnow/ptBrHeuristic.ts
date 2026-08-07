const STRONG_MARKERS: { label: string; regex: RegExp }[] = [
  { label: "R$", regex: /R\$/ },
  { label: "Pix", regex: /\bPix\b/i },
  { label: "Brasil", regex: /\bBrasil\b/i },
];

const WEAK_MARKER_WORDS = [
  "apostas",
  "cassino",
  "grátis",
  "código promocional",
  "depósito",
  "saque",
  "bônus",
  "cadastro",
  "jogo responsável",
];

const ACCENTED_CHARS_REGEX = /[ãõçéáíóê]/gi;
const ACCENT_DENSITY_THRESHOLD_PER_1000 = 3;

export interface PtBrScanResult {
  markersFound: string[];
  isStrongMatch: boolean;
  weakMatchCount: number;
}

export function scanForPtBrMarkers(text: string): PtBrScanResult {
  const markersFound: string[] = [];

  for (const { label, regex } of STRONG_MARKERS) {
    if (regex.test(text)) markersFound.push(label);
  }
  const isStrongMatch = markersFound.length > 0;

  let weakMatchCount = 0;
  for (const word of WEAK_MARKER_WORDS) {
    if (text.toLowerCase().includes(word)) {
      markersFound.push(word);
      weakMatchCount++;
    }
  }

  const accentMatches = text.match(ACCENTED_CHARS_REGEX)?.length ?? 0;
  const density = text.length > 0 ? (accentMatches / text.length) * 1000 : 0;
  if (density > ACCENT_DENSITY_THRESHOLD_PER_1000) {
    markersFound.push("accent-density");
    weakMatchCount++;
  }

  return { markersFound, isStrongMatch, weakMatchCount };
}

export function isPtBrMismatch(scan: PtBrScanResult): boolean {
  return scan.isStrongMatch || scan.weakMatchCount >= 2;
}
