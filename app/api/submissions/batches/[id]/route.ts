import { NextResponse } from "next/server";
import { getBatchById, getBatchDomainDetails } from "@/lib/db/submissions";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/submissions/batches/[id]">
) {
  const { id } = await ctx.params;
  const batch = getBatchById(Number(id));
  if (!batch) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
  const domains = getBatchDomainDetails(batch.id);
  return NextResponse.json({ data: { batch, domains } });
}
