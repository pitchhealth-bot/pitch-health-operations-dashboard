import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardUserByEmail } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const dashboardUser = await getDashboardUserByEmail(email);

    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json({ ok: true });
    }

    const origin = new URL(request.url).origin;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/accept`,
        shouldCreateUser: false,
      },
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, branded: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send sign-in link." },
      { status: 400 },
    );
  }
}
