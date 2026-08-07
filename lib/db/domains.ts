import { getDb } from "./client";
import { deriveBriefIssues } from "@/lib/seo/issues";

export interface DomainRow {
  id: number;
  host: string;
  key: string;
  key_location: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_sitemap_run_id: number | null;
  last_key_verification_id: number | null;
  last_lang_detection_id: number | null;
  last_seo_audit_id: number | null;
}

export interface DomainSummary extends DomainRow {
  url_count: number;
  active_url_count: number;
  sitemap: {
    status: "success" | "partial" | "failed" | null;
    url_count: number;
    started_at: string | null;
    error_message: string | null;
  };
  keyVerification: {
    success: boolean | null;
    http_status: number | null;
    checked_at: string | null;
    error_message: string | null;
  };
  lang: {
    raw_lang: string | null;
    detected_country: string | null;
    is_mismatch: boolean;
    pt_br_markers_found: string[] | null;
    checked_at: string | null;
    error_message: string | null;
  };
  lastSubmission: {
    submitted_at: string | null;
    outcome: string | null;
    http_status: number | null;
  };
  lastGoogleSubmission: {
    submitted_at: string | null;
    outcome: string | null;
    http_status: number | null;
    credits_remaining: number | null;
  };
  seoAudit: {
    checked_at: string | null;
    http_status: number | null;
    https_redirects: boolean;
    https_final_url: string | null;
    has_viewport_meta: boolean;
    robots_txt_has_sitemap: boolean;
    meta_description_length: number | null;
    meta_description_flag: "missing" | "too_long" | "ok" | null;
    has_hreflang: boolean;
    hreflang_count: number | null;
    error_message: string | null;
  };
  seoIssueCount: number;
}

export function listDomains(): DomainSummary[] {
  const db = getDb();
  const domains = db
    .prepare<[], DomainRow>(
      `SELECT * FROM domains WHERE is_active = 1 ORDER BY host ASC`
    )
    .all();

  const urlCountStmt = db.prepare<[number], { total: number; active: number }>(
    `SELECT COUNT(*) as total, SUM(is_active) as active FROM domain_urls WHERE domain_id = ?`
  );
  const sitemapStmt = db.prepare(
    `SELECT status, url_count, started_at, error_message FROM sitemap_fetch_runs WHERE id = ?`
  );
  const keyStmt = db.prepare(
    `SELECT success, http_status, checked_at, error_message FROM key_verifications WHERE id = ?`
  );
  const langStmt = db.prepare(
    `SELECT raw_lang, detected_country, is_mismatch, pt_br_markers_found, checked_at, error_message FROM lang_detections WHERE id = ?`
  );
  const lastSubmissionStmt = db.prepare<[number], {
    submitted_at: string | null;
    outcome: string | null;
    http_status: number | null;
  }>(
    `SELECT sbd.http_status as http_status, sbd.outcome as outcome, sb.finished_at as submitted_at
     FROM submission_batch_domains sbd
     JOIN submission_batches sb ON sb.id = sbd.batch_id
     WHERE sbd.domain_id = ?
     ORDER BY sb.started_at DESC
     LIMIT 1`
  );
  const seoAuditStmt = db.prepare(
    `SELECT checked_at, http_status, https_redirects, https_final_url, https_final_status,
            has_viewport_meta, meta_description, meta_description_length, meta_description_flag,
            robots_txt_has_sitemap, has_hreflang, hreflang_count, error_message
     FROM seo_audits WHERE id = ?`
  );
  const lastGoogleSubmissionStmt = db.prepare<[number], {
    submitted_at: string | null;
    outcome: string | null;
    http_status: number | null;
    credits_remaining: number | null;
  }>(
    `SELECT gbd.http_status as http_status, gbd.outcome as outcome,
            gbd.credits_remaining as credits_remaining, gb.finished_at as submitted_at
     FROM google_submission_batch_domains gbd
     JOIN google_submission_batches gb ON gb.id = gbd.batch_id
     WHERE gbd.domain_id = ?
     ORDER BY gb.started_at DESC
     LIMIT 1`
  );

  return domains.map((d) => {
    const counts = urlCountStmt.get(d.id) ?? { total: 0, active: 0 };
    const sitemap = d.last_sitemap_run_id
      ? (sitemapStmt.get(d.last_sitemap_run_id) as {
          status: "success" | "partial" | "failed";
          url_count: number;
          started_at: string;
          error_message: string | null;
        })
      : null;
    const key = d.last_key_verification_id
      ? (keyStmt.get(d.last_key_verification_id) as {
          success: number;
          http_status: number | null;
          checked_at: string;
          error_message: string | null;
        })
      : null;
    const lang = d.last_lang_detection_id
      ? (langStmt.get(d.last_lang_detection_id) as {
          raw_lang: string | null;
          detected_country: string;
          is_mismatch: number;
          pt_br_markers_found: string | null;
          checked_at: string;
          error_message: string | null;
        })
      : null;
    const lastSubmission = lastSubmissionStmt.get(d.id);
    const lastGoogleSubmission = lastGoogleSubmissionStmt.get(d.id);
    const seoAudit = d.last_seo_audit_id
      ? (seoAuditStmt.get(d.last_seo_audit_id) as {
          checked_at: string;
          http_status: number | null;
          https_redirects: number;
          https_final_url: string | null;
          https_final_status: number | null;
          has_viewport_meta: number;
          meta_description: string | null;
          meta_description_length: number;
          meta_description_flag: "missing" | "too_long" | "ok";
          robots_txt_has_sitemap: number;
          has_hreflang: number;
          hreflang_count: number;
          error_message: string | null;
        })
      : null;
    const seoIssueCount = deriveBriefIssues({
      domain: d,
      seoAudit,
      sitemapStatus: sitemap?.status ?? null,
    }).length;

    return {
      ...d,
      url_count: counts.total ?? 0,
      active_url_count: counts.active ?? 0,
      sitemap: {
        status: sitemap?.status ?? null,
        url_count: sitemap?.url_count ?? 0,
        started_at: sitemap?.started_at ?? null,
        error_message: sitemap?.error_message ?? null,
      },
      keyVerification: {
        success: key ? Boolean(key.success) : null,
        http_status: key?.http_status ?? null,
        checked_at: key?.checked_at ?? null,
        error_message: key?.error_message ?? null,
      },
      lang: {
        raw_lang: lang?.raw_lang ?? null,
        detected_country: lang?.detected_country ?? null,
        is_mismatch: Boolean(lang?.is_mismatch),
        pt_br_markers_found: lang?.pt_br_markers_found
          ? (JSON.parse(lang.pt_br_markers_found) as string[])
          : null,
        checked_at: lang?.checked_at ?? null,
        error_message: lang?.error_message ?? null,
      },
      lastSubmission: {
        submitted_at: lastSubmission?.submitted_at ?? null,
        outcome: lastSubmission?.outcome ?? null,
        http_status: lastSubmission?.http_status ?? null,
      },
      lastGoogleSubmission: {
        submitted_at: lastGoogleSubmission?.submitted_at ?? null,
        outcome: lastGoogleSubmission?.outcome ?? null,
        http_status: lastGoogleSubmission?.http_status ?? null,
        credits_remaining: lastGoogleSubmission?.credits_remaining ?? null,
      },
      seoAudit: {
        checked_at: seoAudit?.checked_at ?? null,
        http_status: seoAudit?.http_status ?? null,
        https_redirects: Boolean(seoAudit?.https_redirects),
        https_final_url: seoAudit?.https_final_url ?? null,
        has_viewport_meta: Boolean(seoAudit?.has_viewport_meta),
        robots_txt_has_sitemap: Boolean(seoAudit?.robots_txt_has_sitemap),
        meta_description_length: seoAudit?.meta_description_length ?? null,
        meta_description_flag: seoAudit?.meta_description_flag ?? null,
        has_hreflang: Boolean(seoAudit?.has_hreflang),
        hreflang_count: seoAudit?.hreflang_count ?? null,
        error_message: seoAudit?.error_message ?? null,
      },
      seoIssueCount,
    };
  });
}

export function getDomainById(id: number): DomainRow | undefined {
  const db = getDb();
  return db.prepare<[number], DomainRow>(`SELECT * FROM domains WHERE id = ?`).get(id);
}

export function getDomainsByIds(ids: number[] | undefined): DomainRow[] {
  const db = getDb();
  if (!ids || ids.length === 0) {
    return db
      .prepare<[], DomainRow>(`SELECT * FROM domains WHERE is_active = 1`)
      .all();
  }
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare<number[], DomainRow>(
      `SELECT * FROM domains WHERE is_active = 1 AND id IN (${placeholders})`
    )
    .all(...ids);
}

export function createDomain(input: {
  host: string;
  key: string;
  keyLocation: string;
}): DomainRow {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO domains (host, key, key_location) VALUES (?, ?, ?)`
    )
    .run(input.host, input.key, input.keyLocation);
  return getDomainById(info.lastInsertRowid as number)!;
}

export function updateDomain(
  id: number,
  fields: Partial<{ host: string; key: string; keyLocation: string }>
): DomainRow | undefined {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.host !== undefined) {
    sets.push("host = ?");
    values.push(fields.host);
  }
  if (fields.key !== undefined) {
    sets.push("key = ?");
    values.push(fields.key);
  }
  if (fields.keyLocation !== undefined) {
    sets.push("key_location = ?");
    values.push(fields.keyLocation);
  }
  if (sets.length === 0) return getDomainById(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE domains SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values
  );
  return getDomainById(id);
}

export function softDeleteDomain(id: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE domains SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

export function setLastSitemapRun(domainId: number, runId: number): void {
  getDb()
    .prepare(`UPDATE domains SET last_sitemap_run_id = ? WHERE id = ?`)
    .run(runId, domainId);
}

export function setLastKeyVerification(domainId: number, checkId: number): void {
  getDb()
    .prepare(`UPDATE domains SET last_key_verification_id = ? WHERE id = ?`)
    .run(checkId, domainId);
}

export function setLastLangDetection(domainId: number, detectionId: number): void {
  getDb()
    .prepare(`UPDATE domains SET last_lang_detection_id = ? WHERE id = ?`)
    .run(detectionId, domainId);
}

export function setLastSeoAudit(domainId: number, auditId: number): void {
  getDb()
    .prepare(`UPDATE domains SET last_seo_audit_id = ? WHERE id = ?`)
    .run(auditId, domainId);
}
