import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/app-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getDashboardUserByEmail,
  listDashboardUsers,
} from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const targetEmail = body.email?.trim().toLowerCase();

    if (!targetEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const target = await getDashboardUserByEmail(targetEmail);
    if (!target || target.status === "inactive") {
      return NextResponse.json({ error: "That dashboard user is not active." }, { status: 404 });
    }

    const sessionEmail = await getSessionEmail();

    if (sessionEmail) {
      const current = await getDashboardUserByEmail(sessionEmail);
      if (!current || current.status !== "active" || current.role !== "super_admin") {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      }
    } else {
      const users = await listDashboardUsers();
      const hasCompletedLogin = users.some(user => Boolean(user.lastLoginAt));

      if (hasCompletedLogin || target.role !== "super_admin") {
        return NextResponse.json({ error: "Super Admin sign-in required." }, { status: 403 });
      }
    }

    const origin = new URL(request.url).origin;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.auth.admin.inviteUserByEmail(target.email, {
      redirectTo: `${origin}/auth/accept`,
      data: {
        name: target.name || "",
        dashboard_role: target.role,
      },
    });

    if (error) {
      const fallback = await supabase.auth.signInWithOtp({
        email: target.email,
        options: {
          emailRedirectTo: `${origin}/auth/accept`,
          shouldCreateUser: false,
        },
      });

      if (fallback.error) throw new Error(fallback.error.message);
    }

    return NextResponse.json({ ok: true, branded: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send invite." },
      { status: 400 },
    );
  }
}
