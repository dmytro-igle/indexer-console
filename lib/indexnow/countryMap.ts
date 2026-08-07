const LANG_TO_COUNTRY: Record<string, string> = {
  pt: "Brazil",
  "pt-br": "Brazil",
  "pt-pt": "Portugal",
  en: "United States",
  "en-us": "United States",
  "en-gb": "United Kingdom",
  es: "Spain",
  "es-es": "Spain",
  "es-mx": "Mexico",
  fr: "France",
  de: "Germany",
  it: "Italy",
};

export function normalizeLangSubtag(rawLang: string): string {
  return rawLang.trim().toLowerCase();
}

export function primarySubtag(normalizedLang: string): string {
  return normalizedLang.split("-")[0];
}

export function mapLangToCountry(rawLang: string | null): string {
  if (!rawLang) return "Unknown (no lang attr)";
  const normalized = normalizeLangSubtag(rawLang);
  if (LANG_TO_COUNTRY[normalized]) return LANG_TO_COUNTRY[normalized];
  const primary = primarySubtag(normalized);
  if (LANG_TO_COUNTRY[primary]) return LANG_TO_COUNTRY[primary];
  return `Unknown (${rawLang})`;
}

export const ENGLISH_LANG_SUBTAGS = new Set(["en", "en-us", "en-gb"]);
