import { getDb } from "./client";

export type GoogleBatchDomainOutcome = "submitted" | "skipped_no_urls" | "skipped_inactive" | "error";
export type GoogleSubmissionStatus = "accepted" | "rejected" | "error";

export interface GoogleSubmissionBatchRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  domain_count: number;
  url_count: number;
}

export interface GoogleSubmissionBatchDomainRow {
  id: number;
  batch_id: number;
  domain_id: number;
  outcome: GoogleBatchDomainOutcome;
  http_status: number | null;
  response_body: string | null;
  url_count: number;
  credits_remaining: number | null;
  error_message: string | null;
}

export function createGoogleBatch(): GoogleSubmissionBatchRow {
  const db = getDb();
  const info = db.prepare(`INSERT INTO google_submission_batches DEFAULT VALUES`).run();
  return db
    .prepare<[number], GoogleSubmissionBatchRow>(`SELECT * FROM google_submission_batches WHERE id = ?`)
    .get(info.lastInsertRowid as number)!;
}

export function finishGoogleBatch(batchId: number, domainCount: number, urlCount: number): void {
  getDb()
    .prepare(
      `UPDATE google_submission_batches SET finished_at = datetime('now'), domain_count = ?, url_count = ? WHERE id = ?`
    )
    .run(domainCount, urlCount, batchId);
}

export function recordGoogleBatchDomainOutcome(input: {
  batchId: number;
  domainId: number;
  outcome: GoogleBatchDomainOutcome;
  httpStatus: number | null;
  responseBody: string | null;
  urlCount: number;
  creditsRemaining: number | null;
  errorMessage: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO google_submission_batch_domains
        (batch_id, domain_id, outcome, http_status, response_body, url_count, credits_remaining, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.batchId,
      input.domainId,
      input.outcome,
      input.httpStatus,
      input.responseBody,
      input.urlCount,
      input.creditsRemaining,
      input.errorMessage
    );
}

/**
 * Unlike IndexNow's recordSubmissions (one shared status for the whole
 * domain), RocketIndexer can partially fail a batch (invalid_urls), so each
 * URL gets its own status/tracking_id here.
 */
export function recordGoogleSubmissions(
  batchId: number,
  results: {
    domainUrlId: number;
    httpStatus: number | null;
    submissionStatus: GoogleSubmissionStatus;
    trackingId: number | null;
    errorMessage: string | null;
  }[]
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO google_submissions (batch_id, domain_url_id, http_status, submission_status, tracking_id, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows: typeof results) => {
    for (const r of rows) {
      insert.run(batchId, r.domainUrlId, r.httpStatus, r.submissionStatus, r.trackingId, r.errorMessage);
    }
  });
  tx(results);
}

export function listGoogleBatches(): GoogleSubmissionBatchRow[] {
  return getDb()
    .prepare<[], GoogleSubmissionBatchRow>(`SELECT * FROM google_submission_batches ORDER BY started_at DESC`)
    .all();
}

export function getGoogleBatchById(id: number): GoogleSubmissionBatchRow | undefined {
  return getDb()
    .prepare<[number], GoogleSubmissionBatchRow>(`SELECT * FROM google_submission_batches WHERE id = ?`)
    .get(id);
}

export interface GoogleBatchDomainDetail extends GoogleSubmissionBatchDomainRow {
  host: string;
}

export function getGoogleBatchDomainDetails(batchId: number): GoogleBatchDomainDetail[] {
  return getDb()
    .prepare<[number], GoogleBatchDomainDetail>(
      `SELECT gbd.*, d.host as host
       FROM google_submission_batch_domains gbd
       JOIN domains d ON d.id = gbd.domain_id
       WHERE gbd.batch_id = ?
       ORDER BY d.host ASC`
    )
    .all(batchId);
}
