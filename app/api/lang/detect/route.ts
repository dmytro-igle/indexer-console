import { NextResponse } from "next/server";
import { resolveTargetDomains } from "@/lib/api/bulk";
import { detectDomainLang } from "@/lib/indexnow/langDetect";
import { recordLangDetection } from "@/lib/db/langDetections";

export async function POST(request: Request) {
  const domains = await resolveTargetDomains(request);

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const result = await detectDomainLang(domain.host);
      recordLangDetection({
        domainId: domain.id,
        rawLang: result.rawLang,
        detectedCountry: result.detectedCountry,
        htmlTitle: result.htmlTitle,
        markersFound: result.markersFound,
        isMismatch: result.isMismatch,
        httpStatus: result.httpStatus,
        errorMessage: result.errorMessage,
      });
      return {
        domainId: domain.id,
        host: domain.host,
        rawLang: result.rawLang,
        detectedCountry: result.detectedCountry,
        isMismatch: result.isMismatch,
        markersFound: result.markersFound,
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
          rawLang: null,
          detectedCountry: "Unknown (error)",
          isMismatch: false,
          markersFound: [],
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );

  return NextResponse.json({ data });
}
