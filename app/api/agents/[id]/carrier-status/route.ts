import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/app-session";
import { getDashboardData } from "@/lib/airtable";
import {
  getCarrierStatusesForAgent,
  updateCarrierStatusesForAgent,
  type CarrierStatusUpdate,
} from "@/lib/contracting";
import { canEdit } from "@/lib/access";
import { getDashboardUserByEmail } from "@/lib/users";
import { writeAuditEntry } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const email = await getSessionEmail();

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dashboardUser = await getDashboardUserByEmail(email);

  if (!dashboardUser || dashboardUser.status !== "active") {
    return NextResponse.json(
      { error: "Your account is not active." },
      { status: 403 },
    );
  }

  const role = dashboardUser.role;

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Your account is read-only." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = await request.json() as {
    updates?: CarrierStatusUpdate[];
  };

  if (!Array.isArray(body.updates) || !body.updates.length) {
    return NextResponse.json(
      { error: "No carrier changes were supplied." },
      { status: 400 },
    );
  }

  const { agents } = await getDashboardData();
  const agent = agents.find(item => item.id === id);

  if (!agent?.email) {
    return NextResponse.json(
      { error: "This agent does not have a PHS Email to match against the RTS tracker." },
      { status: 400 },
    );
  }

  try {
    const result = await updateCarrierStatusesForAgent(agent.email, body.updates);
    const updated = await getCarrierStatusesForAgent(agent.email);

    let auditWarning = "";

    try {
      const auditWrites = body.updates.flatMap(update => {
        const previous = result.previous.find(item => item.carrier === update.carrier);
        const entries: Promise<void>[] = [];

        if ((previous?.status || "None") !== update.status) {
          entries.push(writeAuditEntry({
            userEmail: email,
            userName: dashboardUser.name || "",
            role,
            action: "Updated carrier status",
            entityType: "Agent",
            entityId: agent.id,
            entityName: agent.name,
            field: update.carrier,
            oldValue: previous?.status || "None",
            newValue: update.status,
          }));
        }

        const oldWriting = previous?.writingNumber || "";
        const newWriting = update.status === "RTS"
          ? (update.writingNumber || "")
          : "";

        if (oldWriting !== newWriting) {
          entries.push(writeAuditEntry({
            userEmail: email,
            userName: session.user?.name || "",
            role,
            action: "Updated writing number",
            entityType: "Agent",
            entityId: agent.id,
            entityName: agent.name,
            field: `${update.carrier} Writing Number`,
            oldValue: oldWriting || "None",
            newValue: newWriting || "None",
          }));
        }

        return entries;
      });

      await Promise.all(auditWrites);
    } catch (error) {
      auditWarning = error instanceof Error
        ? error.message
        : "Audit log update failed.";
    }

    return NextResponse.json({
      ok: true,
      carrierStatuses: updated,
      auditWarning: auditWarning || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Carrier update failed.",
      },
      { status: 400 },
    );
  }
}
