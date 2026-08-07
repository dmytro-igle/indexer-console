export interface SitemapFetchResult {
  status: "success" | "partial" | "failed";
  urls: string[];
  sitemapsVisited: string[];
  errors: string[];
}

export interface KeyVerifyResult {
  success: boolean;
  httpStatus: number | null;
  responseBodySnippet: string | null;
  errorMessage: string | null;
}

export interface LangDetectResult {
  rawLang: string | null;
  detectedCountry: string;
  htmlTitle: string | null;
  markersFound: string[];
  isMismatch: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
}

export interface IndexNowSubmitResult {
  httpStatus: number | null;
  submissionStatus: "accepted" | "rejected" | "error";
  responseBody: string | null;
  errorMessage: string | null;
}
