import { getDb } from "./client";
import { setLastKeyVerification } from "./domains";

export interface KeyVerificationRow {
  id: number;
  domain_id: number;
  checked_at: string;
  success: number;
  http_status: number | null;
  response_body_snippet: string | null;
  error_message: string | null;
}

export function getKeyVerificationById(id: number): KeyVerificationRow | undefined {
  return getDb()
    .prepare<[number], KeyVerificationRow>(`SELECT * FROM key_verifications WHERE id = ?`)
    .get(id);
}

export function recordKeyVerification(input: {
  domainId: number;
  success: boolean;
  httpStatus: number | null;
  responseBodySnippet: string | null;
  errorMessage: string | null;
}): KeyVerificationRow {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO key_verifications (domain_id, success, http_status, response_body_snippet, error_message)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.domainId,
      input.success ? 1 : 0,
      input.httpStatus,
      input.responseBodySnippet,
      input.errorMessage
    );
  const checkId = info.lastInsertRowid as number;
  setLastKeyVerification(input.domainId, checkId);
  return db
    .prepare<[number], KeyVerificationRow>(
      `SELECT * FROM key_verifications WHERE id = ?`
    )
    .get(checkId)!;
}
