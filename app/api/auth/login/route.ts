import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth/session";

const bodySchema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Password is required" } },
      { status: 400 }
    );
  }

  if (!checkPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: { message: "Incorrect password" } },
      { status: 401 }
    );
  }

  const { value, maxAge } = createSessionToken();
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
