import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPitchHealthEmail } from "@/lib/pitch-health-email";
import { getDashboardUserByEmail } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const dashboardUser = await getDashboardUserByEmail(email);

    // Keep the response deliberately generic for unknown/inactive accounts.
    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json({ ok: true });
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/auth/accept`;
    const supabase = getSupabaseAdmin();

    let actionLink = "";

    const magicLink = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (!magicLink.error) {
      actionLink = magicLink.data.properties?.action_link || "";
    } else {
      const inviteLink = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
          data: {
            name: dashboardUser.name || "",
            dashboard_role: dashboardUser.role,
          },
        },
      });

      if (inviteLink.error) throw new Error(inviteLink.error.message);

      actionLink = inviteLink.data.properties?.action_link || "";
    }

    if (!actionLink) {
      throw new Error("Supabase did not return a secure sign-in link.");
    }

    await sendPitchHealthEmail({
      to: email,
      name: dashboardUser.name,
      role: dashboardUser.role,
      actionUrl: actionLink,
      type: "signin",
    });

    return NextResponse.json({ ok: true, branded: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send sign-in link." },
      { status: 400 },
    );
  }
}
