import { getDb } from "./client";

export type BatchDomainOutcome =
  | "submitted"
  | "skipped_no_key_verified"
  | "skipped_no_urls"
  | "skipped_inactive"
  | "error";

export type SubmissionStatus = "accepted" | "rejected" | "error";

export interface SubmissionBatchRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  domain_count: number;
  url_count: number;
}

export interface SubmissionBatchDomainRow {
  id: number;
  batch_id: number;
  domain_id: number;
  outcome: BatchDomainOutcome;
  http_status: number | null;
  response_body: string | null;
  url_count: number;
  error_message: string | null;
}

export function createBatch(): SubmissionBatchRow {
  const db = getDb();
  const info = db.prepare(`INSERT INTO submission_batches DEFAULT VALUES`).run();
  return db
    .prepare<[number], SubmissionBatchRow>(
      `SELECT * FROM submission_batches WHERE id = ?`
    )
    .get(info.lastInsertRowid as number)!;
}

export function finishBatch(batchId: number, domainCount: number, urlCount: number): void {
  getDb()
    .prepare(
      `UPDATE submission_batches SET finished_at = datetime('now'), domain_count = ?, url_count = ? WHERE id = ?`
    )
    .run(domainCount, urlCount, batchId);
}

export function recordBatchDomainOutcome(input: {
  batchId: number;
  domainId: number;
  outcome: BatchDomainOutcome;
  httpStatus: number | null;
  responseBody: string | null;
  urlCount: number;
  errorMessage: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO submission_batch_domains (batch_id, domain_id, outcome, http_status, response_body, url_count, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.batchId,
      input.domainId,
      input.outcome,
      input.httpStatus,
      input.responseBody,
      input.urlCount,
      input.errorMessage
    );
}

export function recordSubmissions(
  batchId: number,
  domainUrlIds: number[],
  httpStatus: number | null,
  submissionStatus: SubmissionStatus,
  errorMessage: string | null
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO submissions (batch_id, domain_url_id, http_status, submission_status, error_message)
     VALUES (?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((ids: number[]) => {
    for (const id of ids) {
      insert.run(batchId, id, httpStatus, submissionStatus, errorMessage);
    }
  });
  tx(domainUrlIds);
}

export function listBatches(): SubmissionBatchRow[] {
  return getDb()
    .prepare<[], SubmissionBatchRow>(
      `SELECT * FROM submission_batches ORDER BY started_at DESC`
    )
    .all();
}

export function getBatchById(id: number): SubmissionBatchRow | undefined {
  return getDb()
    .prepare<[number], SubmissionBatchRow>(
      `SELECT * FROM submission_batches WHERE id = ?`
    )
    .get(id);
}

export interface BatchDomainDetail extends SubmissionBatchDomainRow {
  host: string;
}

export function getBatchDomainDetails(batchId: number): BatchDomainDetail[] {
  return getDb()
    .prepare<[number], BatchDomainDetail>(
      `SELECT sbd.*, d.host as host
       FROM submission_batch_domains sbd
       JOIN domains d ON d.id = sbd.domain_id
       WHERE sbd.batch_id = ?
       ORDER BY d.host ASC`
    )
    .all(batchId);
}

export interface CsvExportRow {
  id: number;
  detected_country: string | null;
  host: string;
  url: string;
  submission_status: SubmissionStatus | null;
  http_status: number | null;
  google_submission_status: SubmissionStatus | null;
  google_http_status: number | null;
  indexed_status: string;
}

/**
 * One row per domain_url, with the most recent IndexNow submission and the
 * most recent Google (RocketIndexer) submission joined in. Deliberately NOT
 * one row per historical submission event (that was the pre-Google-support
 * shape) — the two engines' batches aren't time-aligned, so bolting Google
 * columns onto a single event-log doesn't produce coherent rows. This also
 * fixes resubmission producing duplicate rows for the same URL.
 */
export function getSubmissionsForExport(): CsvExportRow[] {
  return getDb()
    .prepare<[], CsvExportRow>(
      `WITH latest_indexnow AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY domain_url_id ORDER BY submitted_at DESC) rn
         FROM submissions
       ),
       latest_google AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY domain_url_id ORDER BY submitted_at DESC) rn
         FROM google_submissions
       )
       SELECT du.id as id,
              ld.detected_country as detected_country,
              dom.host as host,
              du.url as url,
              li.submission_status as submission_status,
              li.http_status as http_status,
              lg.submission_status as google_submission_status,
              lg.http_status as google_http_status,
              du.indexed_status as indexed_status
       FROM domain_urls du
       JOIN domains dom ON dom.id = du.domain_id
       LEFT JOIN lang_detections ld ON ld.id = dom.last_lang_detection_id
       LEFT JOIN latest_indexnow li ON li.domain_url_id = du.id AND li.rn = 1
       LEFT JOIN latest_google lg ON lg.domain_url_id = du.id AND lg.rn = 1
       ORDER BY dom.host ASC, du.url ASC`
    )
    .all();
}
