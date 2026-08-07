import { fetchWithTimeout } from "@/lib/http";
import { mapLangToCountry, normalizeLangSubtag, ENGLISH_LANG_SUBTAGS } from "./countryMap";
import { scanForPtBrMarkers, isPtBrMismatch } from "./ptBrHeuristic";
import type { LangDetectResult } from "./types";

const HTML_LANG_REGEX = /<html\b[^>]*\blang=["']([^"']+)["']/i;
const TITLE_REGEX = /<title[^>]*>([^<]*)<\/title>/i;
const MAX_BODY_BYTES = 200_000;

export async function detectDomainLang(host: string): Promise<LangDetectResult> {
  const result = await fetchWithTimeout(`https://${host}/`, {
    timeoutMs: 10_000,
    maxBytes: MAX_BODY_BYTES,
  });

  if (result.error || !result.body) {
    return {
      rawLang: null,
      detectedCountry: "Unknown (fetch failed)",
      htmlTitle: null,
      markersFound: [],
      isMismatch: false,
      httpStatus: result.status,
      errorMessage: result.error ?? (result.status ? `HTTP ${result.status}` : "Fetch failed"),
    };
  }

  const langMatch = result.body.match(HTML_LANG_REGEX);
  const rawLang = langMatch ? langMatch[1] : null;
  const titleMatch = result.body.match(TITLE_REGEX);
  const htmlTitle = titleMatch ? titleMatch[1].trim() : null;

  const scan = scanForPtBrMarkers(result.body);
  const normalizedLang = rawLang ? normalizeLangSubtag(rawLang) : null;
  const isEnglishTagged = normalizedLang ? ENGLISH_LANG_SUBTAGS.has(normalizedLang) : false;
  const isMismatch = isEnglishTagged && isPtBrMismatch(scan);

  return {
    rawLang,
    detectedCountry: mapLangToCountry(rawLang),
    htmlTitle,
    markersFound: scan.markersFound,
    isMismatch,
    httpStatus: result.status,
    errorMessage: result.ok ? null : `HTTP ${result.status}`,
  };
}
