import { getSupabaseAdmin } from "./supabase-admin";

export type DashboardRole = "super_admin" | "admin" | "agent";
export type DashboardUserStatus = "active" | "inactive" | "invited";

export type DashboardUser = {
  id: string;
  email: string;
  name?: string;
  role: DashboardRole;
  status: DashboardUserStatus;
  airtableAgentRecordId?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByEmail?: string;
};

function mapRow(row: Record<string, unknown>): DashboardUser {
  return {
    id: String(row.id),
    email: String(row.email || ""),
    name: row.name ? String(row.name) : undefined,
    role: String(row.role || "agent") as DashboardRole,
    status: String(row.status || "active") as DashboardUserStatus,
    airtableAgentRecordId: row.airtable_agent_record_id ? String(row.airtable_agent_record_id) : undefined,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    createdByEmail: row.created_by_email ? String(row.created_by_email) : undefined,
  };
}

export async function getDashboardUserByEmail(email?: string | null) {
  if (!email) return null;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("dashboard_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function listDashboardUsers() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dashboard_users")
    .select("*")
    .order("name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(row => mapRow(row));
}

export async function createDashboardUser(input: {
  email: string;
  name?: string;
  role: DashboardRole;
  status: DashboardUserStatus;
  airtableAgentRecordId?: string;
  createdByEmail?: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("dashboard_users")
    .insert({
      email: input.email.trim().toLowerCase(),
      name: input.name?.trim() || null,
      role: input.role,
      status: input.status,
      airtable_agent_record_id: input.airtableAgentRecordId || null,
      created_by_email: input.createdByEmail || null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateDashboardUser(
  id: string,
  input: Partial<{
    name: string;
    role: DashboardRole;
    status: DashboardUserStatus;
    airtableAgentRecordId: string | null;
    lastLoginAt: string;
  }>,
) {
  const supabase = getSupabaseAdmin();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) payload.name = input.name || null;
  if (input.role !== undefined) payload.role = input.role;
  if (input.status !== undefined) payload.status = input.status;
  if (input.airtableAgentRecordId !== undefined) {
    payload.airtable_agent_record_id = input.airtableAgentRecordId || null;
  }
  if (input.lastLoginAt !== undefined) payload.last_login_at = input.lastLoginAt;

  const { data, error } = await supabase
    .from("dashboard_users")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function touchLastLogin(email: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("dashboard_users")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email", email.trim().toLowerCase());
}
