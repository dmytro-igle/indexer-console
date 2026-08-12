import { NextResponse } from "next/server";
import { resolveTargetDomains } from "@/lib/api/bulk";
import { fetchDomainSitemap } from "@/lib/indexnow/sitemap";
import { recordSitemapRun } from "@/lib/db/sitemapRuns";
import { syncDomainUrls } from "@/lib/db/urls";

export async function POST(request: Request) {
  const domains = await resolveTargetDomains(request);

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const result = await fetchDomainSitemap(domain.host);
      const syncResult = syncDomainUrls(domain.id, result.urls);
      const run = recordSitemapRun({
        domainId: domain.id,
        status: result.status,
        urlCount: result.urls.length,
        sitemapsTried: result.sitemapsVisited,
        errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      });
      return {
        domainId: domain.id,
        host: domain.host,
        status: result.status,
        urlCount: result.urls.length,
        newUrlCount: syncResult.newUrls.length,
        newUrls: syncResult.newUrls,
        reactivatedUrlCount: syncResult.reactivatedUrls.length,
        reactivatedUrls: syncResult.reactivatedUrls,
        sitemapsVisited: result.sitemapsVisited,
        error: run.error_message,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          domainId: domains[i].id,
          host: domains[i].host,
          status: "failed" as const,
          urlCount: 0,
          sitemapsVisited: [],
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );

  return NextResponse.json({ data });
}
