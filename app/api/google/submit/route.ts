import { NextResponse } from "next/server";
import { parseBulkRequest } from "@/lib/api/bulk";
import { getDomainsByIds } from "@/lib/db/domains";
import { filterUrlsByIds, listActiveUrlsForDomain, setGoogleTrackingId } from "@/lib/db/urls";
import {
  createGoogleBatch,
  finishGoogleBatch,
  recordGoogleBatchDomainOutcome,
  recordGoogleSubmissions,
  type GoogleBatchDomainOutcome,
  type GoogleSubmissionStatus,
} from "@/lib/db/googleSubmissions";
import { submitUrlsToRocketIndexer } from "@/lib/google/rocketIndexer";

export async function POST(request: Request) {
  if (!process.env.ROCKETINDEXER_API_KEY) {
    return NextResponse.json(
      {
        error: {
          message: "RocketIndexer API key is not configured. Add ROCKETINDEXER_API_KEY to .env and restart.",
        },
      },
      { status: 400 }
    );
  }

  const body = await parseBulkRequest(request);
  const domains = getDomainsByIds(body.domainIds);
  const batch = createGoogleBatch();

  let totalUrlCount = 0;

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const activeUrls = filterUrlsByIds(listActiveUrlsForDomain(domain.id), body.urlIds);

      if (activeUrls.length === 0) {
        recordGoogleBatchDomainOutcome({
          batchId: batch.id,
          domainId: domain.id,
          outcome: "skipped_no_urls",
          httpStatus: null,
          responseBody: null,
          urlCount: 0,
          creditsRemaining: null,
          errorMessage: "No active URLs (run Fetch Sitemaps first)",
        });
        return {
          domainId: domain.id,
          host: domain.host,
          outcome: "skipped_no_urls" as GoogleBatchDomainOutcome,
          httpStatus: null,
          urlCount: 0,
          error: null as string | null,
        };
      }

      const submitResult = await submitUrlsToRocketIndexer(activeUrls.map((u) => u.url));

      if (!submitResult.ok) {
        const outcome: GoogleBatchDomainOutcome = "error";
        recordGoogleBatchDomainOutcome({
          batchId: batch.id,
          domainId: domain.id,
          outcome,
          httpStatus: submitResult.httpStatus,
          responseBody: null,
          urlCount: 0,
          creditsRemaining: submitResult.creditsRemaining,
          errorMessage: submitResult.errorMessage,
        });
        recordGoogleSubmissions(
          batch.id,
          activeUrls.map((u) => ({
            domainUrlId: u.id,
            httpStatus: submitResult.httpStatus,
            submissionStatus: "error" as GoogleSubmissionStatus,
            trackingId: null,
            errorMessage: submitResult.errorMessage,
          }))
        );
        return {
          domainId: domain.id,
          host: domain.host,
          outcome,
          httpStatus: submitResult.httpStatus,
          urlCount: 0,
          error: submitResult.errorMessage,
        };
      }

      // Map the response back to individual URLs. Only pair tracking_ids to
      // URLs when the counts line up exactly with what their docs example
      // implies (tracking_ids parallels the accepted/valid URLs, in order).
      // Getting this wrong would make the status-checker silently poll the
      // wrong URL later, so an uncertain pairing is left unassigned rather
      // than guessed.
      const invalidSet = new Set(submitResult.invalidUrls);
      const validUrls = activeUrls.filter((u) => !invalidSet.has(u.url));
      const invalidUrls = activeUrls.filter((u) => invalidSet.has(u.url));

      const trackingIdsMatch = submitResult.trackingIds.length === validUrls.length;
      let mismatchNote: string | null = null;
      if (!trackingIdsMatch) {
        mismatchNote =
          "tracking_ids count did not match submitted URL count — tracking IDs not recorded for this batch";
      }

      const perUrlResults = [
        ...validUrls.map((u, i) => ({
          domainUrlId: u.id,
          httpStatus: submitResult.httpStatus,
          submissionStatus: "accepted" as GoogleSubmissionStatus,
          trackingId: trackingIdsMatch ? submitResult.trackingIds[i] : null,
          errorMessage: trackingIdsMatch ? null : mismatchNote,
        })),
        ...invalidUrls.map((u) => ({
          domainUrlId: u.id,
          httpStatus: submitResult.httpStatus,
          submissionStatus: "rejected" as GoogleSubmissionStatus,
          trackingId: null,
          errorMessage: "Rejected by RocketIndexer as invalid",
        })),
      ];

      recordGoogleSubmissions(batch.id, perUrlResults);

      if (trackingIdsMatch) {
        for (let i = 0; i < validUrls.length; i++) {
          setGoogleTrackingId(validUrls[i].id, submitResult.trackingIds[i]);
        }
      }

      const outcome: GoogleBatchDomainOutcome = "submitted";
      recordGoogleBatchDomainOutcome({
        batchId: batch.id,
        domainId: domain.id,
        outcome,
        httpStatus: submitResult.httpStatus,
        responseBody: null,
        urlCount: activeUrls.length,
        creditsRemaining: submitResult.creditsRemaining,
        errorMessage: mismatchNote ?? (invalidUrls.length > 0 ? `${invalidUrls.length} URL(s) rejected as invalid` : null),
      });

      totalUrlCount += activeUrls.length;

      return {
        domainId: domain.id,
        host: domain.host,
        outcome,
        httpStatus: submitResult.httpStatus,
        urlCount: activeUrls.length,
        error: mismatchNote,
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

  finishGoogleBatch(batch.id, domains.length, totalUrlCount);

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
