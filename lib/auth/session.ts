import { createHmac, timingSafeEqual, createHash } from "node:crypto";

const COOKIE_NAME = "indexnow_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false",
  sameSite: "lax" as const,
  path: "/",
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function getTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? "720");
  return hours * 60 * 60;
}

function sign(expiresAt: number): string {
  return createHmac("sha256", getSecret())
    .update(String(expiresAt))
    .digest("hex");
}

export function createSessionToken(): {
  value: string;
  maxAge: number;
} {
  const ttl = getTtlSeconds();
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const sig = sign(expiresAt);

  return {
    value: `${expiresAt}.${sig}`,
    maxAge: ttl,
  };
}

export function verifySessionToken(
  cookieValue: string | undefined | null,
): boolean {
  if (!cookieValue) return false;

  const [expiresAtStr, sig] = cookieValue.split(".");
  if (!expiresAtStr || !sig) return false;

  const expiresAt = Number(expiresAtStr);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt < Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const expectedSig = sign(expiresAt);

  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    throw new Error("APP_PASSWORD environment variable is not set");
  }

  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();

  return timingSafeEqual(a, b);
}

export { COOKIE_NAME };
