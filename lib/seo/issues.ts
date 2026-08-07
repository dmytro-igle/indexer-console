export interface BriefIssueRow {
  reference: string;
  description: string;
  action: string;
}

/**
 * Loosened shape (rather than the full SeoAuditRow) so this can be called
 * both with a raw DB row (booleans as 0/1) and with the coerced-boolean
 * shape used in DomainSummary — the truthy checks below work identically
 * either way.
 */
export interface SeoAuditForIssues {
  http_status: number | null;
  https_redirects: number | boolean;
  https_final_url: string | null;
  https_final_status: number | null;
  has_viewport_meta: number | boolean;
  meta_description: string | null;
  meta_description_length: number | null;
  meta_description_flag: "missing" | "too_long" | "ok" | null;
  has_hreflang: number | boolean;
  robots_txt_has_sitemap: number | boolean;
  error_message: string | null;
}

export interface DeriveIssuesInput {
  domain: { host: string };
  seoAudit: SeoAuditForIssues | null;
  sitemapStatus: "success" | "partial" | "failed" | null;
}

/**
 * Pure function — the single source of truth for "what's wrong with this
 * domain" used by the downloadable brief, the dashboard's SEO Audit column,
 * and the domain detail page's Issues list.
 */
export function deriveBriefIssues(input: DeriveIssuesInput): BriefIssueRow[] {
  const { domain, seoAudit, sitemapStatus } = input;
  const issues: BriefIssueRow[] = [];
  const homepageUrl = `https://${domain.host}/`;

  if (sitemapStatus === "failed") {
    issues.push({
      reference: "Implement an XML Sitemaps File",
      description:
        "No XML sitemap found. Add a sitemap.xml or declare it in your robots.txt file.",
      action: `Implement a sitemap.xml at ${homepageUrl}sitemap.xml (or declare it in robots.txt).`,
    });
  }

  if (!seoAudit) return issues;

  if (!seoAudit.https_redirects) {
    issues.push({
      reference: "Redirect HTTP to HTTPS",
      description: `Page does not redirect to a HTTPS (SSL secure) version. Observed final URL: ${seoAudit.https_final_url ?? "unknown"} (HTTP ${seoAudit.https_final_status ?? "—"}).`,
      action: `Add a permanent (301) redirect from http://${domain.host}/ to https://${domain.host}/.`,
    });
  }

  const homepageReachable =
    seoAudit.http_status !== null && seoAudit.http_status >= 200 && seoAudit.http_status < 300;

  if (homepageReachable) {
    if (!seoAudit.has_viewport_meta) {
      issues.push({
        reference: "Add a Responsive Viewport Meta Tag",
        description:
          'No <meta name="viewport"> tag was found. Note: this is a shallow proxy check only — it does not measure real page speed or full mobile usability, both of which require a headless-browser tool (e.g. Lighthouse or PageSpeed Insights) that this app does not run.',
        action: `Add <meta name="viewport" content="width=device-width, initial-scale=1"> to ${homepageUrl}.`,
      });
    }
    if (seoAudit.meta_description_flag === "missing") {
      issues.push({
        reference: "Add a Meta Description",
        description: "No meta description was found on the homepage.",
        action: `Add a <meta name="description"> tag (under 160 characters) to ${homepageUrl}.`,
      });
    } else if (seoAudit.meta_description_flag === "too_long") {
      issues.push({
        reference: "Shorten the Meta Description",
        description: `Your meta description is too long (${seoAudit.meta_description_length} characters). Current text: "${seoAudit.meta_description ?? ""}". Consider shortening it to under 160 characters.`,
        action: `Rewrite the meta description on ${homepageUrl} to be under 160 characters.`,
      });
    }
    if (!seoAudit.has_hreflang) {
      issues.push({
        reference: "Add Hreflang Tags",
        description:
          "No hreflang tags found. If your site has language- or region-specific versions, add hreflang tags to help search engines show the right version of the page.",
        action: `Add <link rel="alternate" hreflang="..."> tags to ${homepageUrl} if language/region variants exist.`,
      });
    }
  } else {
    issues.push({
      reference: "Homepage Unreachable During Audit",
      description: `The homepage could not be fetched during the last SEO audit (HTTP ${seoAudit.http_status ?? "—"}${seoAudit.error_message ? `: ${seoAudit.error_message}` : ""}). Viewport, meta description, and hreflang could not be checked as a result.`,
      action: `Investigate why ${homepageUrl} is unreachable, then re-run the SEO audit.`,
    });
  }

  if (!seoAudit.robots_txt_has_sitemap) {
    issues.push({
      reference: "Declare Sitemap in robots.txt",
      description:
        "robots.txt file is missing a valid sitemap URL. Add your sitemap URL to help search engines find and crawl your website.",
      action: `Add "Sitemap: ${homepageUrl}sitemap.xml" to https://${domain.host}/robots.txt.`,
    });
  }

  return issues;
}
