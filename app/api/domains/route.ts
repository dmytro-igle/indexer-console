import { NextResponse } from "next/server";
import { z } from "zod";
import { listDomains, createDomain } from "@/lib/db/domains";
import { getDb } from "@/lib/db/client";

const createSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i, "Host must look like a domain (e.g. example.com)"),
  key: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{8,128}$/i, "Key must be an 8-128 character hex string"),
  keyLocation: z.string().trim().url().optional(),
});

export async function GET() {
  const domains = listDomains();
  return NextResponse.json({ data: domains });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 }
    );
  }

  const { host, key } = parsed.data;
  const keyLocation = parsed.data.keyLocation || `https://${host}/${key}.txt`;

  const db = getDb();
  const existing = db
    .prepare<[string], { id: number }>(`SELECT id FROM domains WHERE host = ?`)
    .get(host);
  if (existing) {
    return NextResponse.json(
      { error: { message: `Domain ${host} already exists` } },
      { status: 409 }
    );
  }

  const domain = createDomain({ host, key, keyLocation });
  return NextResponse.json({ data: domain }, { status: 201 });
}
