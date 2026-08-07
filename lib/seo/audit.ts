import { fetchWithTimeout } from "@/lib/http";
import type { SeoAuditResult } from "./types";

const HOMEPAGE_MAX_BYTES = 300_000;
const ROBOTS_MAX_BYTES = 20_000;
const META_DESCRIPTION_MAX_LENGTH = 160;

const VIEWPORT_META_REGEX = /<meta\b(?=[^>]*\bname=["']viewport["'])[^>]*>/i;
const META_DESCRIPTION_REGEX =
  /<meta\b(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']([^"']*)["'])[^>]*>/i;
const HREFLANG_LINK_REGEX =
  /<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhreflang=["'][^"']+["'])[^>]*>/gi;
const SITEMAP_DIRECTIVE_REGEX = /^\s*sitemap\s*:\s*(\S+)/im;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Lightweight, regex-based technical SEO checks — a plain HTTP fetch, not a
 * headless-browser audit. In particular "viewport meta tag present" is only
 * a shallow proxy for mobile-friendliness, and real page load speed is not
 * measured at all (would require a tool like Lighthouse/PageSpeed Insights).
 */
export async function auditDomainSeo(host: string): Promise<SeoAuditResult> {
  const errors: string[] = [];

  const [homepage, httpRoot, robots] = await Promise.all([
    fetchWithTimeout(`https://${host}/`, { timeoutMs: 10_000, maxBytes: HOMEPAGE_MAX_BYTES }),
    fetchWithTimeout(`http://${host}/`, { timeoutMs: 10_000, maxBytes: 2048 }),
    fetchWithTimeout(`https://${host}/robots.txt`, { timeoutMs: 10_000, maxBytes: ROBOTS_MAX_BYTES }),
  ]);

  // HTTPS redirect: does starting at http:// end up at an https:// URL?
  let httpsRedirects = false;
  let httpsFinalUrl: string | null = null;
  let httpsFinalStatus: number | null = null;
  if (httpRoot.error) {
    errors.push(`http redirect check: ${httpRoot.error}`);
  } else {
    httpsFinalUrl = httpRoot.finalUrl;
    httpsFinalStatus = httpRoot.status;
    httpsRedirects = Boolean(httpRoot.finalUrl?.startsWith("https://"));
  }

  // robots.txt Sitemap: directive, and whether the declared URL is actually fetchable
  let robotsTxtHasSitemap = false;
  let robotsTxtSitemapUrl: string | null = null;
  if (robots.error || !robots.ok) {
    errors.push(`robots.txt: ${robots.error ?? `HTTP ${robots.status}`}`);
  } else {
    const match = robots.body.match(SITEMAP_DIRECTIVE_REGEX);
    if (match) {
      const declaredUrl = match[1];
      robotsTxtSitemapUrl = declaredUrl;
      const sitemapCheck = await fetchWithTimeout(declaredUrl, { timeoutMs: 10_000, maxBytes: 512 });
      if (sitemapCheck.ok) {
        robotsTxtHasSitemap = true;
      } else {
        errors.push(
          `robots.txt Sitemap: line points to ${declaredUrl}, not fetchable (${sitemapCheck.error ?? `HTTP ${sitemapCheck.status}`})`
        );
      }
    }
  }

  // Homepage-HTML-derived checks
  let hasViewportMeta = false;
  let metaDescription: string | null = null;
  let metaDescriptionLength = 0;
  let metaDescriptionFlag: "missing" | "too_long" | "ok" = "missing";
  let hasHreflang = false;
  let hreflangCount = 0;

  if (!homepage.ok || homepage.error) {
    errors.push(`homepage fetch: ${homepage.error ?? `HTTP ${homepage.status}`}`);
  } else {
    const html = homepage.body;

    hasViewportMeta = VIEWPORT_META_REGEX.test(html);

    const descMatch = html.match(META_DESCRIPTION_REGEX);
    const rawDesc = descMatch ? decodeEntities(descMatch[1]).trim() : null;
    metaDescription = rawDesc && rawDesc.length > 0 ? rawDesc : null;
    metaDescriptionLength = metaDescription?.length ?? 0;
    metaDescriptionFlag = !metaDescription
      ? "missing"
      : metaDescriptionLength > META_DESCRIPTION_MAX_LENGTH
        ? "too_long"
        : "ok";

    hreflangCount = (html.match(HREFLANG_LINK_REGEX) ?? []).length;
    hasHreflang = hreflangCount > 0;
  }

  return {
    httpStatus: homepage.status,
    httpsRedirects,
    httpsFinalUrl,
    httpsFinalStatus,
    hasViewportMeta,
    robotsTxtHasSitemap,
    robotsTxtSitemapUrl,
    metaDescription,
    metaDescriptionLength,
    metaDescriptionFlag,
    hasHreflang,
    hreflangCount,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
  };
}
