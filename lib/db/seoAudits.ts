import { getDb } from "./client";
import { setLastSeoAudit } from "./domains";

export interface SeoAuditRow {
  id: number;
  domain_id: number;
  checked_at: string;
  http_status: number | null;
  https_redirects: number;
  https_final_url: string | null;
  https_final_status: number | null;
  has_schema_markup: number;
  schema_markup_kinds: string | null;
  has_viewport_meta: number;
  robots_txt_has_sitemap: number;
  robots_txt_sitemap_url: string | null;
  meta_description: string | null;
  meta_description_length: number;
  meta_description_flag: "missing" | "too_long" | "ok";
  has_hreflang: number;
  hreflang_count: number;
  error_message: string | null;
}

export function getSeoAuditById(id: number): SeoAuditRow | undefined {
  return getDb()
    .prepare<[number], SeoAuditRow>(`SELECT * FROM seo_audits WHERE id = ?`)
    .get(id);
}

export function recordSeoAudit(input: {
  domainId: number;
  httpStatus: number | null;
  httpsRedirects: boolean;
  httpsFinalUrl: string | null;
  httpsFinalStatus: number | null;
  hasViewportMeta: boolean;
  robotsTxtHasSitemap: boolean;
  robotsTxtSitemapUrl: string | null;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaDescriptionFlag: "missing" | "too_long" | "ok";
  hasHreflang: boolean;
  hreflangCount: number;
  errorMessage: string | null;
}): SeoAuditRow {
  const db = getDb();
  // has_schema_markup / schema_markup_kinds are intentionally not written
  // here (schema.org checking was dropped) — they keep their DB defaults.
  const info = db
    .prepare(
      `INSERT INTO seo_audits (
        domain_id, http_status, https_redirects, https_final_url, https_final_status,
        has_viewport_meta,
        robots_txt_has_sitemap, robots_txt_sitemap_url,
        meta_description, meta_description_length, meta_description_flag,
        has_hreflang, hreflang_count, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.domainId,
      input.httpStatus,
      input.httpsRedirects ? 1 : 0,
      input.httpsFinalUrl,
      input.httpsFinalStatus,
      input.hasViewportMeta ? 1 : 0,
      input.robotsTxtHasSitemap ? 1 : 0,
      input.robotsTxtSitemapUrl,
      input.metaDescription,
      input.metaDescriptionLength,
      input.metaDescriptionFlag,
      input.hasHreflang ? 1 : 0,
      input.hreflangCount,
      input.errorMessage
    );
  const id = info.lastInsertRowid as number;
  setLastSeoAudit(input.domainId, id);
  return getSeoAuditById(id)!;
}
