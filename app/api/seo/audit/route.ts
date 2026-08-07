import { NextResponse } from "next/server";
import { resolveTargetDomains } from "@/lib/api/bulk";
import { auditDomainSeo } from "@/lib/seo/audit";
import { recordSeoAudit } from "@/lib/db/seoAudits";

export async function POST(request: Request) {
  const domains = await resolveTargetDomains(request);

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const result = await auditDomainSeo(domain.host);
      recordSeoAudit({
        domainId: domain.id,
        httpStatus: result.httpStatus,
        httpsRedirects: result.httpsRedirects,
        httpsFinalUrl: result.httpsFinalUrl,
        httpsFinalStatus: result.httpsFinalStatus,
        hasViewportMeta: result.hasViewportMeta,
        robotsTxtHasSitemap: result.robotsTxtHasSitemap,
        robotsTxtSitemapUrl: result.robotsTxtSitemapUrl,
        metaDescription: result.metaDescription,
        metaDescriptionLength: result.metaDescriptionLength,
        metaDescriptionFlag: result.metaDescriptionFlag,
        hasHreflang: result.hasHreflang,
        hreflangCount: result.hreflangCount,
        errorMessage: result.errorMessage,
      });
      return {
        domainId: domain.id,
        host: domain.host,
        httpsRedirects: result.httpsRedirects,
        hasViewportMeta: result.hasViewportMeta,
        robotsTxtHasSitemap: result.robotsTxtHasSitemap,
        metaDescriptionFlag: result.metaDescriptionFlag,
        hasHreflang: result.hasHreflang,
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
          httpsRedirects: false,
          hasViewportMeta: false,
          robotsTxtHasSitemap: false,
          metaDescriptionFlag: "missing" as const,
          hasHreflang: false,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );

  return NextResponse.json({ data });
}
