import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionEmail } from "@/lib/app-session";
import { canEdit } from "@/lib/access";
import { getDashboardUserByEmail } from "@/lib/users";
import { writeAuditEntry } from "@/lib/audit";

const BASE_ID = "app5eoO1QYp4UAoaU";
const TABLE_ID = "tblx66f77FNlyJ3m4";

const FIELD_MAP = {
  name: "Name",
  email: "PHS Email",
  personalEmail: "Personal email",
  phoneNumber: "Phone Number",
  dateOfBirth: "Date of Birth",
  startDate: "(EDIT) Start Date",
  status: "Status",
  role: "Role",
  licensingStatus: "Licensing",
  currentStage: "Current Stage",
  contractingDesignation: "Contracting Designation",
  npn: "NPN",
  ssn: "SSN",
  discordUserId: "Discord User ID",
  residentState: "Resident State",
} as const;

type EditableKey = keyof typeof FIELD_MAP;

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionEmail = await getSessionEmail();

  if (!sessionEmail) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dashboardUser = await getDashboardUserByEmail(sessionEmail);

  if (!dashboardUser || dashboardUser.status !== "active" || !canEdit(dashboardUser.role)) {
    return NextResponse.json({ error: "You do not have permission to edit employee records." }, { status: 403 });
  }

  const token = process.env.AIRTABLE_PAT;
  if (!token) {
    return NextResponse.json({ error: "AIRTABLE_PAT is not configured." }, { status: 500 });
  }

  const { id } = await context.params;
  const body = await request.json() as Partial<Record<EditableKey, unknown>>;

  const currentResponse = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!currentResponse.ok) {
    const detail = await currentResponse.text();
    return NextResponse.json(
      { error: `Could not load Airtable record (${currentResponse.status}): ${detail}` },
      { status: currentResponse.status },
    );
  }

  const current = await currentResponse.json() as {
    id: string;
    fields: Record<string, unknown>;
  };

  const fields: Record<string, unknown> = {};
  const changes: Array<{ key: EditableKey; field: string; oldValue: string; newValue: string }> = [];

  for (const key of Object.keys(FIELD_MAP) as EditableKey[]) {
    if (!(key in body)) continue;

    const field = FIELD_MAP[key];
    const raw = body[key];
    const newValue = raw === null || raw === undefined ? "" : String(raw).trim();
    const oldValue = text(current.fields[field]).trim();

    if (oldValue === newValue) continue;

    if (key === "npn") {
      if (!newValue) {
        fields[field] = null;
      } else {
        const parsed = Number(newValue.replace(/,/g, ""));
        if (!Number.isFinite(parsed)) {
          return NextResponse.json(
            { error: "NPN must be a valid number." },
            { status: 400 },
          );
        }
        fields[field] = parsed;
      }
    } else {
      fields[field] = newValue || null;
    }

    changes.push({ key, field, oldValue, newValue });
  }

  if (!changes.length) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const updateResponse = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
      cache: "no-store",
    },
  );

  if (!updateResponse.ok) {
    const detail = await updateResponse.text();
    return NextResponse.json(
      { error: `Airtable update failed (${updateResponse.status}): ${detail}` },
      { status: updateResponse.status },
    );
  }

  const updated = await updateResponse.json() as {
    id: string;
    fields: Record<string, unknown>;
  };

  const entityName =
    text(updated.fields["Name"]) ||
    text(current.fields["Name"]) ||
    id;

  await Promise.all(
    changes.map(change =>
      writeAuditEntry({
        userEmail: dashboardUser.email,
        userName: dashboardUser.name || "",
        role: dashboardUser.role,
        action: "Updated employee record",
        entityType: "Agent",
        entityId: id,
        entityName,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      }).catch(() => undefined),
    ),
  );

  revalidateTag("dashboard-data", "max");

  return NextResponse.json({
    ok: true,
    changed: changes.length,
    recordId: updated.id,
    updatedFields: updated.fields,
    target: {
      baseId: BASE_ID,
      tableId: TABLE_ID,
      tableName: "Company Directory (Revamp)",
      viewName: "UNFILTERED",
    },
  });
}
