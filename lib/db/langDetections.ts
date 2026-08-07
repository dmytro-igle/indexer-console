import { getDb } from "./client";
import { setLastLangDetection } from "./domains";

export interface LangDetectionRow {
  id: number;
  domain_id: number;
  checked_at: string;
  raw_lang: string | null;
  detected_country: string;
  html_title: string | null;
  pt_br_markers_found: string | null;
  is_mismatch: number;
  http_status: number | null;
  error_message: string | null;
}

export function recordLangDetection(input: {
  domainId: number;
  rawLang: string | null;
  detectedCountry: string;
  htmlTitle: string | null;
  markersFound: string[];
  isMismatch: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
}): LangDetectionRow {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO lang_detections (domain_id, raw_lang, detected_country, html_title, pt_br_markers_found, is_mismatch, http_status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.domainId,
      input.rawLang,
      input.detectedCountry,
      input.htmlTitle,
      JSON.stringify(input.markersFound),
      input.isMismatch ? 1 : 0,
      input.httpStatus,
      input.errorMessage
    );
  const id = info.lastInsertRowid as number;
  setLastLangDetection(input.domainId, id);
  return db
    .prepare<[number], LangDetectionRow>(`SELECT * FROM lang_detections WHERE id = ?`)
    .get(id)!;
}
