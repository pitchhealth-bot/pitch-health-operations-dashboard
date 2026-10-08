import { NextResponse } from "next/server";
import { canEdit } from "@/lib/access";
import { getSessionEmail } from "@/lib/app-session";
import { getDashboardData } from "@/lib/airtable";
import { uploadCarrierCertificate } from "@/lib/carrier-certificates";
import { writeAuditEntry } from "@/lib/audit";
import { getDashboardUserByEmail, listDashboardUsers } from "@/lib/users";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionEmail = await getSessionEmail();

  let effectiveEmail = sessionEmail;
  let dashboardUser = sessionEmail
    ? await getDashboardUserByEmail(sessionEmail)
    : null;

  if (!sessionEmail) {
    const users = await listDashboardUsers();
    const hasCompletedLogin = users.some(user => Boolean(user.lastLoginAt));

    if (hasCompletedLogin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const setupAdmin =
      users.find(user => user.role === "super_admin" && user.status === "active") ||
      null;

    if (!setupAdmin) {
      return NextResponse.json(
        { error: "No active Super Admin account is available for setup mode." },
        { status: 403 },
      );
    }

    effectiveEmail = setupAdmin.email;
    dashboardUser = setupAdmin;
  }

  if (!dashboardUser || dashboardUser.status !== "active") {
    return NextResponse.json({ error: "Your account is not active." }, { status: 403 });
  }

  if (!canEdit(dashboardUser.role)) {
    return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });
  }

  const { id } = await context.params;
  const { agents } = await getDashboardData();
  const agent = agents.find(item => item.id === id);

  if (!agent?.email) {
    return NextResponse.json(
      { error: "This agent does not have a work email to match in Airtable." },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const carrier = String(formData.get("carrier") || "");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please choose a certificate file." }, { status: 400 });
  }

  try {
    const result = await uploadCarrierCertificate({
      agentRecordId: agent.id,
      email: agent.email,
      name: agent.name,
      carrier,
      file,
      uploadedByEmail: effectiveEmail || dashboardUser.email,
    });

    try {
      await writeAuditEntry({
        userEmail: effectiveEmail || dashboardUser.email,
        userName: dashboardUser.name || "",
        role: dashboardUser.role,
        action: "Uploaded carrier certificate",
        entityType: "Agent",
        entityId: agent.id,
        entityName: agent.name,
        field: carrier,
        oldValue: "",
        newValue: "Contract Submitted",
      });
    } catch {
      // Upload should still succeed even if audit logging is temporarily unavailable.
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
