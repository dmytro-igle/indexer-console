import { getDb } from "./client";

export interface DomainUrlRow {
  id: number;
  domain_id: number;
  url: string;
  first_discovered_at: string;
  last_seen_at: string;
  is_active: number;
  indexed_status: string;
  indexed_status_updated_at: string | null;
  last_google_tracking_id: number | null;
}

export function listUrlsForDomain(domainId: number): DomainUrlRow[] {
  return getDb()
    .prepare<[number], DomainUrlRow>(
      `SELECT * FROM domain_urls WHERE domain_id = ? ORDER BY url ASC`
    )
    .all(domainId);
}

export function listActiveUrlsForDomain(domainId: number): DomainUrlRow[] {
  return getDb()
    .prepare<[number], DomainUrlRow>(
      `SELECT * FROM domain_urls WHERE domain_id = ? AND is_active = 1 ORDER BY url ASC`
    )
    .all(domainId);
}

export function filterUrlsByIds(urls: DomainUrlRow[], urlIds: number[] | undefined): DomainUrlRow[] {
  if (!urlIds || urlIds.length === 0) return urls;
  const selected = new Set(urlIds);
  return urls.filter((u) => selected.has(u.id));
}

export function getUrlById(id: number): DomainUrlRow | undefined {
  return getDb()
    .prepare<[number], DomainUrlRow>(`SELECT * FROM domain_urls WHERE id = ?`)
    .get(id);
}

export function updateIndexedStatus(id: number, indexedStatus: string): DomainUrlRow | undefined {
  const db = getDb();
  db.prepare(
    `UPDATE domain_urls SET indexed_status = ?, indexed_status_updated_at = datetime('now') WHERE id = ?`
  ).run(indexedStatus, id);
  return getUrlById(id);
}

export function setGoogleTrackingId(urlId: number, trackingId: number): void {
  getDb()
    .prepare(`UPDATE domain_urls SET last_google_tracking_id = ? WHERE id = ?`)
    .run(trackingId, urlId);
}

/**
 * URLs that have a stored RocketIndexer tracking ID, i.e. have been
 * submitted to Google at least once — the candidate set for a status check.
 */
export function listUrlsWithGoogleTrackingId(domainIds: number[] | undefined): DomainUrlRow[] {
  const db = getDb();
  if (!domainIds || domainIds.length === 0) {
    return db
      .prepare<[], DomainUrlRow>(
        `SELECT du.* FROM domain_urls du
         JOIN domains d ON d.id = du.domain_id
         WHERE du.last_google_tracking_id IS NOT NULL AND d.is_active = 1`
      )
      .all();
  }
  const placeholders = domainIds.map(() => "?").join(",");
  return db
    .prepare<number[], DomainUrlRow>(
      `SELECT du.* FROM domain_urls du
       JOIN domains d ON d.id = du.domain_id
       WHERE du.last_google_tracking_id IS NOT NULL AND d.is_active = 1
         AND du.domain_id IN (${placeholders})`
    )
    .all(...domainIds);
}

/**
 * Upserts the URLs discovered in a sitemap fetch for a domain. Any
 * previously-active URL not present in `urls` this run is marked inactive
 * rather than deleted, since submissions history may reference it.
 */
export interface DomainUrlSyncResult {
  discoveredCount: number;
  newUrls: string[];
  reactivatedUrls: string[];
}

export function syncDomainUrls(domainId: number, urls: string[]): DomainUrlSyncResult {
  const db = getDb();
  const dedupedUrls = Array.from(new Set(urls));
  const existing = db
    .prepare<[number], { url: string; is_active: number }>(
      `SELECT url, is_active FROM domain_urls WHERE domain_id = ?`
    )
    .all(domainId);
  const existingByUrl = new Map(existing.map((row) => [row.url, row.is_active]));
  const newUrls = dedupedUrls.filter((url) => !existingByUrl.has(url));
  const reactivatedUrls = dedupedUrls.filter((url) => existingByUrl.get(url) === 0);

  const upsert = db.prepare(
    `INSERT INTO domain_urls (domain_id, url, last_seen_at, is_active)
     VALUES (?, ?, datetime('now'), 1)
     ON CONFLICT(domain_id, url) DO UPDATE SET last_seen_at = datetime('now'), is_active = 1`
  );
  const deactivateStale = db.prepare(
    `UPDATE domain_urls SET is_active = 0
     WHERE domain_id = ? AND is_active = 1 AND url NOT IN (${dedupedUrls.length > 0 ? dedupedUrls.map(() => "?").join(",") : "''"})`
  );

  const tx = db.transaction((list: string[]) => {
    for (const url of list) {
      upsert.run(domainId, url);
    }
    deactivateStale.run(domainId, ...list);
  });
  tx(dedupedUrls);

  return {
    discoveredCount: dedupedUrls.length,
    newUrls,
    reactivatedUrls,
  };
}
