import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/app-session";

export async function POST(request: Request) {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
