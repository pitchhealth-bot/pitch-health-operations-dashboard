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

    if (!dashboardUser || dashboardUser.status === "inactive") {
      return NextResponse.json({ ok: true });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://pitch-health-operations-dashboard.vercel.app").replace(/\/$/, "");
    const redirectTo = `${appUrl}/auth/accept`;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error) throw new Error(error.message);

    const tokenHash = data.properties?.hashed_token || "";
    if (!tokenHash) {
      throw new Error("Supabase did not return a secure sign-in token.");
    }

    const actionLink =
      `${appUrl}/auth/accept?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;

    await sendPitchHealthEmail({
      to: email,
      name: dashboardUser.name,
      role: dashboardUser.role,
      actionUrl: actionLink,
      type: "signin",
    });

    return NextResponse.json({ ok: true, branded: true, provider: "resend" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send sign-in link." },
      { status: 400 },
    );
  }
}
