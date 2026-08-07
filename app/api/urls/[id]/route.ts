import { NextResponse } from "next/server";
import { z } from "zod";
import { updateIndexedStatus } from "@/lib/db/urls";

const patchSchema = z.object({ indexedStatus: z.string().trim().min(1).max(200) });

export async function PATCH(request: Request, ctx: RouteContext<"/api/urls/[id]">) {
  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 }
    );
  }

  const url = updateIndexedStatus(Number(id), parsed.data.indexedStatus);
  if (!url) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ data: url });
}
