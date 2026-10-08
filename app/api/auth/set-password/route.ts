import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardUserByEmail, updateDashboardUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/app-session";

type VerifyType = "invite" | "recovery";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tokenHash?: string;
      type?: VerifyType;
      password?: string;
    };

    const tokenHash = body.tokenHash?.trim();
    const password = body.password || "";
    const type: VerifyType = body.type === "recovery" ? "recovery" : "invite";

    if (!tokenHash) {
      return NextResponse.json({ error: "Missing account setup token." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error || !data.user?.id || !data.user.email) {
      return NextResponse.json(
        { error: "This setup link is invalid or expired." },
        { status: 401 },
      );
    }

    const dashboardUser = await getDashboardUserByEmail(data.user.email);

    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json(
        { error: "This account is not authorized for the dashboard." },
        { status: 403 },
      );
    }

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      {
        password,
        email_confirm: true,
      },
    );

    if (updateAuthError) {
      throw new Error(updateAuthError.message);
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
      { error: error instanceof Error ? error.message : "Could not set password." },
      { status: 400 },
    );
  }
}
