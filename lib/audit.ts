import type { AppRole } from "./access";
import { getSupabaseAdmin } from "./supabase-admin";

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

function mapRow(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id || ""),
    timestamp: String(row.timestamp || ""),
    userEmail: String(row.user_email || ""),
    userName: row.user_name ? String(row.user_name) : undefined,
    role: String(row.role || ""),
    action: String(row.action || ""),
    entityType: String(row.entity_type || ""),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    entityName: row.entity_name ? String(row.entity_name) : undefined,
    field: row.field ? String(row.field) : undefined,
    oldValue: row.old_value ? String(row.old_value) : undefined,
    newValue: row.new_value ? String(row.new_value) : undefined,
  };
}

export async function writeAuditEntry(
  input: Omit<AuditEntry, "id" | "timestamp"> & { timestamp?: string },
) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("dashboard_audit_log")
    .insert({
      timestamp: input.timestamp || new Date().toISOString(),
      user_email: input.userEmail,
      user_name: input.userName || null,
      role: input.role || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      entity_name: input.entityName || null,
      field: input.field || null,
      old_value: input.oldValue || null,
      new_value: input.newValue || null,
    });

  if (error) {
    throw new Error(`Audit log write failed: ${error.message}`);
  }
}

export async function getAuditEntries(limit = 100): Promise<{
  entries: AuditEntry[];
  error?: string;
}> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("dashboard_audit_log")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) {
      return {
        entries: [],
        error: error.message,
      };
    }

    return {
      entries: (data || []).map(row => mapRow(row as Record<string, unknown>)),
    };
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : "Unknown audit log error",
    };
  }
}
