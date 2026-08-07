import { getDb } from "./client";
import { setLastSitemapRun } from "./domains";

export interface SitemapFetchRunRow {
  id: number;
  domain_id: number;
  started_at: string;
  finished_at: string | null;
  status: "success" | "partial" | "failed";
  url_count: number;
  sitemaps_tried: string | null;
  error_message: string | null;
}

export function getSitemapRunById(id: number): SitemapFetchRunRow | undefined {
  return getDb()
    .prepare<[number], SitemapFetchRunRow>(`SELECT * FROM sitemap_fetch_runs WHERE id = ?`)
    .get(id);
}

export function recordSitemapRun(input: {
  domainId: number;
  status: "success" | "partial" | "failed";
  urlCount: number;
  sitemapsTried: string[];
  errorMessage: string | null;
}): SitemapFetchRunRow {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO sitemap_fetch_runs (domain_id, finished_at, status, url_count, sitemaps_tried, error_message)
       VALUES (?, datetime('now'), ?, ?, ?, ?)`
    )
    .run(
      input.domainId,
      input.status,
      input.urlCount,
      JSON.stringify(input.sitemapsTried),
      input.errorMessage
    );
  const runId = info.lastInsertRowid as number;
  setLastSitemapRun(input.domainId, runId);
  return db
    .prepare<[number], SitemapFetchRunRow>(
      `SELECT * FROM sitemap_fetch_runs WHERE id = ?`
    )
    .get(runId)!;
}
