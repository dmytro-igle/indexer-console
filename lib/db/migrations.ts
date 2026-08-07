import type Database from "better-sqlite3";

const SCHEMA_VERSION = 3;

const DDL = `
CREATE TABLE IF NOT EXISTS domains (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  host                     TEXT NOT NULL UNIQUE,
  key                      TEXT NOT NULL,
  key_location             TEXT NOT NULL,
  is_active                INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  last_sitemap_run_id      INTEGER,
  last_key_verification_id INTEGER,
  last_lang_detection_id   INTEGER,
  last_seo_audit_id        INTEGER
);

CREATE TABLE IF NOT EXISTS domain_urls (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id                 INTEGER NOT NULL REFERENCES domains(id),
  url                       TEXT NOT NULL,
  first_discovered_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at              TEXT NOT NULL DEFAULT (datetime('now')),
  is_active                 INTEGER NOT NULL DEFAULT 1,
  indexed_status            TEXT NOT NULL DEFAULT 'Not verified',
  indexed_status_updated_at TEXT,
  last_google_tracking_id   INTEGER,
  UNIQUE(domain_id, url)
);
CREATE INDEX IF NOT EXISTS idx_domain_urls_domain ON domain_urls(domain_id);

CREATE TABLE IF NOT EXISTS sitemap_fetch_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id      INTEGER NOT NULL REFERENCES domains(id),
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at    TEXT,
  status         TEXT NOT NULL CHECK (status IN ('success','partial','failed')),
  url_count      INTEGER NOT NULL DEFAULT 0,
  sitemaps_tried TEXT,
  error_message  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sitemap_runs_domain ON sitemap_fetch_runs(domain_id, started_at);

CREATE TABLE IF NOT EXISTS key_verifications (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id              INTEGER NOT NULL REFERENCES domains(id),
  checked_at             TEXT NOT NULL DEFAULT (datetime('now')),
  success                INTEGER NOT NULL,
  http_status            INTEGER,
  response_body_snippet  TEXT,
  error_message          TEXT
);
CREATE INDEX IF NOT EXISTS idx_key_verifications_domain ON key_verifications(domain_id, checked_at);

CREATE TABLE IF NOT EXISTS lang_detections (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id            INTEGER NOT NULL REFERENCES domains(id),
  checked_at           TEXT NOT NULL DEFAULT (datetime('now')),
  raw_lang             TEXT,
  detected_country     TEXT NOT NULL,
  html_title           TEXT,
  pt_br_markers_found  TEXT,
  is_mismatch          INTEGER NOT NULL DEFAULT 0,
  http_status          INTEGER,
  error_message        TEXT
);
CREATE INDEX IF NOT EXISTS idx_lang_detections_domain ON lang_detections(domain_id, checked_at);

CREATE TABLE IF NOT EXISTS submission_batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  domain_count  INTEGER NOT NULL DEFAULT 0,
  url_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submission_batch_domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id      INTEGER NOT NULL REFERENCES submission_batches(id),
  domain_id     INTEGER NOT NULL REFERENCES domains(id),
  outcome       TEXT NOT NULL CHECK (outcome IN
                  ('submitted','skipped_no_key_verified','skipped_no_urls','skipped_inactive','error')),
  http_status   INTEGER,
  response_body TEXT,
  url_count     INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_batch_domains_batch ON submission_batch_domains(batch_id);

CREATE TABLE IF NOT EXISTS submissions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id           INTEGER NOT NULL REFERENCES submission_batches(id),
  domain_url_id      INTEGER NOT NULL REFERENCES domain_urls(id),
  submitted_at       TEXT NOT NULL DEFAULT (datetime('now')),
  http_status        INTEGER,
  submission_status  TEXT NOT NULL CHECK (submission_status IN ('accepted','rejected','error')),
  error_message      TEXT
);
CREATE INDEX IF NOT EXISTS idx_submissions_domain_url ON submissions(domain_url_id);
CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions(batch_id);

CREATE TABLE IF NOT EXISTS seo_audits (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id                INTEGER NOT NULL REFERENCES domains(id),
  checked_at               TEXT NOT NULL DEFAULT (datetime('now')),
  http_status              INTEGER,
  https_redirects          INTEGER NOT NULL DEFAULT 0,
  https_final_url          TEXT,
  https_final_status       INTEGER,
  has_schema_markup        INTEGER NOT NULL DEFAULT 0,
  schema_markup_kinds      TEXT,
  has_viewport_meta        INTEGER NOT NULL DEFAULT 0,
  robots_txt_has_sitemap   INTEGER NOT NULL DEFAULT 0,
  robots_txt_sitemap_url   TEXT,
  meta_description         TEXT,
  meta_description_length  INTEGER NOT NULL DEFAULT 0,
  meta_description_flag    TEXT NOT NULL DEFAULT 'missing'
                            CHECK (meta_description_flag IN ('missing','too_long','ok')),
  has_hreflang              INTEGER NOT NULL DEFAULT 0,
  hreflang_count            INTEGER NOT NULL DEFAULT 0,
  error_message             TEXT
);
CREATE INDEX IF NOT EXISTS idx_seo_audits_domain ON seo_audits(domain_id, checked_at);

CREATE TABLE IF NOT EXISTS google_submission_batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  domain_count  INTEGER NOT NULL DEFAULT 0,
  url_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS google_submission_batch_domains (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id           INTEGER NOT NULL REFERENCES google_submission_batches(id),
  domain_id          INTEGER NOT NULL REFERENCES domains(id),
  outcome            TEXT NOT NULL CHECK (outcome IN
                       ('submitted','skipped_no_urls','skipped_inactive','error')),
  http_status        INTEGER,
  response_body      TEXT,
  url_count          INTEGER NOT NULL DEFAULT 0,
  credits_remaining  INTEGER,
  error_message      TEXT
);
CREATE INDEX IF NOT EXISTS idx_google_batch_domains_batch ON google_submission_batch_domains(batch_id);

CREATE TABLE IF NOT EXISTS google_submissions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id           INTEGER NOT NULL REFERENCES google_submission_batches(id),
  domain_url_id      INTEGER NOT NULL REFERENCES domain_urls(id),
  submitted_at       TEXT NOT NULL DEFAULT (datetime('now')),
  http_status        INTEGER,
  submission_status  TEXT NOT NULL CHECK (submission_status IN ('accepted','rejected','error')),
  tracking_id        INTEGER,
  error_message      TEXT
);
CREATE INDEX IF NOT EXISTS idx_google_submissions_domain_url ON google_submissions(domain_url_id);
CREATE INDEX IF NOT EXISTS idx_google_submissions_batch ON google_submissions(batch_id);
`;

export function runMigrations(db: Database.Database) {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  if (currentVersion >= SCHEMA_VERSION) return;

  // Idempotent: creates any tables that don't exist yet. Does NOT add
  // columns to tables that already exist — that needs an explicit ALTER
  // TABLE below for anything added after the first release.
  db.exec(DDL);

  if (currentVersion < 2) {
    const domainCols = db.pragma("table_info(domains)") as { name: string }[];
    if (!domainCols.some((c) => c.name === "last_seo_audit_id")) {
      db.exec(`ALTER TABLE domains ADD COLUMN last_seo_audit_id INTEGER`);
    }
  }

  if (currentVersion < 3) {
    const urlCols = db.pragma("table_info(domain_urls)") as { name: string }[];
    if (!urlCols.some((c) => c.name === "last_google_tracking_id")) {
      db.exec(`ALTER TABLE domain_urls ADD COLUMN last_google_tracking_id INTEGER`);
    }
  }

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}
