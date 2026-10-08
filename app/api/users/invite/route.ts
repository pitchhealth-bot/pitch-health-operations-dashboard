import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/app-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPitchHealthEmail } from "@/lib/pitch-health-email";
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
    const redirectTo = `${origin}/auth/accept`;
    const supabase = getSupabaseAdmin();

    let actionLink = "";

    const inviteLink = await supabase.auth.admin.generateLink({
      type: "invite",
      email: target.email,
      options: {
        redirectTo,
        data: {
          name: target.name || "",
          dashboard_role: target.role,
        },
      },
    });

    if (!inviteLink.error) {
      actionLink = inviteLink.data.properties?.action_link || "";
    } else {
      const magicLink = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
        options: { redirectTo },
      });

      if (magicLink.error) throw new Error(magicLink.error.message);
      actionLink = magicLink.data.properties?.action_link || "";
    }

    if (!actionLink) {
      throw new Error("Supabase did not return a secure invite link.");
    }

    await sendPitchHealthEmail({
      to: target.email,
      name: target.name,
      role: target.role,
      actionUrl: actionLink,
      type: "invite",
    });

    return NextResponse.json({ ok: true, branded: true, provider: "resend" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send invite." },
      { status: 400 },
    );
  }
}
