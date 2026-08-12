import { NextResponse } from "next/server";
import { parseBulkRequest } from "@/lib/api/bulk";
import { getDomainsByIds } from "@/lib/db/domains";
import { filterUrlsByIds, listActiveUrlsForDomain } from "@/lib/db/urls";
import { getKeyVerificationById } from "@/lib/db/keyVerifications";
import {
  createBatch,
  finishBatch,
  recordBatchDomainOutcome,
  recordSubmissions,
  type BatchDomainOutcome,
} from "@/lib/db/submissions";
import { submitToIndexNow } from "@/lib/indexnow/submit";

export async function POST(request: Request) {
  const body = await parseBulkRequest(request);
  const domains = getDomainsByIds(body.domainIds);
  const batch = createBatch();

  let totalUrlCount = 0;

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const keyVerification = domain.last_key_verification_id
        ? getKeyVerificationById(domain.last_key_verification_id)
        : undefined;
      const activeUrls = filterUrlsByIds(listActiveUrlsForDomain(domain.id), body.urlIds);

      let outcome: BatchDomainOutcome;
      if (!keyVerification || !keyVerification.success) {
        outcome = "skipped_no_key_verified";
      } else if (activeUrls.length === 0) {
        outcome = "skipped_no_urls";
      } else {
        outcome = "submitted";
      }

      if (outcome !== "submitted") {
        recordBatchDomainOutcome({
          batchId: batch.id,
          domainId: domain.id,
          outcome,
          httpStatus: null,
          responseBody: null,
          urlCount: 0,
          errorMessage:
            outcome === "skipped_no_key_verified"
              ? "Key not verified (run Verify Keys first)"
              : "No active URLs (run Fetch Sitemaps first)",
        });
        return {
          domainId: domain.id,
          host: domain.host,
          outcome,
          httpStatus: null,
          urlCount: 0,
          error: null as string | null,
        };
      }

      const submitResult = await submitToIndexNow({
        host: domain.host,
        key: domain.key,
        keyLocation: domain.key_location,
        urlList: activeUrls.map((u) => u.url),
      });

      const finalOutcome: BatchDomainOutcome =
        submitResult.submissionStatus === "error" ? "error" : "submitted";

      recordBatchDomainOutcome({
        batchId: batch.id,
        domainId: domain.id,
        outcome: finalOutcome,
        httpStatus: submitResult.httpStatus,
        responseBody: submitResult.responseBody,
        urlCount: activeUrls.length,
        errorMessage: submitResult.errorMessage,
      });

      recordSubmissions(
        batch.id,
        activeUrls.map((u) => u.id),
        submitResult.httpStatus,
        submitResult.submissionStatus,
        submitResult.errorMessage
      );

      totalUrlCount += activeUrls.length;

      return {
        domainId: domain.id,
        host: domain.host,
        outcome: finalOutcome,
        httpStatus: submitResult.httpStatus,
        urlCount: activeUrls.length,
        error: submitResult.errorMessage,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          domainId: domains[i].id,
          host: domains[i].host,
          outcome: "error" as const,
          httpStatus: null,
          urlCount: 0,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );

  finishBatch(batch.id, domains.length, totalUrlCount);

  return NextResponse.json({
    data: {
      batchId: batch.id,
      summary: {
        domainCount: domains.length,
        urlCount: totalUrlCount,
        submitted: data.filter((d) => d.outcome === "submitted").length,
        skipped: data.filter((d) => d.outcome.startsWith("skipped")).length,
        errored: data.filter((d) => d.outcome === "error").length,
      },
      results: data,
    },
  });
}
