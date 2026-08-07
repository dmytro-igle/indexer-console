import { NextResponse } from "next/server";
import { z } from "zod";
import { getDomainById, updateDomain, softDeleteDomain } from "@/lib/db/domains";

const patchSchema = z.object({
  host: z.string().trim().min(1).optional(),
  key: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{8,128}$/i)
    .optional(),
  keyLocation: z.string().trim().url().optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/domains/[id]">) {
  const { id } = await ctx.params;
  const domain = getDomainById(Number(id));
  if (!domain) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ data: domain });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/domains/[id]">) {
  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 }
    );
  }

  const domain = updateDomain(Number(id), parsed.data);
  if (!domain) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ data: domain });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/domains/[id]">) {
  const { id } = await ctx.params;
  softDeleteDomain(Number(id));
  return NextResponse.json({ data: { ok: true } });
}
