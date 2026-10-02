import type { AppRole } from "./access";

export type AuditEntry = {
  id: string;
  timestamp: string;
  userEmail: string;
  userName?: string;
  role: AppRole | string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
};

const DEFAULT_BASE_ID = "app5eoO1QYp4UAoaU";
const DEFAULT_TABLE = "Dashboard Audit Log";

function config() {
  return {
    token: process.env.AIRTABLE_PAT,
    baseId: process.env.AIRTABLE_AUDIT_BASE_ID || DEFAULT_BASE_ID,
    table: process.env.AIRTABLE_AUDIT_TABLE || DEFAULT_TABLE,
  };
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export async function writeAuditEntry(input: Omit<AuditEntry, "id" | "timestamp"> & { timestamp?: string }) {
  const { token, baseId, table } = config();
  if (!token) throw new Error("AIRTABLE_PAT is missing.");

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{
        fields: {
          Timestamp: input.timestamp || new Date().toISOString(),
          "User Email": input.userEmail,
          "User Name": input.userName || "",
          Role: input.role,
          Action: input.action,
          "Entity Type": input.entityType,
          "Entity ID": input.entityId || "",
          "Entity Name": input.entityName || "",
          Field: input.field || "",
          "Old Value": input.oldValue || "",
          "New Value": input.newValue || "",
        },
      }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Audit log write failed: Airtable returned ${response.status}: ${detail}`);
  }
}

export async function getAuditEntries(limit = 100): Promise<{
  entries: AuditEntry[];
  error?: string;
}> {
  const { token, baseId, table } = config();
  if (!token) return { entries: [], error: "AIRTABLE_PAT is missing." };

  try {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", String(Math.min(limit, 100)));
    url.searchParams.set("sort[0][field]", "Timestamp");
    url.searchParams.set("sort[0][direction]", "desc");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        entries: [],
        error: `Airtable returned ${response.status}: ${detail}`,
      };
    }

    const json = await response.json() as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };

    return {
      entries: json.records.map(record => ({
        id: record.id,
        timestamp: text(record.fields["Timestamp"]),
        userEmail: text(record.fields["User Email"]),
        userName: text(record.fields["User Name"]) || undefined,
        role: text(record.fields["Role"]),
        action: text(record.fields["Action"]),
        entityType: text(record.fields["Entity Type"]),
        entityId: text(record.fields["Entity ID"]) || undefined,
        entityName: text(record.fields["Entity Name"]) || undefined,
        field: text(record.fields["Field"]) || undefined,
        oldValue: text(record.fields["Old Value"]) || undefined,
        newValue: text(record.fields["New Value"]) || undefined,
      })),
    };
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : "Unknown audit log error",
    };
  }
}
