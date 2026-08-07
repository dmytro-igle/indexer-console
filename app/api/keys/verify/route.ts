import { NextResponse } from "next/server";
import { resolveTargetDomains } from "@/lib/api/bulk";
import { verifyDomainKey } from "@/lib/indexnow/keyVerify";
import { recordKeyVerification } from "@/lib/db/keyVerifications";

export async function POST(request: Request) {
  const domains = await resolveTargetDomains(request);

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const result = await verifyDomainKey(domain.key_location, domain.key);
      recordKeyVerification({
        domainId: domain.id,
        success: result.success,
        httpStatus: result.httpStatus,
        responseBodySnippet: result.responseBodySnippet,
        errorMessage: result.errorMessage,
      });
      return {
        domainId: domain.id,
        host: domain.host,
        success: result.success,
        httpStatus: result.httpStatus,
        error: result.errorMessage,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          domainId: domains[i].id,
          host: domains[i].host,
          success: false,
          httpStatus: null,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );

  return NextResponse.json({ data });
}
