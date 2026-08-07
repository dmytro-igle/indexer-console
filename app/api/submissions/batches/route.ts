import { NextResponse } from "next/server";
import { listBatches } from "@/lib/db/submissions";

export async function GET() {
  return NextResponse.json({ data: listBatches() });
}
