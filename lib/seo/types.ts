export interface SeoAuditResult {
  httpStatus: number | null;
  httpsRedirects: boolean;
  httpsFinalUrl: string | null;
  httpsFinalStatus: number | null;
  hasViewportMeta: boolean;
  robotsTxtHasSitemap: boolean;
  robotsTxtSitemapUrl: string | null;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaDescriptionFlag: "missing" | "too_long" | "ok";
  hasHreflang: boolean;
  hreflangCount: number;
  errorMessage: string | null;
}
