import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardUserByEmail, updateDashboardUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/app-session";

type VerifyType = "invite" | "magiclink";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      accessToken?: string;
      tokenHash?: string;
      type?: VerifyType;
    };

    const supabase = getSupabaseAdmin();

    let email = "";

    if (body.tokenHash) {
      const type: VerifyType =
        body.type === "magiclink" ? "magiclink" : "invite";

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: body.tokenHash,
        type,
      });

      if (error || !data.user?.email) {
        return NextResponse.json(
          { error: "This sign-in link is invalid or expired." },
          { status: 401 },
        );
      }

      email = data.user.email;
    } else if (body.accessToken) {
      const { data, error } = await supabase.auth.getUser(body.accessToken);

      if (error || !data.user?.email) {
        return NextResponse.json(
          { error: "This sign-in link is invalid or expired." },
          { status: 401 },
        );
      }

      email = data.user.email;
    } else {
      return NextResponse.json(
        { error: "Missing sign-in token." },
        { status: 400 },
      );
    }

    const dashboardUser = await getDashboardUserByEmail(email);

    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json(
        { error: "This account is not authorized for the dashboard." },
        { status: 403 },
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start dashboard session.",
      },
      { status: 400 },
    );
  }
}
