import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardUserByEmail, updateDashboardUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/app-session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const dashboardUser = await getDashboardUserByEmail(email);

    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const updated = await updateDashboardUser(dashboardUser.id, {
      status: "active",
      lastLoginAt: new Date().toISOString(),
    });

    await setSessionCookie(updated.email);

    return NextResponse.json({
      ok: true,
      role: updated.role,
      airtableAgentRecordId: updated.airtableAgentRecordId || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not sign in." },
      { status: 400 },
    );
  }
}
