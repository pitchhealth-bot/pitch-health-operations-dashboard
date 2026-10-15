import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/app-session";
import { canEdit } from "@/lib/access";
import {
  getLicensingStageTrackerRecords,
  updateLicensingStageTrackerRecord,
} from "@/lib/contracting";
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

  if (!canEdit(dashboardUser.role)) {
    return NextResponse.json(
      { error: "Your account is read-only." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = await request.json() as {
    trackerRecordId?: string;
    agentName?: string;
    updates?: Record<string, string | null>;
  };

  if (!body.trackerRecordId || !body.updates) {
    return NextResponse.json(
      { error: "Tracker record and updates are required." },
      { status: 400 },
    );
  }

  try {
    const trackerRecords = await getLicensingStageTrackerRecords();
    const previous = trackerRecords.find(
      record => record.recordId === body.trackerRecordId,
    );

    await updateLicensingStageTrackerRecord(
      body.trackerRecordId,
      body.updates,
    );

    try {
      const auditWrites = Object.entries(body.updates).flatMap(([field, value]) => {
        const oldValue = previous?.fields[field] || "";
        const newValue = value || "";

        if (oldValue === newValue) return [];

        return [
          writeAuditEntry({
            userEmail: email,
            userName: dashboardUser.name || "",
            role: dashboardUser.role,
            action: "Updated licensing journey",
            entityType: "Agent",
            entityId: id,
            entityName: body.agentName || previous?.name || "Agent",
            field,
            oldValue: oldValue || "None",
            newValue: newValue || "None",
          }),
        ];
      });

      await Promise.all(auditWrites);
    } catch (auditError) {
      console.error("Agent Journey audit log failed", auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Licensing Stages update failed.",
      },
      { status: 400 },
    );
  }
}
